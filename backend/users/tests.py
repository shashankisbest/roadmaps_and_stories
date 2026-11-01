from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from users.models import Follow


class ProfileAndFollowApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.follower = get_user_model().objects.create_user(
            username="follower", email="follower@example.test", password="test-pass"
        )
        self.followed = get_user_model().objects.create_user(
            username="followed", email="followed@example.test", password="test-pass"
        )

    def test_profile_is_public_without_sensitive_user_fields(self):
        response = self.client.get("/api/profiles/followed/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["username"], "followed")
        self.assertNotIn("email", response.data)
        self.assertNotIn("password", response.data)

    def test_follow_is_authenticated_and_idempotent(self):
        self.assertIn(
            self.client.post("/api/profiles/followed/follow/").status_code,
            (401, 403),
        )
        self.client.force_authenticate(self.follower)
        self.assertEqual(self.client.post("/api/profiles/followed/follow/").status_code, 200)
        self.client.post("/api/profiles/followed/follow/")
        self.assertEqual(Follow.objects.count(), 1)
        self.assertEqual(self.client.delete("/api/profiles/followed/follow/").status_code, 200)

    def test_self_follow_is_rejected(self):
        self.client.force_authenticate(self.follower)
        response = self.client.post("/api/profiles/follower/follow/")
        self.assertEqual(response.status_code, 400)


class AuthenticationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.registration_data = {
            "username": "newmember",
            "email": "newmember@example.test",
            "password": "A-Rare-Password-2026!",
        }

    def test_registration_creates_profile_and_returns_no_password(self):
        response = self.client.post(
            "/api/auth/register/", self.registration_data, format="json"
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"]["username"], "newmember")
        self.assertNotIn("password", response.data["user"])
        self.assertNotIn("password_hash", response.data["user"])

        account = get_user_model().objects.get(username="newmember")
        self.assertTrue(account.check_password(self.registration_data["password"]))
        self.assertTrue(hasattr(account, "profile"))
        self.assertEqual(
            self.client.get("/api/auth/current-user/").data["user"]["username"],
            "newmember",
        )

    def test_duplicate_username_and_email_are_rejected_case_insensitively(self):
        self.client.post("/api/auth/register/", self.registration_data, format="json")

        duplicate_username = self.client.post(
            "/api/auth/register/",
            {**self.registration_data, "username": "NewMember", "email": "other@example.test"},
            format="json",
        )
        duplicate_email = self.client.post(
            "/api/auth/register/",
            {**self.registration_data, "username": "anothermember", "email": "NEWMember@example.test"},
            format="json",
        )
        self.assertEqual(duplicate_username.status_code, 400)
        self.assertEqual(duplicate_email.status_code, 400)

    def test_login_accepts_email_and_logout_invalidates_session(self):
        account = get_user_model().objects.create_user(
            username="loginmember",
            email="loginmember@example.test",
            password="A-Rare-Password-2026!",
        )
        invalid = self.client.post(
            "/api/auth/login/",
            {"identifier": account.username, "password": "incorrect"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)

        valid = self.client.post(
            "/api/auth/login/",
            {"identifier": account.email, "password": "A-Rare-Password-2026!"},
            format="json",
        )
        self.assertEqual(valid.status_code, 200)
        self.assertEqual(
            self.client.get("/api/auth/current-user/").data["user"]["username"],
            account.username,
        )
        self.assertEqual(self.client.post("/api/auth/logout/").status_code, 204)
        self.assertIsNone(self.client.get("/api/auth/current-user/").data["user"])

    def test_login_and_registration_are_rate_limited(self):
        cache.clear()
        try:
            for _ in range(10):
                response = self.client.post(
                    "/api/auth/login/",
                    {"identifier": "", "password": ""},
                    format="json",
                )
                self.assertEqual(response.status_code, 400)
            limited_login = self.client.post(
                "/api/auth/login/",
                {"identifier": "", "password": ""},
                format="json",
            )
            self.assertEqual(limited_login.status_code, 429)

            for _ in range(5):
                response = self.client.post(
                    "/api/auth/register/", {}, format="json"
                )
                self.assertEqual(response.status_code, 400)
            limited_registration = self.client.post(
                "/api/auth/register/", {}, format="json"
            )
            self.assertEqual(limited_registration.status_code, 429)
        finally:
            cache.clear()

    def test_registration_and_logout_require_csrf_tokens(self):
        client = APIClient(enforce_csrf_checks=True)
        csrf_response = client.get("/api/auth/csrf/")
        csrf_token = csrf_response.json()["csrfToken"]
        denied = client.post(
            "/api/auth/register/", self.registration_data, format="json"
        )
        self.assertEqual(denied.status_code, 403)

        created = client.post(
            "/api/auth/register/",
            self.registration_data,
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(created.status_code, 201)
        csrf_token = created.data["csrfToken"]
        logged_out = client.post(
            "/api/auth/logout/", format="json", HTTP_X_CSRFTOKEN=csrf_token
        )
        self.assertEqual(logged_out.status_code, 204)

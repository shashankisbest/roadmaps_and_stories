from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from posts.models import Post, Story
from reports.models import Report


class ReportApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = get_user_model().objects.create_user(
            username="reporter", email="reporter@example.test", password="test-pass"
        )
        self.post = Post.objects.create(
            author=self.user, title="Reported story", post_type=Post.PostType.STORY
        )
        Story.objects.create(post=self.post, body="Story body")

    def test_report_requires_authentication_and_one_target(self):
        payload = {"target_post_id": self.post.pk, "reason": "spam"}
        self.assertIn(self.client.post("/api/reports/", payload).status_code, (401, 403))
        self.client.force_authenticate(self.user)
        other_user = get_user_model().objects.create_user(
            username="another-reporter", email="another-reporter@example.test"
        )
        missing_target = self.client.post("/api/reports/", {"reason": "spam"}, format="json")
        self.assertEqual(missing_target.status_code, 400)
        multiple_targets = self.client.post(
            "/api/reports/",
            {
                "target_post_id": self.post.pk,
                "target_account_id": self.user.pk,
                "reason": "spam",
            },
            format="json",
        )
        self.assertEqual(multiple_targets.status_code, 400)
        invalid_target = self.client.post(
            "/api/reports/",
            {"target_post_id": 999999, "reason": "spam"},
            format="json",
        )
        self.assertEqual(invalid_target.status_code, 400)

        response = self.client.post(
            "/api/reports/",
            {**payload, "reporter": other_user.pk, "status": "resolved"},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], "pending")
        self.assertNotIn("reporter", response.data)
        self.assertEqual(
            Report.objects.get(pk=response.data["report_id"]).reporter_id,
            self.user.pk,
        )
        self.assertEqual(self.client.put("/api/reports/", payload, format="json").status_code, 405)

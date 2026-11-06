import hashlib

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from comments.models import Comment
from posts.models import Post, Story


class CommentApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = get_user_model().objects.create_user(
            username="commenter", email="commenter@example.test", password="test-pass"
        )
        self.post = Post.objects.create(
            author=self.author, title="Comment thread", post_type=Post.PostType.STORY
        )
        Story.objects.create(post=self.post, body="Thread body")

    def test_authenticated_replies_are_returned_nested(self):
        self.client.force_authenticate(self.author)
        response = self.client.post(
            f"/api/posts/{self.post.pk}/comments/",
            {"body": "Root comment"},
            format="json",
        )
        root = Comment.objects.get(post=self.post)
        reply = self.client.post(
            f"/api/posts/{self.post.pk}/comments/",
            {"body": "Nested reply", "parent_comment_id": root.pk},
            format="json",
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(reply.status_code, 201)
        self.assertEqual(reply.data[0]["replies"][0]["text"], "Nested reply")
        self.assertTrue(reply.data[0]["can_delete"])
        self.assertTrue(reply.data[0]["replies"][0]["can_delete"])

        root.soft_delete()
        comments = self.client.get(f"/api/posts/{self.post.pk}/comments/")
        self.assertEqual(comments.data[0]["text"], "[deleted comment]")
        self.assertEqual(comments.data[0]["replies"][0]["text"], "Nested reply")
        feed = self.client.get("/api/stories/")
        self.assertEqual(feed.data["results"][0]["comment_count"], 1)

    def test_anonymous_comment_creation_is_rejected(self):
        response = self.client.post(
            f"/api/posts/{self.post.pk}/comments/",
            {"body": "Anonymous comment"},
            format="json",
        )
        self.assertIn(response.status_code, (401, 403))

    def test_invalid_comment_data_and_cross_post_replies_are_rejected(self):
        self.client.force_authenticate(self.author)
        empty = self.client.post(
            f"/api/posts/{self.post.pk}/comments/",
            {"body": "   "},
            format="json",
        )
        self.assertEqual(empty.status_code, 400)

        other_post = Post.objects.create(
            author=self.author, title="Another thread", post_type=Post.PostType.STORY
        )
        Story.objects.create(post=other_post, body="Another body")
        parent = Comment.objects.create(
            post=other_post, author=self.author, body="Other thread parent"
        )
        cross_post_reply = self.client.post(
            f"/api/posts/{self.post.pk}/comments/",
            {"body": "Wrong thread", "parent_comment_id": parent.pk},
            format="json",
        )
        self.assertEqual(cross_post_reply.status_code, 400)

        missing_parent = self.client.post(
            f"/api/posts/{self.post.pk}/comments/",
            {"body": "Missing parent", "parent_comment_id": 999999},
            format="json",
        )
        self.assertEqual(missing_parent.status_code, 400)
        self.assertEqual(
            self.client.get("/api/posts/999999/comments/").status_code, 404
        )

    def test_only_the_comment_author_can_delete_a_comment(self):
        comment = Comment.objects.create(
            post=self.post, author=self.author, body="Keep ownership enforced"
        )
        other_user = get_user_model().objects.create_user(
            username="other-commenter", email="other-commenter@example.test"
        )
        self.assertIn(
            self.client.delete(f"/api/comments/{comment.pk}/").status_code,
            (401, 403),
        )

        self.client.force_authenticate(other_user)
        self.assertEqual(
            self.client.delete(f"/api/comments/{comment.pk}/").status_code, 403
        )
        self.assertIsNone(Comment.objects.get(pk=comment.pk).deleted_at)

        self.client.force_authenticate(self.author)
        self.assertEqual(
            self.client.delete(f"/api/comments/{comment.pk}/").status_code, 204
        )
        self.assertIsNotNone(Comment.objects.get(pk=comment.pk).deleted_at)
        self.assertEqual(
            self.client.delete("/api/comments/999999/").status_code, 404
        )

    def test_session_login_and_csrf_allow_comment_submission(self):
        password = "Session-Comment-Password-2026!"
        self.author.set_password(password)
        self.author.save(update_fields=["password"])
        client = APIClient(enforce_csrf_checks=True)
        csrf_token = client.get("/api/auth/csrf/").json()["csrfToken"]
        login_response = client.post(
            "/api/auth/login/",
            {"identifier": self.author.username, "password": password},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(login_response.status_code, 200)

        response = client.post(
            f"/api/posts/{self.post.pk}/comments/",
            {"body": "Posted with a session"},
            format="json",
            HTTP_X_CSRFTOKEN=login_response.data["csrfToken"],
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Comment.objects.get(post=self.post).author_id, self.author.pk)

    def test_comment_hashes_use_sha256_of_exact_utf8_content(self):
        body = "Identical comment content"
        first = Comment.objects.create(post=self.post, author=self.author, body=body)
        second = Comment.objects.create(post=self.post, author=self.author, body=body)
        changed_whitespace = Comment.objects.create(
            post=self.post, author=self.author, body=f"{body}\n"
        )
        changed_unicode = Comment.objects.create(
            post=self.post, author=self.author, body="café ☕"
        )

        self.assertEqual(
            first.content_hash,
            hashlib.sha256(body.encode("utf-8")).hexdigest(),
        )
        self.assertEqual(first.content_hash, second.content_hash)
        self.assertNotEqual(first.content_hash, changed_whitespace.content_hash)
        self.assertNotEqual(first.content_hash, changed_unicode.content_hash)
        self.assertEqual(len(first.content_hash), 64)

    def test_editing_comment_replaces_hash_even_with_update_fields(self):
        comment = Comment.objects.create(
            post=self.post, author=self.author, body="Before edit"
        )
        previous_hash = comment.content_hash

        comment.body = "After edit"
        comment.save(update_fields=["body"])
        comment.refresh_from_db()

        self.assertNotEqual(comment.content_hash, previous_hash)
        self.assertEqual(
            comment.content_hash,
            hashlib.sha256(b"After edit").hexdigest(),
        )

    def test_comment_creation_ignores_client_supplied_hash(self):
        self.client.force_authenticate(self.author)
        response = self.client.post(
            f"/api/posts/{self.post.pk}/comments/",
            {"body": "Created comment", "content_hash": "0" * 64},
            format="json",
        )

        self.assertEqual(response.status_code, 201)
        comment = Comment.objects.get(post=self.post)
        self.assertEqual(
            comment.content_hash,
            hashlib.sha256(b"Created comment").hexdigest(),
        )
        self.assertNotIn("content_hash", response.data[0])

    def test_api_cannot_modify_a_comment_hash_directly(self):
        self.client.force_authenticate(self.author)
        comment = Comment.objects.create(
            post=self.post, author=self.author, body="Protected content"
        )
        original_hash = comment.content_hash

        response = self.client.put(
            f"/api/comments/{comment.pk}/",
            {"body": "Changed content", "content_hash": "0" * 64},
            format="json",
        )

        self.assertEqual(response.status_code, 405)
        comment.refresh_from_db()
        self.assertEqual(comment.body, "Protected content")
        self.assertEqual(comment.content_hash, original_hash)

    def test_authenticated_user_can_verify_comment_integrity(self):
        comment = Comment.objects.create(
            post=self.post, author=self.author, body="Unchanged comment"
        )
        self.client.force_authenticate(self.author)

        response = self.client.get(f"/api/comments/{comment.pk}/verify/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"valid": True})
        self.assertNotIn("content_hash", response.data)

    def test_verification_fails_without_repairing_content_or_hash(self):
        comment = Comment.objects.create(
            post=self.post, author=self.author, body="Stored content"
        )
        Comment.objects.filter(pk=comment.pk).update(body="Altered content")
        stored_hash = comment.content_hash
        self.client.force_authenticate(self.author)

        response = self.client.get(f"/api/comments/{comment.pk}/verify/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"valid": False})
        comment.refresh_from_db()
        self.assertEqual(comment.body, "Altered content")
        self.assertEqual(comment.content_hash, stored_hash)

    def test_verification_rejects_missing_or_malformed_hashes(self):
        comment = Comment.objects.create(
            post=self.post, author=self.author, body="Hash field test"
        )
        self.client.force_authenticate(self.author)

        for invalid_hash in ("", "not-a-hash", "f" * 63, "g" * 64):
            with self.subTest(invalid_hash=invalid_hash):
                Comment.objects.filter(pk=comment.pk).update(
                    content_hash=invalid_hash
                )
                response = self.client.get(f"/api/comments/{comment.pk}/verify/")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data, {"valid": False})
                self.assertEqual(
                    Comment.objects.get(pk=comment.pk).content_hash,
                    invalid_hash,
                )

    def test_verification_requires_authentication_and_hides_missing_comments(self):
        comment = Comment.objects.create(
            post=self.post, author=self.author, body="Private access test"
        )

        unauthorized = self.client.get(f"/api/comments/{comment.pk}/verify/")
        self.assertIn(unauthorized.status_code, (401, 403))

        self.client.force_authenticate(self.author)
        self.assertEqual(
            self.client.get("/api/comments/999999/verify/").status_code,
            404,
        )
        self.assertEqual(
            self.client.get(f"/api/comments/{comment.pk}/verify/invalid/").status_code,
            404,
        )
        comment.soft_delete()
        self.assertEqual(
            self.client.get(f"/api/comments/{comment.pk}/verify/").status_code,
            404,
        )

from django.contrib.auth import get_user_model
import tempfile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from posts.models import Post, Roadmap, Story, StoryRoadmap


class PostApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.author = get_user_model().objects.create_user(
            username="author", email="author@example.test", password="test-pass"
        )
        roadmap_post = Post.objects.create(
            author=self.author, title="Test roadmap", post_type=Post.PostType.ROADMAP
        )
        self.roadmap = Roadmap.objects.create(post=roadmap_post, description="Description")

        story_post = Post.objects.create(
            author=self.author, title="Related story", post_type=Post.PostType.STORY
        )
        story = Story.objects.create(post=story_post, body="Story body")
        StoryRoadmap.objects.create(story=story, roadmap=self.roadmap)
        independent_post = Post.objects.create(
            author=self.author, title="Independent story", post_type=Post.PostType.STORY
        )
        Story.objects.create(post=independent_post, body="Independent body")

    def test_health_endpoint_checks_database_without_disclosing_its_name(self):
        response = self.client.get("/api/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_public_feed_and_story_filters(self):
        roadmap_response = self.client.get("/api/roadmaps/")
        self.assertEqual(roadmap_response.status_code, 200)
        self.assertEqual(roadmap_response.data["results"][0]["title"], "Test roadmap")
        self.assertIsNone(roadmap_response.data["results"][0]["preview_url"])
        self.assertEqual(
            roadmap_response.data["results"][0]["graph"],
            {"nodes": [], "edges": []},
        )
        self.assertEqual(
            self.client.get(f"/api/roadmaps/{self.roadmap.pk}/").status_code, 200
        )

        related = self.client.get(f"/api/stories/?roadmap={self.roadmap.pk}")
        independent = self.client.get("/api/stories/?roadmap=independent")
        self.assertEqual([row["title"] for row in related.data["results"]], ["Related story"])
        self.assertEqual([row["title"] for row in independent.data["results"]], ["Independent story"])
        related_id = related.data["results"][0]["id"]
        self.assertEqual(self.client.get(f"/api/stories/{related_id}/").status_code, 200)

    def test_post_update_and_delete_are_limited_to_the_author(self):
        post_id = self.roadmap.pk
        payload = {
            "type": "roadmap",
            "title": "Updated roadmap",
            "description": "Updated description",
            "graph": {"nodes": [], "edges": []},
            "storyline": "Updated storyline",
        }
        other_user = get_user_model().objects.create_user(
            username="another", email="another@example.test"
        )

        self.assertIn(
            self.client.put(f"/api/posts/{post_id}/", payload, format="json").status_code,
            (401, 403),
        )
        self.client.force_authenticate(other_user)
        self.assertEqual(
            self.client.put(f"/api/posts/{post_id}/", payload, format="json").status_code,
            403,
        )
        self.assertEqual(self.client.delete(f"/api/posts/{post_id}/").status_code, 403)

        self.client.force_authenticate(self.author)
        updated = self.client.put(
            f"/api/posts/{post_id}/", payload, format="json"
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.data["title"], "Updated roadmap")
        self.roadmap.refresh_from_db()
        self.assertEqual(self.roadmap.description, "Updated description")

        self.assertEqual(self.client.delete(f"/api/posts/{post_id}/").status_code, 204)
        self.assertFalse(Post.objects.filter(pk=post_id).exists())

    def test_post_validation_and_nonexistent_ids(self):
        self.client.force_authenticate(self.author)
        missing_fields = self.client.post(
            "/api/posts/create/", {"type": "story"}, format="json"
        )
        self.assertEqual(missing_fields.status_code, 400)
        self.assertIn("title", missing_fields.data)

        invalid_type = self.client.post(
            "/api/posts/create/",
            {"type": "unknown", "title": "Invalid"},
            format="json",
        )
        self.assertEqual(invalid_type.status_code, 400)
        self.assertEqual(self.client.get("/api/posts/999999/").status_code, 404)
        self.assertEqual(self.client.get("/api/roadmaps/999999/").status_code, 404)
        self.assertEqual(self.client.get("/api/stories/999999/").status_code, 404)

    def test_feed_pagination_uses_the_configured_page_size(self):
        for index in range(19):
            post = Post.objects.create(
                author=self.author,
                title=f"Paged story {index}",
                post_type=Post.PostType.STORY,
            )
            Story.objects.create(post=post, body=f"Body {index}")

        first_page = self.client.get("/api/stories/")
        second_page = self.client.get("/api/stories/?page=2")
        self.assertEqual(first_page.status_code, 200)
        self.assertEqual(len(first_page.data["results"]), 20)
        self.assertIsNotNone(first_page.data["next"])
        self.assertEqual(len(second_page.data["results"]), 1)
        self.assertIsNone(second_page.data["next"])

    def test_post_creation_requires_authentication(self):
        payload = {
            "type": "story",
            "title": "New story",
            "description": "A brief summary",
            "content": "New body",
        }
        self.assertIn(self.client.post("/api/posts/create/", payload).status_code, (401, 403))

        self.client.force_authenticate(self.author)
        response = self.client.post("/api/posts/create/", payload, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "New story")
        self.assertEqual(response.data["description"], "A brief summary")
        self.assertEqual(response.data["content"], "New body")

    def test_roadmap_creation_persists_graph_storyline_and_tags(self):
        self.client.force_authenticate(self.author)
        graph = {
            "nodes": [
                {
                    "id": f"step-{index}",
                    "type": "roadmapStep",
                    "position": {"x": index * 320, "y": (index % 2) * 180},
                    "data": {
                        "title": f"Milestone {index}",
                        "description": f"Description {index}",
                        "custom_data": {"rank": index},
                    },
                }
                for index in range(35)
            ],
            "edges": [
                {
                    "id": f"edge-{index}",
                    "source": f"step-{index}",
                    "target": f"step-{index + 1}",
                }
                for index in range(34)
            ],
        }
        preview = (
            "data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADUlEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC"
        )
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            response = self.client.post(
                "/api/posts/create/",
                {
                    "type": "roadmap",
                    "title": "Product roadmap",
                    "description": "A short summary",
                    "graph": graph,
                    "storyline": "Why this roadmap matters",
                    "preview": preview,
                    "tags": ["product", "Planning"],
                },
                format="json",
            )

            self.assertEqual(response.status_code, 201)
            self.assertEqual(response.data["graph"], graph)
            self.assertEqual(response.data["storyline"], "Why this roadmap matters")
            self.assertEqual(response.data["description"], "A short summary")
            self.assertCountEqual(response.data["tags"], ["product", "Planning"])
            self.assertIn("/media/roadmap_previews/", response.data["preview_url"])
            roadmap = Roadmap.objects.get(pk=response.data["id"])
            self.assertTrue(roadmap.preview.storage.exists(roadmap.preview.name))

            feed = self.client.get("/api/roadmaps/")
            self.assertEqual(feed.data["results"][0]["graph"], graph)
            self.assertEqual(feed.data["results"][0]["preview_url"], response.data["preview_url"])

    def test_roadmap_rejects_invalid_preview_data(self):
        self.client.force_authenticate(self.author)
        response = self.client.post(
            "/api/posts/create/",
            {
                "type": "roadmap",
                "title": "Invalid preview",
                "description": "Description",
                "graph": {"nodes": [], "edges": []},
                "preview": "data:image/png;base64,not an image",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("preview", response.data)

    def test_likes_require_authentication_and_are_idempotent(self):
        post_id = self.roadmap.pk
        self.assertIn(self.client.post(f"/api/posts/{post_id}/like/").status_code, (401, 403))
        other_user = get_user_model().objects.create_user(
            username="reader", email="reader@example.test", password=None
        )
        self.client.force_authenticate(self.author)
        self.assertEqual(self.client.post(f"/api/posts/{post_id}/like/").data["like_count"], 1)
        self.assertEqual(self.client.post(f"/api/posts/{post_id}/like/").data["like_count"], 1)
        feed = self.client.get("/api/roadmaps/")
        self.assertTrue(feed.data["results"][0]["liked_by_user"])
        self.client.force_authenticate(other_user)
        self.assertFalse(self.client.get("/api/roadmaps/").data["results"][0]["liked_by_user"])
        self.client.force_authenticate(self.author)
        self.assertEqual(self.client.delete(f"/api/posts/{post_id}/like/").data["like_count"], 0)
        feed = self.client.get("/api/roadmaps/")
        self.assertFalse(feed.data["results"][0]["liked_by_user"])

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from notifications.models import Notification


class NotificationApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.recipient = get_user_model().objects.create_user(
            username="notification-owner", email="notification-owner@example.test"
        )
        self.other_user = get_user_model().objects.create_user(
            username="notification-other", email="notification-other@example.test"
        )

    def test_notifications_require_authentication_and_are_recipient_scoped(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.other_user,
            event_type=Notification.EventType.FOLLOW,
        )

        self.assertIn(self.client.get("/api/notifications/").status_code, (401, 403))

        self.client.force_authenticate(self.other_user)
        self.assertEqual(self.client.get("/api/notifications/").data["count"], 0)

        self.client.force_authenticate(self.recipient)
        response = self.client.get("/api/notifications/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0]["notification_id"], notification.pk
        )
        self.assertNotIn("recipient", response.data["results"][0])

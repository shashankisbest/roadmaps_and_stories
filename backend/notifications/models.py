from django.conf import settings
from django.db import models


class Notification(models.Model):
    class EventType(models.TextChoices):
        FOLLOW = "follow", "Follow"
        COMMENT = "comment", "Comment"
        REPLY = "reply", "Reply"
        LIKE = "like", "Like"

    notification_id = models.BigAutoField(primary_key=True)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="triggered_notifications",
    )
    event_type = models.CharField(max_length=20, choices=EventType.choices)
    post = models.ForeignKey(
        "posts.Post",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )
    comment = models.ForeignKey(
        "comments.Comment",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="notifications",
    )
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "notifications"
        indexes = [
            models.Index(
                fields=["recipient", "is_read", "created_at"], name="ix_notif_rec_read_date"
            )
        ]

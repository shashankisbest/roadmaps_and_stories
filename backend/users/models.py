from django.conf import settings
from django.db import models


class Profile(models.Model):
    account = models.OneToOneField(
        settings.AUTH_USER_MODEL, primary_key=True, on_delete=models.CASCADE, related_name="profile"
    )
    display_name = models.CharField(max_length=100)
    profile_photo_key = models.CharField(max_length=500, null=True, blank=True)
    bio = models.TextField(blank=True)


class Follow(models.Model):
    follower = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following_edges"
    )
    followed = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="follower_edges"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "followed"], name="uq_follow_pair"),
            models.CheckConstraint(
                condition=~models.Q(follower=models.F("followed")),
                name="ck_follow_not_self",
            ),
        ]
        indexes = [models.Index(fields=["followed"], name="ix_follow_followed")]

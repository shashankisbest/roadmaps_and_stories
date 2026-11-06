import hashlib
import hmac

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone


def hash_comment_content(content):
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class Comment(models.Model):
    comment_id = models.BigAutoField(primary_key=True)
    post = models.ForeignKey("posts.Post", on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="comments",
    )
    parent_comment = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="replies",
    )
    body = models.TextField()
    content_hash = models.CharField(max_length=64, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "comments"
        indexes = [
            models.Index(fields=["post", "created_at"], name="ix_comment_post_date"),
            models.Index(fields=["parent_comment"], name="ix_comment_parent"),
        ]

    @property
    def is_deleted(self):
        return self.deleted_at is not None

    def clean(self):
        super().clean()
        if self.parent_comment_id and self.parent_comment.post_id != self.post_id:
            raise ValidationError("A reply must belong to the same post as its parent.")

    def save(self, *args, **kwargs):
        update_fields = kwargs.get("update_fields")
        if update_fields is not None:
            update_fields = set(update_fields)
            if update_fields.intersection({"body", "content_hash"}):
                self.content_hash = hash_comment_content(self.body)
                update_fields.add("content_hash")
            kwargs["update_fields"] = update_fields
        else:
            self.content_hash = hash_comment_content(self.body)
        super().save(*args, **kwargs)

    def verify_content_hash(self):
        stored_hash = self.content_hash
        if (
            not isinstance(stored_hash, str)
            or len(stored_hash) != 64
            or any(character not in "0123456789abcdef" for character in stored_hash)
        ):
            return False
        return hmac.compare_digest(
            hash_comment_content(self.body),
            stored_hash,
        )

    def soft_delete(self):
        self.deleted_at = timezone.now()
        self.save(update_fields=["deleted_at", "updated_at"])

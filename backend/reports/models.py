from django.conf import settings
from django.db import models
from django.db.models import Q


class Report(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        REVIEWING = "reviewing", "Reviewing"
        RESOLVED = "resolved", "Resolved"
        REJECTED = "rejected", "Rejected"

    report_id = models.BigAutoField(primary_key=True)
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="submitted_reports",
    )
    target_post = models.ForeignKey(
        "posts.Post",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    target_comment = models.ForeignKey(
        "comments.Comment",
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="reports",
    )
    target_account = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.CASCADE,
        related_name="reports_against",
    )
    reason = models.CharField(max_length=80)
    details = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "reports"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(target_post__isnull=False, target_comment__isnull=True, target_account__isnull=True)
                    | Q(target_post__isnull=True, target_comment__isnull=False, target_account__isnull=True)
                    | Q(target_post__isnull=True, target_comment__isnull=True, target_account__isnull=False)
                ),
                name="ck_report_exactly_one_target",
            )
        ]
        indexes = [
            models.Index(fields=["status", "created_at"], name="ix_report_status_date"),
            models.Index(fields=["reporter"], name="ix_report_reporter"),
        ]

from rest_framework import generics, permissions, serializers
from django.contrib.auth import get_user_model

from comments.models import Comment
from posts.models import Post
from reports.models import Report

Account = get_user_model()


class ReportSerializer(serializers.ModelSerializer):
    target_post_id = serializers.PrimaryKeyRelatedField(
        source="target_post", queryset=Post.objects.all(), required=False, allow_null=True
    )
    target_comment_id = serializers.PrimaryKeyRelatedField(
        source="target_comment", queryset=Comment.objects.all(), required=False, allow_null=True
    )
    target_account_id = serializers.PrimaryKeyRelatedField(
        source="target_account", queryset=Account.objects.all(), required=False, allow_null=True
    )

    class Meta:
        model = Report
        fields = [
            "report_id", "target_post_id", "target_comment_id", "target_account_id",
            "reason", "details", "status", "created_at",
        ]
        read_only_fields = ["report_id", "status", "created_at"]

    def validate(self, attrs):
        targets = [
            attrs.get("target_post"),
            attrs.get("target_comment"),
            attrs.get("target_account"),
        ]
        if sum(value is not None for value in targets) != 1:
            raise serializers.ValidationError("Provide exactly one report target.")
        return attrs


class ReportCreateView(generics.CreateAPIView):
    serializer_class = ReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        serializer.save(reporter=self.request.user)

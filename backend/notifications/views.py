from rest_framework import generics, permissions, serializers

from notifications.models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()
    post_id = serializers.IntegerField(read_only=True)
    comment_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Notification
        fields = ["notification_id", "event_type", "actor", "post_id", "comment_id", "is_read", "created_at"]

    def get_actor(self, obj):
        if not obj.actor_id:
            return None
        profile = getattr(obj.actor, "profile", None)
        return {
            "username": obj.actor.username,
            "name": profile.display_name if profile else (obj.actor.get_full_name() or obj.actor.username),
        }


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(recipient=self.request.user).select_related(
            "actor", "actor__profile"
        ).order_by("-created_at")

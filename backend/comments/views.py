from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from comments.models import Comment
from notifications.models import Notification
from posts.models import Post


class CommentCreateSerializer(serializers.Serializer):
    body = serializers.CharField()
    parent_comment_id = serializers.PrimaryKeyRelatedField(
        source="parent_comment",
        queryset=Comment.objects.all(),
        required=False,
        allow_null=True,
    )

    def validate(self, attrs):
        parent = attrs.get("parent_comment")
        if parent and parent.post_id != self.context["post"].post_id:
            raise serializers.ValidationError(
                {"parent_comment_id": "The parent comment belongs to another post."}
            )
        return attrs


def comment_tree(post_id, user=None):
    comments = list(
        Comment.objects.filter(post_id=post_id)
        .select_related("author", "author__profile")
        .order_by("created_at", "comment_id")
    )
    nodes = {}
    for comment in comments:
        deleted = comment.is_deleted
        profile = getattr(comment.author, "profile", None) if comment.author_id else None
        node = {
            "id": comment.comment_id,
            "author": (
                profile.display_name if profile else comment.author.username
            ) if comment.author_id else "Deleted account",
            "time": comment.created_at.isoformat(),
            "text": "[deleted comment]" if deleted else comment.body,
            "is_deleted": deleted,
            "can_delete": bool(
                user and user.is_authenticated and comment.author_id == user.pk
            ),
            "replies": [],
        }
        nodes[comment.comment_id] = node
    roots = []
    for comment in comments:
        node = nodes[comment.comment_id]
        if comment.parent_comment_id in nodes:
            nodes[comment.parent_comment_id]["replies"].append(node)
        else:
            roots.append(node)
    return roots


class PostCommentsView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, post_id):
        get_object_or_404(Post, post_id=post_id, visibility="public")
        return Response(comment_tree(post_id, request.user))

    def post(self, request, post_id):
        if not request.user.is_authenticated:
            return Response(status=status.HTTP_401_UNAUTHORIZED)
        post = get_object_or_404(Post, post_id=post_id, visibility="public")
        serializer = CommentCreateSerializer(
            data=request.data, context={"post": post}
        )
        serializer.is_valid(raise_exception=True)
        body = serializer.validated_data["body"].strip()
        parent = serializer.validated_data.get("parent_comment")
        comment = Comment.objects.create(
            post=post, author=request.user, parent_comment=parent, body=body
        )
        if post.author_id and post.author_id != request.user.id:
            Notification.objects.create(
                recipient=post.author,
                actor=request.user,
                event_type=Notification.EventType.REPLY if parent else Notification.EventType.COMMENT,
                post=post,
                comment=comment,
            )
        if (
            parent
            and parent.author_id
            and parent.author_id != request.user.id
            and parent.author_id != post.author_id
        ):
            Notification.objects.create(
                recipient=parent.author,
                actor=request.user,
                event_type=Notification.EventType.REPLY,
                post=post,
                comment=comment,
            )
        return Response(
            comment_tree(post_id, request.user),
            status=status.HTTP_201_CREATED,
        )


class CommentDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, comment_id):
        comment = get_object_or_404(Comment, comment_id=comment_id)
        if comment.author_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        comment.soft_delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommentIntegrityView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, comment_id):
        comment = get_object_or_404(
            Comment.objects.filter(
                post__visibility="public",
                deleted_at__isnull=True,
            ),
            comment_id=comment_id,
        )
        return Response({"valid": comment.verify_content_hash()})

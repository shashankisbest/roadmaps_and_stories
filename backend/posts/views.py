from django.db.models import BooleanField, Count, Exists, OuterRef, Prefetch, Q, Value
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.models import Notification
from posts.models import Like, Post, PostTag
from posts.serializers import PostSerializer, PostWriteSerializer


def public_posts(post_type=None, user=None):
    liked_by_user = (
        Exists(Like.objects.filter(post_id=OuterRef("post_id"), account_id=user.pk))
        if user is not None and user.is_authenticated
        else Value(False, output_field=BooleanField())
    )
    queryset = Post.objects.filter(visibility="public").select_related(
        "author", "author__profile", "roadmap", "story",
        "story__roadmap_link__roadmap__post",
    ).prefetch_related(
        Prefetch("post_tags", queryset=PostTag.objects.select_related("tag")),
    ).annotate(
        like_count=Count("likes", distinct=True),
        comment_count=Count(
            "comments",
            filter=Q(comments__deleted_at__isnull=True),
            distinct=True,
        ),
        author_followers_count=Count("author__follower_edges", distinct=True),
        author_following_count=Count("author__following_edges", distinct=True),
        liked_by_user=liked_by_user,
    )
    if post_type:
        queryset = queryset.filter(post_type=post_type)
    return queryset.order_by("-created_at", "-post_id")


class PostListView(generics.ListAPIView):
    serializer_class = PostSerializer
    permission_classes = [permissions.AllowAny]
    post_type = None

    def get_queryset(self):
        post_type = self.post_type or self.request.query_params.get("type")
        if post_type not in (None, Post.PostType.ROADMAP, Post.PostType.STORY):
            return Post.objects.none()
        queryset = public_posts(post_type, self.request.user)
        roadmap_id = self.request.query_params.get("roadmap")
        if roadmap_id == "independent":
            queryset = queryset.filter(post_type=Post.PostType.STORY).exclude(
                story__roadmap_link__isnull=False
            )
        elif roadmap_id:
            queryset = queryset.filter(story__roadmap_link__roadmap_id=roadmap_id)
        return queryset


class RoadmapListView(PostListView):
    post_type = Post.PostType.ROADMAP


class StoryListView(PostListView):
    post_type = Post.PostType.STORY


class PostCreateView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = PostWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        post = serializer.save_post(author=request.user)
        return Response(
            PostSerializer(
                public_posts(user=request.user).get(post_id=post.post_id),
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class PostDetailView(APIView):
    permission_classes = [permissions.AllowAny]
    post_type = None

    def get_object(self, post_id, user=None):
        return get_object_or_404(
            public_posts(self.post_type, user) if self.post_type else public_posts(user=user),
            post_id=post_id,
        )

    def get(self, request, post_id):
        return Response(
            PostSerializer(
                self.get_object(post_id, request.user),
                context={"request": request},
            ).data
        )

    def put(self, request, post_id):
        post = self.get_object(post_id, request.user)
        if not request.user.is_authenticated or post.author_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        serializer = PostWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if serializer.validated_data["type"] != post.post_type:
            return Response(
                {"type": "A post's type cannot be changed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        updated = serializer.save_post(author=request.user, post=post)
        return Response(
            PostSerializer(
                public_posts(user=request.user).get(post_id=updated.post_id),
                context={"request": request},
            ).data
        )

    def delete(self, request, post_id):
        post = self.get_object(post_id, request.user)
        if not request.user.is_authenticated or post.author_id != request.user.id:
            return Response(status=status.HTTP_403_FORBIDDEN)
        post.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class RoadmapDetailView(PostDetailView):
    post_type = Post.PostType.ROADMAP


class StoryDetailView(PostDetailView):
    post_type = Post.PostType.STORY


class LikeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, post_id):
        post = get_object_or_404(public_posts(user=request.user), post_id=post_id)
        _, created = Like.objects.get_or_create(account=request.user, post=post)
        if created and post.author_id and post.author_id != request.user.id:
            Notification.objects.create(
                recipient=post.author,
                actor=request.user,
                event_type=Notification.EventType.LIKE,
                post=post,
            )
        return Response({"liked": True, "like_count": post.likes.count()})

    def delete(self, request, post_id):
        post = get_object_or_404(public_posts(user=request.user), post_id=post_id)
        Like.objects.filter(account=request.user, post=post).delete()
        return Response({"liked": False, "like_count": post.likes.count()})

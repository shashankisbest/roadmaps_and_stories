import base64
import binascii

from django.core.files.base import ContentFile
from rest_framework import serializers

from posts.models import Like, Post, Tag


class PostSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(source="post_id", read_only=True)
    type = serializers.CharField(source="post_type", read_only=True)
    author = serializers.SerializerMethodField()
    author_profile = serializers.SerializerMethodField()
    date = serializers.DateTimeField(source="created_at", read_only=True)
    description = serializers.SerializerMethodField()
    content = serializers.SerializerMethodField()
    graph = serializers.SerializerMethodField()
    storyline = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    roadmap_id = serializers.SerializerMethodField()
    roadmap = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True, default=0)
    comment_count = serializers.IntegerField(read_only=True, default=0)
    liked_by_user = serializers.SerializerMethodField()

    class Meta:
        model = Post
        fields = [
            "id", "type", "title", "author", "author_profile", "date",
            "description", "content", "graph", "storyline", "preview_url", "tags",
            "roadmap_id", "roadmap", "like_count", "comment_count", "liked_by_user",
        ]

    def get_author(self, obj):
        if obj.author_id is None:
            return "Deleted account"
        profile = getattr(obj.author, "profile", None)
        return profile.display_name if profile else (obj.author.get_full_name() or obj.author.username)

    def get_author_profile(self, obj):
        if obj.author_id is None:
            return None
        profile = getattr(obj.author, "profile", None)
        return {
            "username": obj.author.username,
            "name": profile.display_name if profile else (obj.author.get_full_name() or obj.author.username),
            "bio": profile.bio if profile else "",
            "profile_image": profile.profile_photo_key if profile else None,
            "followers": obj.author_followers_count
            if hasattr(obj, "author_followers_count")
            else obj.author.follower_edges.count(),
            "following": obj.author_following_count
            if hasattr(obj, "author_following_count")
            else obj.author.following_edges.count(),
        }

    def get_description(self, obj):
        roadmap = getattr(obj, "roadmap", None)
        return roadmap.description if roadmap else obj.summary

    def get_content(self, obj):
        story = getattr(obj, "story", None)
        return story.body if story else ""

    def get_graph(self, obj):
        roadmap = getattr(obj, "roadmap", None)
        if roadmap is None:
            return None
        return {
            **roadmap.graph,
            "nodes": roadmap.graph.get("nodes", []),
            "edges": roadmap.graph.get("edges", []),
        }

    def get_storyline(self, obj):
        roadmap = getattr(obj, "roadmap", None)
        return roadmap.storyline if roadmap else ""

    def get_preview_url(self, obj):
        roadmap = getattr(obj, "roadmap", None)
        if roadmap is None or not roadmap.preview:
            return None
        url = roadmap.preview.url
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_liked_by_user(self, obj):
        return bool(getattr(obj, "liked_by_user", False))

    def get_tags(self, obj):
        return [post_tag.tag.name for post_tag in obj.post_tags.all()]

    def get_roadmap_id(self, obj):
        if obj.post_type != Post.PostType.STORY:
            return None
        story = getattr(obj, "story", None)
        link = getattr(story, "roadmap_link", None) if story else None
        return link.roadmap_id if link else None

    def get_roadmap(self, obj):
        roadmap_id = self.get_roadmap_id(obj)
        if roadmap_id is None:
            return None
        roadmap = obj.story.roadmap_link.roadmap
        return {"id": roadmap.post_id, "title": roadmap.post.title}


class PostWriteSerializer(serializers.Serializer):
    MAX_PREVIEW_BYTES = 3 * 1024 * 1024
    type = serializers.ChoiceField(choices=Post.PostType.choices)
    title = serializers.CharField(max_length=250)
    description = serializers.CharField(required=False, allow_blank=True)
    content = serializers.CharField(required=False, allow_blank=True)
    graph = serializers.JSONField(required=False)
    storyline = serializers.CharField(required=False, allow_blank=True)
    preview = serializers.CharField(
        required=False, allow_blank=True, max_length=4_200_000, write_only=True
    )
    tags = serializers.ListField(
        child=serializers.CharField(max_length=80), required=False, allow_empty=True
    )
    roadmap_id = serializers.IntegerField(required=False, allow_null=True)

    def validate(self, attrs):
        from posts.models import Roadmap

        post_type = attrs["type"]
        graph = attrs.get("graph")
        if graph is not None and (
            not isinstance(graph, dict)
            or not {"nodes", "edges"}.issubset(graph)
            or not isinstance(graph.get("nodes"), list)
            or not isinstance(graph.get("edges"), list)
        ):
            raise serializers.ValidationError(
                {"graph": "Graph must contain node and edge lists."}
            )
        preview = attrs.get("preview")
        if preview:
            if post_type != Post.PostType.ROADMAP:
                raise serializers.ValidationError(
                    {"preview": "Only roadmap posts can include a graph preview."}
                )
            prefix = "data:image/png;base64,"
            if not preview.startswith(prefix):
                raise serializers.ValidationError(
                    {"preview": "Preview must be a base64-encoded PNG image."}
                )
            try:
                preview_bytes = base64.b64decode(
                    preview[len(prefix):], validate=True
                )
            except (binascii.Error, ValueError) as error:
                raise serializers.ValidationError(
                    {"preview": "Preview contains invalid base64 data."}
                ) from error
            if (
                len(preview_bytes) > self.MAX_PREVIEW_BYTES
                or len(preview_bytes) < 24
                or not preview_bytes.startswith(b"\x89PNG\r\n\x1a\n")
            ):
                raise serializers.ValidationError(
                    {"preview": "Preview must be a valid PNG no larger than 3 MB."}
                )
            width = int.from_bytes(preview_bytes[16:20], "big")
            height = int.from_bytes(preview_bytes[20:24], "big")
            if not (0 < width <= 2000 and 0 < height <= 1200):
                raise serializers.ValidationError(
                    {"preview": "Preview dimensions must not exceed 2000 by 1200 pixels."}
                )
            attrs["_preview_bytes"] = preview_bytes
        if post_type == Post.PostType.ROADMAP and not attrs.get("description", "").strip():
            raise serializers.ValidationError({"description": "A roadmap description is required."})
        if post_type == Post.PostType.STORY and not attrs.get("content", "").strip():
            raise serializers.ValidationError({"content": "Story content is required."})
        roadmap_id = attrs.get("roadmap_id")
        if post_type == Post.PostType.ROADMAP and roadmap_id is not None:
            raise serializers.ValidationError({"roadmap_id": "Only stories can be linked to a roadmap."})
        if roadmap_id is not None and not Roadmap.objects.filter(post_id=roadmap_id).exists():
            raise serializers.ValidationError({"roadmap_id": "The selected roadmap does not exist."})
        return attrs

    def save_post(self, *, author, post=None):
        from django.db import transaction
        from django.utils.text import slugify
        from posts.models import PostTag, Roadmap, Story, StoryRoadmap

        attrs = self.validated_data
        with transaction.atomic():
            if post is None:
                post = Post.objects.create(
                    author=author,
                    title=attrs["title"],
                    summary=attrs.get("description", ""),
                    post_type=attrs["type"],
                )
            else:
                post.title = attrs["title"]
                post.summary = attrs.get("description", "")
                post.save(update_fields=["title", "summary", "updated_at"])

            if attrs["type"] == Post.PostType.ROADMAP:
                roadmap, _ = Roadmap.objects.update_or_create(
                    post=post,
                    defaults={
                        "description": attrs.get("description", ""),
                        "graph": attrs.get("graph", {"nodes": [], "edges": []}),
                        "storyline": attrs.get("storyline", ""),
                    },
                )
                preview_bytes = attrs.get("_preview_bytes")
                if preview_bytes:
                    roadmap.preview.save(
                        f"roadmap-{post.post_id}.png",
                        ContentFile(preview_bytes),
                        save=True,
                    )
                Story.objects.filter(post=post).delete()
            else:
                Story.objects.update_or_create(
                    post=post, defaults={"body": attrs.get("content", "")}
                )
                Roadmap.objects.filter(post=post).delete()
                roadmap_id = attrs.get("roadmap_id")
                if roadmap_id is not None:
                    StoryRoadmap.objects.update_or_create(
                        story_id=post.post_id, defaults={"roadmap_id": roadmap_id}
                    )
                else:
                    StoryRoadmap.objects.filter(story_id=post.post_id).delete()

            if attrs.get("type") == Post.PostType.ROADMAP:
                StoryRoadmap.objects.filter(story_id=post.post_id).delete()
            PostTag.objects.filter(post=post).delete()
            names = {
                name.strip().casefold(): name.strip()
                for name in attrs.get("tags", [])
                if name.strip()
            }
            for name in names.values():
                tag = Tag.objects.filter(name__iexact=name).first()
                if tag is None:
                    base_slug = slugify(name) or "tag"
                    slug = base_slug
                    suffix = 2
                    while Tag.objects.filter(slug=slug).exists():
                        slug = f"{base_slug}-{suffix}"
                        suffix += 1
                    tag = Tag.objects.create(name=name, slug=slug)
                PostTag.objects.get_or_create(post=post, tag=tag)
        return post

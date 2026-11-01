from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


class Post(models.Model):
    class PostType(models.TextChoices):
        ROADMAP = "roadmap", "Roadmap"
        STORY = "story", "Story"

    post_id = models.BigAutoField(primary_key=True)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="posts",
    )
    title = models.CharField(max_length=250)
    summary = models.TextField(blank=True)
    post_type = models.CharField(max_length=20, choices=PostType.choices)
    visibility = models.CharField(max_length=20, default="public", editable=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "posts"
        constraints = [
            models.CheckConstraint(condition=Q(visibility="public"), name="ck_post_public_v1"),
            models.CheckConstraint(condition=~Q(title=""), name="ck_post_title_nonempty"),
        ]
        indexes = [
            models.Index(fields=["created_at", "post_id"], name="ix_post_created_id"),
            models.Index(fields=["author", "created_at"], name="ix_post_author_date"),
            models.Index(fields=["post_type", "created_at"], name="ix_post_type_date"),
        ]

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.pk and self.post_type == self.PostType.ROADMAP and hasattr(self, "story"):
            raise ValidationError("Roadmap posts cannot have a story subtype.")
        if self.pk and self.post_type == self.PostType.STORY and hasattr(self, "roadmap"):
            raise ValidationError("Story posts cannot have a roadmap subtype.")


class Roadmap(models.Model):
    class Format(models.TextChoices):
        IMAGE = "image", "Image"

    post = models.OneToOneField(
        Post, primary_key=True, on_delete=models.CASCADE, related_name="roadmap"
    )
    image_key = models.CharField(max_length=500, null=True, blank=True)
    description = models.TextField()
    graph = models.JSONField(default=dict, blank=True)
    storyline = models.TextField(blank=True)
    preview = models.FileField(upload_to="roadmap_previews/", blank=True, null=True)
    format = models.CharField(max_length=20, choices=Format.choices, default=Format.IMAGE)

    class Meta:
        db_table = "roadmaps"

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.post_id and self.post.post_type != Post.PostType.ROADMAP:
            raise ValidationError("Roadmap subtype requires post_type='roadmap'.")


class Story(models.Model):
    post = models.OneToOneField(
        Post, primary_key=True, on_delete=models.CASCADE, related_name="story"
    )
    body = models.TextField()

    class Meta:
        db_table = "stories"

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def clean(self):
        super().clean()
        if self.post_id and self.post.post_type != Post.PostType.STORY:
            raise ValidationError("Story subtype requires post_type='story'.")


class Tag(models.Model):
    tag_id = models.BigAutoField(primary_key=True)
    name = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=90, unique=True)

    class Meta:
        db_table = "tags"
        ordering = ["name"]


class PostTag(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="post_tags")
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE, related_name="tagged_posts")

    class Meta:
        db_table = "post_tags"
        constraints = [
            models.UniqueConstraint(fields=["post", "tag"], name="uq_post_tag_pair")
        ]
        indexes = [models.Index(fields=["tag"], name="ix_post_tag_tag")]


class StoryRoadmap(models.Model):
    story = models.OneToOneField(
        Story, primary_key=True, on_delete=models.CASCADE, related_name="roadmap_link"
    )
    roadmap = models.ForeignKey(
        Roadmap, on_delete=models.CASCADE, related_name="related_story_links"
    )

    class Meta:
        db_table = "story_roadmaps"
        indexes = [models.Index(fields=["roadmap"], name="ix_storyroad_roadmap")]


class Like(models.Model):
    account = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="post_likes"
    )
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "likes"
        constraints = [
            models.UniqueConstraint(fields=["account", "post"], name="uq_like_account_post")
        ]
        indexes = [models.Index(fields=["post"], name="ix_like_post")]

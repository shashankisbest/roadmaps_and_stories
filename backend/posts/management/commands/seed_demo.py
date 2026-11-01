from datetime import date, datetime, time, timezone as datetime_timezone

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils.text import slugify

from comments.models import Comment
from posts.models import Post, PostTag, Roadmap, Story, StoryRoadmap, Tag
from users.models import Profile

Account = get_user_model()


PROFILES = {
    "Shashank": ("shashank.dev", "shashank.demo@example.com",
                 "Building things, learning systems, and documenting the journey.\nReact • Django • Distributed Systems"),
    "Arjun": ("arjun.dev", "arjun.demo@example.com", "Building full-stack projects and sharing what I learn."),
    "Priya": ("priya.ai", "priya.demo@example.com", "Exploring Python, mathematics, and machine learning."),
    "Rahul": ("rahul.systems", "rahul.demo@example.com", "Learning backend engineering and system design."),
    "Sneha": ("sneha.learns", "sneha.demo@example.com", "Learning consistently, one step at a time."),
    "Meera": ("meera.demo", "meera.demo@example.com", ""),
}
ROADMAPS = [
    ("Full Stack Web Development", "Arjun", "A practical roadmap covering frontend, backend, databases and deployment.", ["React", "Django", "PostgreSQL"], "2026-10-12"),
    ("Machine Learning Roadmap", "Priya", "From Python and mathematics to machine learning projects.", ["Python", "ML", "AI"], "2026-10-10"),
    ("System Design", "Rahul", "Caching, distributed systems, databases and scalable architecture.", ["Backend", "Architecture"], "2026-10-08"),
]
STORIES = [
    ("Why I switched from Flask to Django", "Arjun", "I started with Flask because it was simple. As my project grew, Django's ORM, authentication and built-in conventions helped me move faster.", "2026-10-13", "Full Stack Web Development"),
    ("My first deployed full-stack project", "Arjun", "Getting React to communicate with Django was only half the battle. Environment variables, deployment and database configuration taught me the rest.", "2026-10-11", "Full Stack Web Development"),
    ("Learning gradient descent intuitively", "Priya", "Thinking of gradient descent as repeatedly correcting a prediction made the mathematics much easier to understand.", "2026-10-09", "Machine Learning Roadmap"),
    ("A small lesson about consistency", "Sneha", "I stopped trying to learn everything in one night. A little focused progress every day made a bigger difference.", "2026-10-07", None),
    ("What I learned building in public", "Shashank", "Sharing unfinished work helped me learn from other people and improve through feedback.", "2026-10-06", None),
]
COMMENTS = [
    ("root", None, "Meera", "Really useful roadmap! What would you recommend learning first?"),
    ("reply", "root", "Arjun", "Start with JavaScript fundamentals, then React. Don't rush into frameworks."),
    ("nested", "reply", "Meera", "Got it. I'll start with JavaScript!"),
    ("other-root", None, "Rahul", "Could you add a section about deployment?"),
]


def sample_timestamp(value):
    return datetime.combine(
        date.fromisoformat(value), time(hour=12), tzinfo=datetime_timezone.utc
    )


class Command(BaseCommand):
    help = "Create or update the Roadmaps & Stories sample content."

    @transaction.atomic
    def handle(self, *args, **kwargs):
        accounts = {}
        for display_name, (username, email, bio) in PROFILES.items():
            account = Account.objects.filter(username__iexact=username).first()
            if account is None:
                account = Account.objects.create_user(
                    username=username, email=email, first_name=display_name
                )
            profile, _ = Profile.objects.get_or_create(
                account=account, defaults={"display_name": display_name, "bio": bio}
            )
            changed_fields = []
            if profile.display_name != display_name:
                profile.display_name = display_name
                changed_fields.append("display_name")
            if profile.bio != bio:
                profile.bio = bio
                changed_fields.append("bio")
            if changed_fields:
                profile.save(update_fields=changed_fields)
            accounts[display_name] = account

        roadmaps = {}
        for title, author_name, description, tag_names, created in ROADMAPS:
            post, _ = Post.objects.update_or_create(
                author=accounts[author_name],
                title=title,
                post_type=Post.PostType.ROADMAP,
                defaults={"created_at": sample_timestamp(created), "visibility": "public"},
            )
            roadmap, _ = Roadmap.objects.update_or_create(
                post=post, defaults={"description": description, "image_key": None}
            )
            roadmaps[title] = roadmap
            desired_tags = set()
            for name in tag_names:
                tag, _ = Tag.objects.get_or_create(
                    name=name, defaults={"slug": slugify(name)}
                )
                desired_tags.add(tag.pk)
                PostTag.objects.get_or_create(post=post, tag=tag)
            PostTag.objects.filter(post=post).exclude(tag_id__in=desired_tags).delete()

        for title, author_name, body, created, roadmap_title in STORIES:
            post, _ = Post.objects.update_or_create(
                author=accounts[author_name],
                title=title,
                post_type=Post.PostType.STORY,
                defaults={"created_at": sample_timestamp(created), "visibility": "public"},
            )
            story, _ = Story.objects.update_or_create(post=post, defaults={"body": body})
            if roadmap_title:
                StoryRoadmap.objects.update_or_create(
                    story=story, defaults={"roadmap": roadmaps[roadmap_title]}
                )
            else:
                StoryRoadmap.objects.filter(story=story).delete()

        discussion_post, _ = Post.objects.get_or_create(
            author=accounts["Arjun"],
            title="Demo discussion: Getting started with JavaScript",
            post_type=Post.PostType.STORY,
            defaults={"visibility": "public"},
        )
        Story.objects.get_or_create(
            post=discussion_post,
            defaults={"body": "A separate demo post used to demonstrate nested comments."},
        )

        comments = {}
        for key, parent_key, author_name, body in COMMENTS:
            parent = comments.get(parent_key)
            comment, _ = Comment.objects.get_or_create(
                post=discussion_post,
                author=accounts[author_name],
                parent_comment=parent,
                body=body,
            )
            comments[key] = comment

        self.stdout.write(self.style.SUCCESS(
            "Demo data ready: 6 accounts, 3 roadmaps, 6 stories including the discussion post, and 4 comments."
        ))
        self.stdout.write(
            "New demo accounts have unusable passwords; existing accounts are not password-modified. "
            "No sample follows, likes, notifications, or reports were created."
        )

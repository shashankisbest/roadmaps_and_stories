from django.db.models.signals import post_save
from django.contrib.auth import get_user_model
from django.dispatch import receiver
from users.models import Profile


@receiver(post_save, sender=get_user_model())
def create_profile_for_account(sender, instance, created, **kwargs):
    if created:
        Profile.objects.get_or_create(
            account=instance,
            defaults={"display_name": instance.get_full_name().strip() or instance.username, "bio": ""},
        )

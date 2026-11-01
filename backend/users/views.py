from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.db.models import Count, Q
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie, csrf_protect
from django.shortcuts import get_object_or_404
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework.exceptions import ValidationError
from django.middleware.csrf import get_token

from notifications.models import Notification
from posts.models import Post
from posts.serializers import PostSerializer
from users.models import Follow

Account = get_user_model()


def serialize_account(account):
    profile = getattr(account, "profile", None)
    return {
        "username": account.username,
        "email": account.email,
        "name": (
            profile.display_name
            if profile
            else account.get_full_name() or account.username
        ),
        "bio": profile.bio if profile else "",
        "profile_image": profile.profile_photo_key if profile else None,
    }


class RegistrationSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150, trim_whitespace=True)
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        Account = get_user_model()
        username_field = Account._meta.get_field("username")
        try:
            for validator in username_field.validators:
                validator(value)
        except DjangoValidationError as error:
            raise serializers.ValidationError(list(error.messages)) from error
        if Account.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("This username is already taken.")
        return value

    def validate_email(self, value):
        email = value.strip().lower()
        if Account.objects.filter(email__iexact=email).exists():
            raise serializers.ValidationError("An account with this email already exists.")
        return email

    def validate(self, attrs):
        user = get_user_model()(username=attrs["username"], email=attrs["email"])
        try:
            validate_password(attrs["password"], user=user)
        except DjangoValidationError as error:
            raise ValidationError({"password": list(error.messages)}) from error
        return attrs

    def create(self, validated_data):
        return get_user_model().objects.create_user(**validated_data)


@ensure_csrf_cookie
def csrf_token(request):
    return JsonResponse({"csrfToken": get_token(request)})


class CurrentUserView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        if not request.user.is_authenticated:
            return Response({"user": None})
        return Response({"user": serialize_account(request.user)})


@method_decorator(csrf_protect, name="dispatch")
class RegistrationView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_register"

    def post(self, request):
        serializer = RegistrationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                account = serializer.save()
        except IntegrityError as error:
            raise ValidationError(
                {"detail": "An account with that username or email already exists."}
            ) from error
        login(request, account, backend="users.backends.UsernameOrEmailBackend")
        return Response(
            {"user": serialize_account(account), "csrfToken": get_token(request)},
            status=status.HTTP_201_CREATED,
        )


@method_decorator(csrf_protect, name="dispatch")
class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "auth_login"

    def post(self, request):
        if not isinstance(request.data, dict):
            return Response(
                {"detail": "Enter a username/email and password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        identifier = request.data.get("identifier", "")
        password = request.data.get("password", "")
        if not isinstance(identifier, str) or not isinstance(password, str):
            return Response(
                {"detail": "Enter a username/email and password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        account = authenticate(request, username=identifier.strip(), password=password)
        if account is None:
            return Response(
                {"detail": "Invalid username/email or password."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        login(request, account)
        return Response({"user": serialize_account(account), "csrfToken": get_token(request)})


@method_decorator(csrf_protect, name="dispatch")
class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ProfileDetailView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request, username):
        account = get_object_or_404(
            Account.objects.select_related("profile").annotate(
                followers_count=Count("follower_edges", distinct=True),
                following_count=Count("following_edges", distinct=True),
            ),
            username__iexact=username,
            is_active=True,
        )
        profile = getattr(account, "profile", None)
        posts = Post.objects.filter(author=account, visibility="public").select_related(
            "author", "author__profile", "roadmap", "story",
            "story__roadmap_link__roadmap__post",
        ).prefetch_related("post_tags__tag").annotate(
            like_count=Count("likes", distinct=True),
            comment_count=Count(
                "comments",
                filter=Q(comments__deleted_at__isnull=True),
                distinct=True,
            ),
            author_followers_count=Count("author__follower_edges", distinct=True),
            author_following_count=Count("author__following_edges", distinct=True),
        ).order_by("-created_at", "-post_id")
        return Response({
            "username": account.username,
            "name": profile.display_name if profile else (account.get_full_name() or account.username),
            "bio": profile.bio if profile else "",
            "profile_image": profile.profile_photo_key if profile else None,
            "followers": account.followers_count,
            "following": account.following_count,
            "posts": PostSerializer(posts, many=True).data,
        })


class FollowView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, username):
        followed = get_object_or_404(Account, username__iexact=username, is_active=True)
        if followed.pk == request.user.pk:
            return Response({"detail": "You cannot follow yourself."}, status=400)
        _, created = Follow.objects.get_or_create(follower=request.user, followed=followed)
        if created:
            Notification.objects.create(
                recipient=followed,
                actor=request.user,
                event_type=Notification.EventType.FOLLOW,
            )
        return Response({"following": True})

    def delete(self, request, username):
        followed = get_object_or_404(Account, username__iexact=username, is_active=True)
        Follow.objects.filter(follower=request.user, followed=followed).delete()
        return Response({"following": False})

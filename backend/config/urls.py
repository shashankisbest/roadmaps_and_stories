"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.1/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""


from django.conf import settings
from django.contrib import admin
from django.urls import path
from django.conf.urls.static import static
from django.http import JsonResponse
from django.db import connection
from django.db.utils import OperationalError
from comments.views import CommentDetailView, PostCommentsView
from notifications.views import NotificationListView
from posts.views import (
    LikeView,
    PostCreateView,
    PostDetailView,
    PostListView,
    RoadmapDetailView,
    RoadmapListView,
    StoryDetailView,
    StoryListView,
)
from reports.views import ReportCreateView
from users.views import (
    CurrentUserView,
    FollowView,
    LoginView,
    LogoutView,
    ProfileDetailView,
    RegistrationView,
    csrf_token,
)


def health_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
    except OperationalError:
        return JsonResponse({"status": "error"}, status=503)
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/health/", health_check),
    path("api/auth/csrf/", csrf_token, name="auth-csrf"),
    path("api/auth/register/", RegistrationView.as_view(), name="auth-register"),
    path("api/auth/login/", LoginView.as_view(), name="auth-login"),
    path("api/auth/current-user/", CurrentUserView.as_view(), name="auth-current-user"),
    path("api/auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("api/roadmaps/", RoadmapListView.as_view(), name="roadmap-list"),
    path("api/roadmaps/<int:post_id>/", RoadmapDetailView.as_view(), name="roadmap-detail"),
    path("api/stories/", StoryListView.as_view(), name="story-list"),
    path("api/stories/<int:post_id>/", StoryDetailView.as_view(), name="story-detail"),
    path("api/posts/", PostListView.as_view(), name="post-list"),
    path("api/posts/create/", PostCreateView.as_view(), name="post-create"),
    path("api/posts/<int:post_id>/", PostDetailView.as_view(), name="post-detail"),
    path("api/posts/<int:post_id>/comments/", PostCommentsView.as_view(), name="post-comments"),
    path("api/posts/<int:post_id>/like/", LikeView.as_view(), name="post-like"),
    path("api/comments/<int:comment_id>/", CommentDetailView.as_view(), name="comment-detail"),
    path("api/profiles/<str:username>/", ProfileDetailView.as_view(), name="profile-detail"),
    path("api/profiles/<str:username>/follow/", FollowView.as_view(), name="profile-follow"),
    path("api/notifications/", NotificationListView.as_view(), name="notification-list"),
    path("api/reports/", ReportCreateView.as_view(), name="report-create"),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

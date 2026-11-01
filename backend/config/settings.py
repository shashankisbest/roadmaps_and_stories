from pathlib import Path
import ipaddress
import os
import re
import socket

from dotenv import load_dotenv
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

DEBUG = os.getenv("DJANGO_DEBUG", "true").lower() == "true"
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY")
if not SECRET_KEY and not DEBUG:
    raise ImproperlyConfigured("DJANGO_SECRET_KEY must be configured when DEBUG is disabled.")
if not SECRET_KEY:
    SECRET_KEY = "development-only-change-me"


def _local_private_ipv4_addresses() -> set[str]:
    try:
        addresses = socket.getaddrinfo(
            socket.gethostname(),
            None,
            family=socket.AF_INET,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror:
        return set()

    return {
        address[4][0]
        for address in addresses
        if (ip := ipaddress.ip_address(address[4][0])).is_private
        and not ip.is_loopback
        and not ip.is_link_local
    }


LOCAL_PRIVATE_IPV4_ADDRESSES = _local_private_ipv4_addresses() if DEBUG else set()
configured_allowed_hosts = os.getenv("DJANGO_ALLOWED_HOSTS")
if not DEBUG and not configured_allowed_hosts:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must be configured when DEBUG is disabled.")
ALLOWED_HOSTS = [
    host.strip()
    for host in (
        configured_allowed_hosts
        or "localhost,127.0.0.1,192.168.137.1,192.168.137.56"
    ).split(",")
    if host.strip()
]
ALLOWED_HOSTS = list(dict.fromkeys([*ALLOWED_HOSTS, *LOCAL_PRIVATE_IPV4_ADDRESSES]))
if not DEBUG and not ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must not be empty when DEBUG is disabled.")
if not DEBUG and "*" in ALLOWED_HOSTS:
    raise ImproperlyConfigured("DJANGO_ALLOWED_HOSTS must not contain '*'.")


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',


    "rest_framework",
    "corsheaders",
    
    
    "users.apps.UsersConfig",
    "posts.apps.PostsConfig",
    "comments.apps.CommentsConfig",
    "notifications.apps.NotificationsConfig",
    "reports.apps.ReportsConfig",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        'DIRS': [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"


# Database
# https://docs.djangoproject.com/en/6.1/ref/settings/#databases

if not DEBUG and not all(
    os.getenv(name)
    for name in ("DB_NAME", "DB_USER", "DB_PASSWORD", "DB_HOST")
):
    raise ImproperlyConfigured(
        "DB_NAME, DB_USER, DB_PASSWORD, and DB_HOST must be configured when DEBUG is disabled."
    )

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": os.getenv("DB_NAME", "roadmaps_stories"),
        "USER": os.getenv("DB_USER", "postgres"),
        "PASSWORD": os.getenv("DB_PASSWORD", ""),
        "HOST": os.getenv("DB_HOST", "localhost"),
        "PORT": os.getenv("DB_PORT", "5432"),
    }
}




# Password validation
# https://docs.djangoproject.com/en/6.1/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]


# Internationalization
# https://docs.djangoproject.com/en/6.1/topics/i18n/

LANGUAGE_CODE = "en-us"

TIME_ZONE = "UTC"

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/6.1/howto/static-files/

STATIC_URL = "static/"
MEDIA_URL = os.getenv("DJANGO_MEDIA_URL", "/media/")
MEDIA_ROOT = Path(os.getenv("DJANGO_MEDIA_ROOT", str(BASE_DIR / "media")))
if not MEDIA_ROOT.is_absolute():
    MEDIA_ROOT = BASE_DIR / MEDIA_ROOT


# Email
# https://docs.djangoproject.com/en/6.1/topics/email/#topic-email-configuration

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTHENTICATION_BACKENDS = [
    "users.backends.UsernameOrEmailBackend",
    "django.contrib.auth.backends.ModelBackend",
]

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://192.168.137.56:5173" if DEBUG else "",
    ).split(",")
    if origin.strip()
]
if not DEBUG and "*" in CORS_ALLOWED_ORIGINS:
    raise ImproperlyConfigured("CORS_ALLOWED_ORIGINS must not contain '*'.")
_cors_local_hosts = "|".join(
    re.escape(host)
    for host in sorted({"localhost", "127.0.0.1", *LOCAL_PRIVATE_IPV4_ADDRESSES})
)
CORS_ALLOWED_ORIGIN_REGEXES = (
    [rf"^https?://(?:{_cors_local_hosts})(?::\d+)?$"] if DEBUG else []
)
CORS_ALLOW_CREDENTIALS = True
_local_csrf_trusted_origins = (
    [
        f"http://{host}:5173"
        for host in {"localhost", "127.0.0.1", *LOCAL_PRIVATE_IPV4_ADDRESSES}
    ]
    if DEBUG
    else []
)
CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(
        [
            *CORS_ALLOWED_ORIGINS,
            *_local_csrf_trusted_origins,
        ]
    )
)
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = os.getenv("SESSION_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE = os.getenv("SESSION_COOKIE_SECURE", str(not DEBUG)).lower() == "true"
CSRF_COOKIE_SAMESITE = SESSION_COOKIE_SAMESITE
CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
CSRF_COOKIE_HTTPONLY = True
SECURE_SSL_REDIRECT = os.getenv(
    "DJANGO_SECURE_SSL_REDIRECT", str(not DEBUG)
).lower() == "true"
SECURE_HSTS_SECONDS = int(
    os.getenv("DJANGO_SECURE_HSTS_SECONDS", "0" if DEBUG else "31536000")
)
SECURE_HSTS_INCLUDE_SUBDOMAINS = (
    os.getenv("DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS", "false").lower() == "true"
)
SECURE_HSTS_PRELOAD = os.getenv("DJANGO_SECURE_HSTS_PRELOAD", "false").lower() == "true"
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"

REST_FRAMEWORK = {
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": "10/minute",
        "auth_register": "5/hour",
    },
}
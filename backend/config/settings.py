"""Stugora backend settings.

Everything environment-specific comes from environment variables, so the same
file runs locally (SQLite by default) and on the Hetzner server (PostgreSQL).
"""

import os
from pathlib import Path

import dj_database_url

BASE_DIR = Path(__file__).resolve().parent.parent


def load_env_file(path: Path) -> None:
    """Local secrets from backend/.env (KEY=value lines). Real environment variables win."""
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = (part.strip() for part in line.split("=", 1))
        value = value.strip("\"'")
        if key and value and not os.environ.get(key):
            os.environ[key] = value


load_env_file(BASE_DIR / ".env")


def env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).lower() in {"1", "true", "yes", "on"}


def env_list(name: str, default: str = "") -> list[str]:
    return [item.strip() for item in os.environ.get(name, default).split(",") if item.strip()]


DEBUG = env_bool("DJANGO_DEBUG", True)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
if not DEBUG and SECRET_KEY.startswith("dev-only"):
    raise RuntimeError("Set DJANGO_SECRET_KEY in production.")

ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")
# The owner dashboard reaches the API through the Next.js site's /api proxy, so the
# browser's Origin is the site, not the API.
CSRF_TRUSTED_ORIGINS = env_list("DJANGO_CSRF_TRUSTED_ORIGINS", "http://localhost:3100")

INSTALLED_APPS = [
    # Unfold restyles the admin (same theme as Bona's); it must come before django.contrib.admin.
    "unfold",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "owners",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
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
        "DIRS": [BASE_DIR / "templates"],
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

DATABASES = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en"
LANGUAGES = [
    ("en", "English"), ("fi", "Suomi"), ("sv", "Svenska"), ("nb", "Norsk bokmål"), ("nn", "Norsk nynorsk"),
    ("da", "Dansk"), ("is", "Íslenska"), ("et", "Eesti"), ("lv", "Latviešu"), ("lt", "Lietuvių"),
]
TIME_ZONE = "Europe/Helsinki"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# The Next.js site calls the API from the browser.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3100,http://localhost:3000")

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAdminUser",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "signup": os.environ.get("SIGNUP_THROTTLE_RATE", "10/hour"),
        "login": os.environ.get("LOGIN_THROTTLE_RATE", "20/hour"),
        "login-verify": os.environ.get("LOGIN_VERIFY_THROTTLE_RATE", "30/hour"),
        "enquiry": os.environ.get("ENQUIRY_THROTTLE_RATE", "10/hour"),
        "guest-message": os.environ.get("GUEST_MESSAGE_THROTTLE_RATE", "60/hour"),
        "ai-draft": os.environ.get("AI_DRAFT_THROTTLE_RATE", "60/hour"),
    },
}

# Owners stay signed in for 30 days on their own device.
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30
SESSION_COOKIE_SAMESITE = "Lax"
# Local development shows the emailed sign-in code on the login page too.
DEV_LOGIN_CODES = env_bool("DEV_LOGIN_CODES", DEBUG)

# Links in emails: the public site (guest conversations, the owner inbox) and the admin.
SITE_URL = os.environ.get("SITE_URL", "http://localhost:3100").rstrip("/")
ADMIN_URL = os.environ.get("ADMIN_URL", "http://localhost:8100/admin").rstrip("/")

# Claude suggests owners' replies (owners/assistant.py). Without a key the helper is off.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")

# Where new sign-up notifications go (Sisay and Juha).
SIGNUP_NOTIFY_EMAILS = env_list("SIGNUP_NOTIFY_EMAILS")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Stugora <hello@stugora.fi>")
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30


# Admin look: django-unfold, set up like Bona's operations admin, in Stugora's green.
# The sidebar (config/admin_nav.py) and the dashboard (config/admin_dashboard.py) are
# built per request; the stylesheet is served from config/admin_assets/ by Django
# itself, so it needs no collectstatic.
def _admin_css(request):
    from config.admin_assets_view import admin_css_url

    return admin_css_url(request)


UNFOLD = {
    "SITE_TITLE": "Stugora admin",
    "SITE_HEADER": "Stugora",
    "SITE_SUBHEADER": "Internal admin · stugora.fi",
    "SITE_URL": SITE_URL + "/",
    "SITE_SYMBOL": "cottage",
    "DASHBOARD_CALLBACK": "config.admin_dashboard.dashboard_callback",
    "STYLES": [_admin_css],
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "THEME": None,  # follows the system; switch in the user menu
    "COLORS": {
        # Stugora forest green (#1d4c3c at 600), the colour of the site and the owner dashboard.
        "primary": {
            "50": "241 244 243",
            "100": "223 230 228",
            "200": "192 205 200",
            "300": "151 173 165",
            "400": "106 137 126",
            "500": "65 105 91",
            "600": "29 76 60",
            "700": "24 64 50",
            "800": "20 53 42",
            "900": "16 43 34",
            "950": "11 29 23",
        },
    },
    "SIDEBAR": {
        "show_search": True,
        "show_all_applications": True,
        "navigation": "config.admin_nav.navigation",
    },
}

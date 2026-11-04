"""Rantio backend settings.

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


# Off unless switched on: a production server missing this line must not run in debug mode.
# manage.py switches it on for local development (runserver, tests) when there's no real secret key.
DEBUG = env_bool("DJANGO_DEBUG", False)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
if not DEBUG and SECRET_KEY.startswith("dev-only"):
    raise RuntimeError("Set DJANGO_SECRET_KEY in production.")

# Locally any host name, so a phone on the Wi-Fi can reach the API by the Mac's address;
# production always sets DJANGO_ALLOWED_HOSTS.
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "*" if DEBUG else "localhost,127.0.0.1")
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
# On the server: /srv/stugora/static, outside the code folder, so nginx can serve it.
STATIC_ROOT = Path(os.environ.get("STATIC_ROOT") or BASE_DIR / "staticfiles")

# Uploads (homepage slides). The site reaches them at /media/ through its proxy to
# this server; in production the web server should serve MEDIA_ROOT at /media/.
MEDIA_URL = "/media/"
MEDIA_ROOT = Path(os.environ.get("MEDIA_ROOT", BASE_DIR / "media"))
# Videos up to 40 MB go to a temporary file while uploading, not into memory.
FILE_UPLOAD_MAX_MEMORY_SIZE = 5 * 1024 * 1024

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# The Next.js site calls the API from the browser.
CORS_ALLOWED_ORIGINS = env_list("CORS_ALLOWED_ORIGINS", "http://localhost:3100,http://localhost:3000")

# Rate limits (and anything else cached) are shared by all gunicorn workers and survive
# worker restarts in production; manage.py createcachetable makes the table (deploy.sh).
if not DEBUG:
    CACHES = {"default": {"BACKEND": "django.core.cache.backends.db.DatabaseCache", "LOCATION": "django_cache"}}

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework.authentication.SessionAuthentication",
        "owners.app.AppKeyAuthentication",  # the phone app
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
        "guest-ai-draft": os.environ.get("GUEST_AI_DRAFT_THROTTLE_RATE", "20/hour"),
        "booking-request": os.environ.get("BOOKING_REQUEST_THROTTLE_RATE", "10/hour"),
        "geocode": os.environ.get("GEOCODE_THROTTLE_RATE", "120/hour"),
        "events": os.environ.get("EVENTS_THROTTLE_RATE", "300/hour"),
    },
}

# Events near a cottage (owners/events.py): Ticketmaster's Discovery API key, when there is
# one (developer.ticketmaster.com). Linked Events (Helsinki region) needs no key.
TICKETMASTER_API_KEY = os.environ.get("TICKETMASTER_API_KEY", "")

# The sign-up form checks the owner's email with a code, and a checked sign-up becomes an
# owner who is signed in at once (owners/email_check.py).
SIGNUP_EMAIL_CHECK = env_bool("SIGNUP_EMAIL_CHECK", True)

# Push notifications to owners' phones through Expo (off in tests).
APP_PUSH = env_bool("APP_PUSH", True)

# Owners stay signed in for 30 days on their own device.
SESSION_COOKIE_AGE = 60 * 60 * 24 * 30
SESSION_COOKIE_SAMESITE = "Lax"
# Local development shows the emailed sign-in code on the login page too.
DEV_LOGIN_CODES = env_bool("DEV_LOGIN_CODES", DEBUG)
if DEV_LOGIN_CODES and not DEBUG:
    raise RuntimeError("DEV_LOGIN_CODES shows sign-in codes to anyone; it only works with DJANGO_DEBUG=true.")

# Links in emails: the public site (guest conversations, the owner inbox) and the admin.
SITE_URL = os.environ.get("SITE_URL", "http://localhost:3100").rstrip("/")
# Written by deploy/autodeploy.sh; /api/health/ shows which commit is live.
DEPLOY_STATUS_FILE = os.environ.get("DEPLOY_STATUS_FILE", "/srv/stugora/deploy-status.json")
ADMIN_URL = os.environ.get("ADMIN_URL", "http://localhost:8100/admin").rstrip("/")

# Claude suggests owners' replies (owners/assistant.py). Without a key the helper is off.
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5-5")

# Where new sign-up notifications go (Sisay and Juha).
SIGNUP_NOTIFY_EMAILS = env_list("SIGNUP_NOTIFY_EMAILS")

# Owner sign-in besides the emailed code (owners/social.py, owners/sms.py). Each one is
# offered only when it's set up:
#   SMS code: Brevo's transactional SMS (an API key, "xkeysib-…"; SMS credits in Brevo).
BREVO_API_KEY = os.environ.get("BREVO_API_KEY", "")
SMS_SENDER = os.environ.get("SMS_SENDER", "Rantio")[:11]  # alphanumeric senders are at most 11 characters
#   Google: the OAuth client IDs (web, iOS, Android) whose ID tokens we accept.
# Public IDs, not secrets: "Rantio website" and "Rantio iPhone app" in Google Cloud project rantio.
GOOGLE_CLIENT_IDS = env_list(
    "GOOGLE_CLIENT_IDS",
    "42238401416-d9tgb4953a1tova813mof3mgprosvt6l.apps.googleusercontent.com,"
    "42238401416-vs5r0jc5usqt7h5r8ifb5dnnqrcg9enl.apps.googleusercontent.com",
)
#   Apple: the iOS app's bundle ID and, for the website, the Services ID (fi.rantio.web).
APPLE_AUDIENCES = env_list("APPLE_AUDIENCES", "fi.rantio.app,fi.rantio.web")
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "Rantio <info@rantio.fi>")
EMAIL_BACKEND = os.environ.get(
    "EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend"
)

if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 60 * 60 * 24 * 30
    # nginx already sends http:// to https://; this is a second line of defence.
    SECURE_SSL_REDIRECT = env_bool("DJANGO_SECURE_SSL_REDIRECT", True)
    # ...except the health check, so `curl http://127.0.0.1:8000/api/health/` works on the server.
    SECURE_REDIRECT_EXEMPT = [r"^api/health/$"]
    # Only turn these on once every *.rantio.fi subdomain serves HTTPS.
    SECURE_HSTS_INCLUDE_SUBDOMAINS = env_bool("DJANGO_HSTS_INCLUDE_SUBDOMAINS", False)
    SECURE_HSTS_PRELOAD = env_bool("DJANGO_HSTS_PRELOAD", False)
    # Behind nginx every request comes from 127.0.0.1; take the visitor's address from
    # the X-Forwarded-For entry nginx adds, so sign-up/login throttles count per visitor.
    REST_FRAMEWORK["NUM_PROXIES"] = int(os.environ.get("DRF_NUM_PROXIES") or 1)


# ---------- production: email, error reports, logging ----------
# SMTP (EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend). Any transactional
# service with SMTP works (Postmark, Mailgun, Brevo ...). Local dev prints emails to the console.
EMAIL_HOST = os.environ.get("EMAIL_HOST") or "localhost"
EMAIL_PORT = int(os.environ.get("EMAIL_PORT") or 587)
EMAIL_HOST_USER = os.environ.get("EMAIL_HOST_USER", "")
EMAIL_HOST_PASSWORD = os.environ.get("EMAIL_HOST_PASSWORD", "")
EMAIL_USE_TLS = env_bool("EMAIL_USE_TLS", False)
EMAIL_USE_SSL = env_bool("EMAIL_USE_SSL", False)
EMAIL_TIMEOUT = int(os.environ.get("EMAIL_TIMEOUT") or 20)
# Server error emails (500s) go to ADMINS, sent from SERVER_EMAIL.
SERVER_EMAIL = os.environ.get("SERVER_EMAIL") or DEFAULT_FROM_EMAIL
ADMINS = [(email, email) for email in env_list("DJANGO_ADMINS")]

if not DEBUG:
    # Everything to stdout/stderr, where systemd's journal picks it up
    # (journalctl -u stugora-django); errors also emailed to ADMINS when set.
    LOGGING = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "plain": {"format": "{levelname} {name}: {message}", "style": "{"},
        },
        "filters": {
            "require_debug_false": {"()": "django.utils.log.RequireDebugFalse"},
        },
        "handlers": {
            "console": {"class": "logging.StreamHandler", "stream": "ext://sys.stdout", "formatter": "plain"},
            "mail_admins": {
                "class": "django.utils.log.AdminEmailHandler",
                "level": "ERROR",
                "filters": ["require_debug_false"],
            },
        },
        "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO")},
        "loggers": {
            "django": {
                "handlers": ["console", "mail_admins"],
                "level": os.environ.get("DJANGO_LOG_LEVEL", "INFO"),
                "propagate": False,
            },
        },
    }

# Optional error tracking: set SENTRY_DSN (sentry-sdk is in requirements-prod.txt).
# Without the variable, sentry_sdk is never imported, so local dev doesn't need it.
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE") or 0),
        send_default_pii=False,
    )


# Admin look: django-unfold, set up like Bona's operations admin, in Rantio's green.
# The sidebar (config/admin_nav.py) and the dashboard (config/admin_dashboard.py) are
# built per request; the stylesheet is served from config/admin_assets/ by Django
# itself, so it needs no collectstatic.
def _admin_css(request):
    from config.admin_assets_view import admin_css_url

    return admin_css_url(request)


def _admin_asset(name):
    def url(request):
        from config.admin_assets_view import asset_url

        return asset_url(name)

    return url


UNFOLD = {
    "SITE_TITLE": "Rantio admin",
    "SITE_HEADER": "Rantio",
    "SITE_SUBHEADER": "Internal admin · rantio.fi",
    "SITE_URL": SITE_URL + "/",
    # Rantio's mark (green square, R with a house, orange pin), as on the site and the app.
    "SITE_ICON": _admin_asset("rantio-mark.svg"),
    "SITE_FAVICONS": [
        {"rel": "icon", "type": "image/svg+xml", "href": _admin_asset("rantio-mark.svg")},
        {"rel": "icon", "type": "image/png", "sizes": "32x32", "href": _admin_asset("rantio-favicon-32.png")},
        {"rel": "apple-touch-icon", "sizes": "180x180", "href": _admin_asset("rantio-apple-icon.png")},
    ],
    "DASHBOARD_CALLBACK": "config.admin_dashboard.dashboard_callback",
    "STYLES": [_admin_css],
    "SHOW_HISTORY": True,
    "SHOW_VIEW_ON_SITE": True,
    "THEME": None,  # follows the system; switch in the user menu
    "COLORS": {
        # Rantio forest green (#1d4c3c at 600), the colour of the site and the owner dashboard.
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


# ---------- booking emails and invoices ----------
# Owners forward Nettimökki booking emails to bookings+<cottage code>@rantio.fi.
# They are read from that mailbox over IMAP (manage.py read_booking_emails) or posted
# by an inbound-email service to /api/inbound/booking-email/ with INBOUND_EMAIL_SECRET.
BOOKING_FORWARD_ADDRESS = os.environ.get("BOOKING_FORWARD_ADDRESS", "bookings@rantio.fi")
BOOKING_EMAIL_IMAP_HOST = os.environ.get("BOOKING_EMAIL_IMAP_HOST", "")
BOOKING_EMAIL_IMAP_USER = os.environ.get("BOOKING_EMAIL_IMAP_USER", "")
BOOKING_EMAIL_IMAP_PASSWORD = os.environ.get("BOOKING_EMAIL_IMAP_PASSWORD", "")
BOOKING_EMAIL_IMAP_FOLDER = os.environ.get("BOOKING_EMAIL_IMAP_FOLDER", "INBOX")
INBOUND_EMAIL_SECRET = os.environ.get("INBOUND_EMAIL_SECRET", "")
# Email owners when a booking arrives on any channel.
BOOKING_ALERTS = env_bool("BOOKING_ALERTS", True)

# Monthly commission invoices (manage.py make_monthly_invoices). Without a key they
# stay drafts in the admin. STRIPE_TAX_RATE_ID: a 25.5 % Finnish VAT tax rate made
# once in the Stripe dashboard; without it VAT goes on the invoice as its own line.
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_TAX_RATE_ID = os.environ.get("STRIPE_TAX_RATE_ID", "")
INVOICE_DAYS_UNTIL_DUE = int(os.environ.get("INVOICE_DAYS_UNTIL_DUE", "14"))

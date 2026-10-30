"""The Stugora phone app: sign-in keys and push notifications.

The website signs owners in with a session cookie. A phone app can't use cookies and
CSRF well, so after the emailed code it gets its own key instead, sent as
``Authorization: Bearer <key>``. Only a hash of the key is stored. Each signed-in phone
is one AppDevice, so signing out on one phone leaves the others signed in.

Pushes go through Expo's push service to every phone the owner has signed in on and
allowed notifications. A failed push never stops the email or the booking behind it.
"""

import hashlib
import json
import logging
import secrets
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import AppDevice, Owner

logger = logging.getLogger(__name__)

PREFIX = "stg_"
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


def _hash(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


def issue_key(owner: Owner, *, name: str = "", platform: str = "") -> str:
    key = PREFIX + secrets.token_urlsafe(32)
    AppDevice.objects.create(owner=owner, token_hash=_hash(key), name=name[:80], platform=platform[:10])
    return key


class AppKeyAuthentication(authentication.BaseAuthentication):
    """``Authorization: Bearer stg_…`` from the app. No CSRF check: there is no cookie to ride on."""

    keyword = "Bearer"

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode(errors="ignore").split()
        if len(header) != 2 or header[0] != self.keyword or not header[1].startswith(PREFIX):
            return None
        device = AppDevice.objects.select_related("owner__user").filter(token_hash=_hash(header[1])).first()
        now = timezone.now()
        if not device or device.last_used_at < now - timedelta(days=AppDevice.LIFETIME_DAYS):
            raise exceptions.AuthenticationFailed("signed_out")
        user = device.owner.user
        if not user or not user.is_active:
            raise exceptions.AuthenticationFailed("signed_out")
        if now - device.last_used_at > timedelta(hours=1):
            AppDevice.objects.filter(pk=device.pk).update(last_used_at=now)
        return user, device

    def authenticate_header(self, request):
        return self.keyword


# ---------- push ----------

def _post(messages: list[dict]) -> None:
    req = urllib.request.Request(
        EXPO_PUSH_URL,
        data=json.dumps(messages).encode(),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=8) as res:  # noqa: S310 (fixed https URL)
        reply = json.loads(res.read() or b"{}")
    # Phones that uninstalled the app or turned notifications off: stop sending to them.
    for msg, ticket in zip(messages, reply.get("data") or []):
        if ticket.get("status") == "error" and (ticket.get("details") or {}).get("error") == "DeviceNotRegistered":
            AppDevice.objects.filter(push_token=msg["to"]).update(push_token="")


def notify(owner: Owner | None, title: str, body: str, data: dict | None = None) -> None:
    """Pushes to the owner's phones once the current transaction has committed."""
    if owner is None or not getattr(settings, "APP_PUSH", True):
        return
    tokens = list(owner.app_devices.exclude(push_token="").values_list("push_token", flat=True))
    if not tokens:
        return
    messages = [
        {"to": t, "title": title[:120], "body": body[:240], "data": data or {}, "sound": "default"} for t in tokens
    ]

    def send():
        try:
            _post(messages)
        except Exception:
            logger.exception("Could not push to owner %s", owner.pk)

    transaction.on_commit(send)

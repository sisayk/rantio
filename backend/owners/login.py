"""Passwordless sign-in for owners: a six-digit code by email, valid 15 minutes."""

import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.utils import timezone

from .models import LoginCode, Owner

CODES_PER_HOUR = 5  # per owner, on top of the per-IP throttle

MESSAGES = {
    "fi": (
        "Stugora-kirjautumiskoodisi: {code}",
        "Hei {name},\n\nkirjautumiskoodisi Stugoraan on:\n\n    {code}\n\n"
        "Koodi on voimassa {minutes} minuuttia. Jos et yrittänyt kirjautua, voit jättää tämän viestin huomiotta.\n\n"
        "Terveisin\nStugora",
    ),
    "en": (
        "Your Stugora sign-in code: {code}",
        "Hi {name},\n\nyour code for signing in to Stugora is:\n\n    {code}\n\n"
        "It works for {minutes} minutes. If you didn't try to sign in, you can ignore this email.\n\n"
        "Best wishes\nStugora",
    ),
}


def _hash(owner: Owner, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{owner.pk}:{code}".encode(), hashlib.sha256).hexdigest()


def find_owner(email: str) -> Owner | None:
    return Owner.objects.filter(email__iexact=email.strip()).first()


def can_send(owner: Owner) -> bool:
    since = timezone.now() - timedelta(hours=1)
    return owner.login_codes.filter(created_at__gte=since).count() < CODES_PER_HOUR


def issue_code(owner: Owner, lang: str) -> str:
    """Creates a fresh code (older ones stop working) and emails it."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = timezone.now()
    owner.login_codes.filter(used_at__isnull=True).update(used_at=now)
    LoginCode.objects.create(
        owner=owner, code_hash=_hash(owner, code), expires_at=now + timedelta(minutes=LoginCode.LIFETIME_MINUTES)
    )
    subject, body = MESSAGES["fi" if lang == "fi" else "en"]
    first_name = owner.name.split()[0] if owner.name else ""
    values = {"code": code, "name": first_name, "minutes": LoginCode.LIFETIME_MINUTES}
    send_mail(subject.format(**values), body.format(**values), settings.DEFAULT_FROM_EMAIL, [owner.email])
    return code


def check_code(owner: Owner, code: str) -> bool:
    """True once for the newest unused, unexpired code; five wrong tries end that code."""
    login = owner.login_codes.filter(used_at__isnull=True, expires_at__gt=timezone.now()).first()
    if not login or login.attempts >= LoginCode.MAX_ATTEMPTS:
        return False
    login.attempts += 1
    ok = hmac.compare_digest(login.code_hash, _hash(owner, code.strip()))
    if ok:
        login.used_at = timezone.now()
    login.save(update_fields=["attempts", "used_at"])
    return ok


def user_for(owner: Owner):
    """The Django user behind an owner's session, created on first sign-in."""
    if owner.user_id:
        return owner.user
    User = get_user_model()
    user, _ = User.objects.get_or_create(
        username=f"owner-{owner.pk}", defaults={"email": owner.email, "first_name": owner.name[:150]}
    )
    if user.has_usable_password():
        user.set_unusable_password()
        user.save(update_fields=["password"])
    owner.user = user
    owner.save(update_fields=["user"])
    return user

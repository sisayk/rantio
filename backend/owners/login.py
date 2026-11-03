"""Passwordless sign-in for owners: a six-digit code by email or SMS, valid 15 minutes."""

import hashlib
import hmac
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.mail import send_mail
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from . import sms
from .models import LoginCode, Owner

logger = logging.getLogger(__name__)

CODES_PER_HOUR = 5  # per owner, on top of the per-IP throttle
# Code tries per owner in any 24 hours, right or wrong. Someone signing in for real uses one
# or two; someone guessing gets 15 of a million chances a day per owner, from any number of IPs.
TRIES_PER_DAY = 15

# Subject and body per site language (frontend/src/i18n/locales.ts); English for anything else.
MESSAGES = {
    "en": (
        "Your Rantio sign-in code: {code}",
        "Hi {name},\n\nyour code for signing in to Rantio is:\n\n    {code}\n\n"
        "It works for {minutes} minutes. If you didn't try to sign in, you can ignore this email.\n\n"
        "Best wishes\nRantio",
    ),
    "fi": (
        "Rantio-kirjautumiskoodisi: {code}",
        "Hei {name},\n\nkirjautumiskoodisi Rantioon on:\n\n    {code}\n\n"
        "Koodi on voimassa {minutes} minuuttia. Jos et yrittänyt kirjautua, voit jättää tämän viestin huomiotta.\n\n"
        "Terveisin\nRantio",
    ),
    "sv": (
        "Din inloggningskod till Rantio: {code}",
        "Hej {name},\n\ndin kod för att logga in på Rantio är:\n\n    {code}\n\n"
        "Den gäller i {minutes} minuter. Om du inte försökte logga in kan du bortse från det här mejlet.\n\n"
        "Hälsningar\nRantio",
    ),
    "nb": (
        "Innloggingskoden din til Rantio: {code}",
        "Hei {name},\n\nkoden din for å logge inn på Rantio er:\n\n    {code}\n\n"
        "Den gjelder i {minutes} minutter. Hvis du ikke prøvde å logge inn, kan du se bort fra denne e-posten.\n\n"
        "Hilsen\nRantio",
    ),
    "nn": (
        "Innloggingskoden din til Rantio: {code}",
        "Hei {name},\n\nkoden din for å logge inn på Rantio er:\n\n    {code}\n\n"
        "Han gjeld i {minutes} minutt. Viss du ikkje prøvde å logge inn, kan du sjå bort frå denne e-posten.\n\n"
        "Helsing\nRantio",
    ),
    "da": (
        "Din login-kode til Rantio: {code}",
        "Hej {name},\n\ndin kode til at logge ind på Rantio er:\n\n    {code}\n\n"
        "Den gælder i {minutes} minutter. Hvis du ikke prøvede at logge ind, kan du se bort fra denne e-mail.\n\n"
        "Venlig hilsen\nRantio",
    ),
    "is": (
        "Innskráningarkóðinn þinn hjá Rantio: {code}",
        "Hæ {name},\n\nkóðinn þinn til að skrá þig inn hjá Rantio er:\n\n    {code}\n\n"
        "Hann gildir í {minutes} mínútur. Ef þú reyndir ekki að skrá þig inn geturðu hunsað þennan póst.\n\n"
        "Kveðja\nRantio",
    ),
    "et": (
        "Sinu Rantio sisselogimiskood: {code}",
        "Tere {name},\n\nsinu kood Rantiosse sisselogimiseks on:\n\n    {code}\n\n"
        "See kehtib {minutes} minutit. Kui sa ei proovinud sisse logida, võid selle kirja tähelepanuta jätta.\n\n"
        "Parimate soovidega\nRantio",
    ),
    "lv": (
        "Jūsu Rantio pieteikšanās kods: {code}",
        "Sveiki, {name}!\n\nJūsu kods pieteikšanās Rantio ir:\n\n    {code}\n\n"
        "Tas ir derīgs {minutes} minūtes. Ja jūs nemēģinājāt pieteikties, šo e-pastu varat neņemt vērā.\n\n"
        "Ar cieņu\nRantio",
    ),
    "lt": (
        "Jūsų Rantio prisijungimo kodas: {code}",
        "Sveiki, {name},\n\nJūsų kodas prisijungti prie Rantio:\n\n    {code}\n\n"
        "Jis galioja {minutes} min. Jei nebandėte prisijungti, šį laišką galite ignoruoti.\n\n"
        "Pagarbiai\nRantio",
    ),
}


# The SMS, per site language. The last line lets iPhones offer the code on rantio.fi only.
SMS_MESSAGES = {
    "en": "Your Rantio sign-in code is {code}. It works for {minutes} minutes.",
    "fi": "Rantio-kirjautumiskoodisi on {code}. Se on voimassa {minutes} minuuttia.",
    "sv": "Din inloggningskod till Rantio är {code}. Den gäller i {minutes} minuter.",
    "nb": "Innloggingskoden din til Rantio er {code}. Den gjelder i {minutes} minutter.",
    "nn": "Innloggingskoden din til Rantio er {code}. Han gjeld i {minutes} minutt.",
    "da": "Din login-kode til Rantio er {code}. Den gælder i {minutes} minutter.",
    "is": "Innskráningarkóðinn þinn hjá Rantio er {code}. Hann gildir í {minutes} mínútur.",
    "et": "Sinu Rantio sisselogimiskood on {code}. See kehtib {minutes} minutit.",
    "lv": "Tavs Rantio pieteikšanās kods ir {code}. Tas derīgs {minutes} minūtes.",
    "lt": "Jūsų Rantio prisijungimo kodas yra {code}. Jis galioja {minutes} min.",
}


def _hash(owner: Owner, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"{owner.pk}:{code}".encode(), hashlib.sha256).hexdigest()


def find_owner(email: str) -> Owner | None:
    return Owner.objects.filter(email__iexact=email.strip()).first()


def owner_country(owner: Owner) -> str:
    """Where the owner's cottages are (for phone numbers written without the country code)."""
    return owner.cottages.values_list("country", flat=True).first() or "FI"


def find_owner_by_phone(phone: str) -> Owner | None:
    """The owner whose phone number is this one (+358401234567), however it was typed in."""
    if not phone:
        return None
    for owner in Owner.objects.exclude(phone=""):
        if sms.normalize(owner.phone, owner_country(owner)) == phone:
            return owner
    return None


def tries_today(owner: Owner) -> int:
    since = timezone.now() - timedelta(hours=24)
    return owner.login_codes.filter(created_at__gte=since).aggregate(n=Sum("attempts"))["n"] or 0


def locked(owner: Owner) -> bool:
    """Too many code tries in the last 24 hours: no codes are sent or accepted until it calms down."""
    return tries_today(owner) >= TRIES_PER_DAY


def can_send(owner: Owner) -> bool:
    since = timezone.now() - timedelta(hours=1)
    return not locked(owner) and owner.login_codes.filter(created_at__gte=since).count() < CODES_PER_HOUR


def issue_code(owner: Owner, lang: str, via: str = "email") -> str:
    """Creates a fresh code (older ones stop working) and sends it by email or SMS."""
    code = f"{secrets.randbelow(1_000_000):06d}"
    now = timezone.now()
    owner.login_codes.filter(used_at__isnull=True).update(used_at=now)
    LoginCode.objects.create(
        owner=owner, code_hash=_hash(owner, code), expires_at=now + timedelta(minutes=LoginCode.LIFETIME_MINUTES)
    )
    first_name = owner.name.split()[0] if owner.name else ""
    values = {"code": code, "name": first_name, "minutes": LoginCode.LIFETIME_MINUTES}
    if via == "sms":
        text = (SMS_MESSAGES.get(lang) or SMS_MESSAGES.get(owner.language) or SMS_MESSAGES["en"]).format(**values)
        domain = settings.SITE_URL.split("://", 1)[-1].split("/")[0].split(":")[0]
        sms.send(sms.normalize(owner.phone, owner_country(owner)), f"{text}\n\n@{domain} #{code}")
        return code
    subject, body = MESSAGES.get(lang) or MESSAGES.get(owner.language) or MESSAGES["en"]
    send_mail(subject.format(**values), body.format(**values), settings.DEFAULT_FROM_EMAIL, [owner.email])
    return code


def check_code(owner: Owner, code: str) -> bool:
    """True once for the newest unused, unexpired code; five wrong tries end that code.

    The row is locked while it's checked, so tries sent at the same moment are counted one by one.
    """
    with transaction.atomic():
        login = (
            owner.login_codes.select_for_update()
            .filter(used_at__isnull=True, expires_at__gt=timezone.now())
            .first()
        )
        if not login or login.attempts >= LoginCode.MAX_ATTEMPTS or locked(owner):
            return False
        login.attempts += 1
        ok = hmac.compare_digest(login.code_hash, _hash(owner, code.strip()))
        if ok:
            login.used_at = timezone.now()
        login.save(update_fields=["attempts", "used_at"])
    if not ok and tries_today(owner) == TRIES_PER_DAY:
        logger.error("Sign-in locked for owner %s: %s code tries in 24 hours", owner.pk, TRIES_PER_DAY)
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

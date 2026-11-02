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
    subject, body = MESSAGES.get(lang) or MESSAGES.get(owner.language) or MESSAGES["en"]
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

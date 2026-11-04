"""Checking a sign-up's email address with a six-digit code, before the form is sent.

The form asks for a code (send()), the owner types it in, and the sign-up only goes through
with the right one (check()). A checked sign-up becomes an owner straight away (views.py),
signed in, who from then on signs in with codes by email (or SMS) like any owner.
"""

from __future__ import annotations

import hashlib
import hmac
import re
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import EmailCheck

CODES_PER_HOUR = 5  # per address, on top of the per-IP throttle

MESSAGES = {
    "en": ("Your Rantio code: {code}",
           "Hi {name},\n\nyour code for confirming your email address is:\n\n    {code}\n\n"
           "Type it in the sign-up form. It works for {minutes} minutes. If you didn't sign up to Rantio, "
           "you can ignore this email.\n\nBest wishes\nRantio"),
    "fi": ("Rantio-koodisi: {code}",
           "Hei {name},\n\nkoodisi sähköpostiosoitteen vahvistamiseen on:\n\n    {code}\n\n"
           "Kirjoita se ilmoittautumislomakkeeseen. Koodi on voimassa {minutes} minuuttia. Jos et ilmoittautunut "
           "Rantioon, voit jättää tämän viestin huomiotta.\n\nTerveisin\nRantio"),
    "sv": ("Din kod till Rantio: {code}",
           "Hej {name},\n\ndin kod för att bekräfta din e-postadress är:\n\n    {code}\n\n"
           "Skriv in den i anmälningsformuläret. Den gäller i {minutes} minuter. Om du inte anmälde dig till "
           "Rantio kan du bortse från det här mejlet.\n\nHälsningar\nRantio"),
    "nb": ("Koden din til Rantio: {code}",
           "Hei {name},\n\nkoden din for å bekrefte e-postadressen er:\n\n    {code}\n\n"
           "Skriv den inn i påmeldingsskjemaet. Den gjelder i {minutes} minutter. Hvis du ikke meldte deg på "
           "Rantio, kan du se bort fra denne e-posten.\n\nHilsen\nRantio"),
    "nn": ("Koden din til Rantio: {code}",
           "Hei {name},\n\nkoden din for å stadfeste e-postadressa er:\n\n    {code}\n\n"
           "Skriv han inn i påmeldingsskjemaet. Han gjeld i {minutes} minutt. Viss du ikkje melde deg på "
           "Rantio, kan du sjå bort frå denne e-posten.\n\nHelsing\nRantio"),
    "da": ("Din kode til Rantio: {code}",
           "Hej {name},\n\ndin kode til at bekræfte din e-mailadresse er:\n\n    {code}\n\n"
           "Skriv den i tilmeldingsformularen. Den gælder i {minutes} minutter. Hvis du ikke har tilmeldt dig "
           "Rantio, kan du se bort fra denne e-mail.\n\nVenlig hilsen\nRantio"),
    "is": ("Rantio-kóðinn þinn: {code}",
           "Hæ {name},\n\nkóðinn til að staðfesta netfangið þitt er:\n\n    {code}\n\n"
           "Sláðu hann inn í skráningarformið. Hann gildir í {minutes} mínútur. Ef þú skráðir þig ekki hjá "
           "Rantio geturðu hunsað þennan póst.\n\nBestu kveðjur\nRantio"),
    "et": ("Sinu Rantio kood: {code}",
           "Tere, {name}!\n\nsinu e-posti aadressi kinnituskood on:\n\n    {code}\n\n"
           "Sisesta see registreerimisvormi. See kehtib {minutes} minutit. Kui sa ei registreerunud Rantios, "
           "võid selle kirja tähelepanuta jätta.\n\nParimate soovidega\nRantio"),
    "lv": ("Jūsu Rantio kods: {code}",
           "Sveiki, {name}!\n\njūsu e-pasta adreses apstiprināšanas kods ir:\n\n    {code}\n\n"
           "Ierakstiet to pieteikšanās veidlapā. Tas derīgs {minutes} minūtes. Ja nepieteicāties Rantio, "
           "varat šo e-pastu neņemt vērā.\n\nAr cieņu\nRantio"),
    "lt": ("Jūsų Rantio kodas: {code}",
           "Sveiki, {name},\n\njūsų el. pašto adreso patvirtinimo kodas:\n\n    {code}\n\n"
           "Įveskite jį registracijos formoje. Jis galioja {minutes} min. Jei nesiregistravote Rantio, "
           "šį laišką galite ignoruoti.\n\nPagarbiai\nRantio"),
    "de": ("Dein Rantio-Code: {code}",
           "Hallo {name},\n\ndein Code zur Bestätigung deiner E-Mail-Adresse lautet:\n\n    {code}\n\n"
           "Gib ihn im Anmeldeformular ein. Er gilt {minutes} Minuten. Wenn du dich nicht bei Rantio angemeldet "
           "hast, kannst du diese E-Mail ignorieren.\n\nViele Grüße\nRantio"),
}


def _norm(email: str) -> str:
    return email.strip().lower()


def _hash(email: str, code: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), f"signup:{_norm(email)}:{code}".encode(), hashlib.sha256).hexdigest()


def can_send(email: str) -> bool:
    since = timezone.now() - timedelta(hours=1)
    return EmailCheck.objects.filter(email=_norm(email), created_at__gte=since).count() < CODES_PER_HOUR


def _greet(text: str) -> str:
    """Without a name, "Hi ," and "Tere, !" read "Hi," and "Tere!"."""
    return re.sub(r",\s*([,!])", r"\1", re.sub(r"\s+([,!])", r"\1", text))


def send(email: str, name: str, lang: str, purpose: str = "signup") -> str:
    """A fresh code for the address (older ones stop working), sent by email. purpose "signin":
    someone signing in for the first time (the email reads as a sign-in code)."""
    email, code, now = _norm(email), f"{secrets.randbelow(1_000_000):06d}", timezone.now()
    EmailCheck.objects.filter(email=email, used_at__isnull=True).update(used_at=now)
    EmailCheck.objects.create(email=email, code_hash=_hash(email, code),
                              expires_at=now + timedelta(minutes=EmailCheck.LIFETIME_MINUTES))
    if purpose == "signin":
        from .login import MESSAGES as SIGN_IN

        subject, body = SIGN_IN.get(lang) or SIGN_IN["en"]
    else:
        subject, body = MESSAGES.get(lang) or MESSAGES["en"]
    values = {"code": code, "name": (name.split() or [""])[0], "minutes": EmailCheck.LIFETIME_MINUTES}
    send_mail(subject.format(**values), _greet(body.format(**values)), settings.DEFAULT_FROM_EMAIL, [email])
    return code


def check(email: str, code: str) -> bool:
    """True once for the newest unused, unexpired code; five wrong tries end that code."""
    with transaction.atomic():
        row = (EmailCheck.objects.select_for_update()
               .filter(email=_norm(email), used_at__isnull=True, expires_at__gt=timezone.now()).first())
        if not row or row.attempts >= EmailCheck.MAX_ATTEMPTS:
            return False
        row.attempts += 1
        ok = hmac.compare_digest(row.code_hash, _hash(email, (code or "").strip()))
        if ok:
            row.used_at = timezone.now()
        row.save(update_fields=["attempts", "used_at"])
    return ok

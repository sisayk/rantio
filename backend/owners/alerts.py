"""Emails that tell an owner a booking has arrived, from any site.

Sent once per new booking (a post_save signal, after the transaction commits), for
stays that haven't ended yet. A booking whose dates overlap another one also goes to
the team, since that is a double booking to sort out by hand.
"""

import contextvars
import logging
from contextlib import contextmanager
from datetime import date

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone

from . import app
from .models import Booking

logger = logging.getLogger(__name__)
_muted = contextvars.ContextVar("booking_alerts_muted", default=False)

# Labels per owner language: subject, intro, site, check-in, check-out, guests,
# note for a booking from Nettimökki, note for one from another site, overlap
# warning ({other}), bookings link label, sign-off.
TEXTS = {
    "en": ("New booking: {cottage}, {dates}", "A new booking for {cottage}.", "Site", "Check-in", "Check-out", "Guests",
           "We'll block these dates on your other sites.", "Please block these dates on Nettimökki too.",
           "Careful: these dates overlap another booking ({other}). Check before accepting it.", "Your bookings", "Rantio"),
    "fi": ("Uusi varaus: {cottage}, {dates}", "Kohteeseen {cottage} tuli uusi varaus.", "Sivusto", "Saapuminen", "Lähtö", "Vieraita",
           "Estämme nämä päivät muilta sivustoiltasi.", "Muista estää nämä päivät myös Nettimökissä.",
           "Huomio: päivät menevät päällekkäin toisen varauksen kanssa ({other}). Tarkista ennen kuin hyväksyt.", "Varauksesi", "Rantio"),
    "sv": ("Ny bokning: {cottage}, {dates}", "En ny bokning för {cottage}.", "Sajt", "Incheckning", "Utcheckning", "Gäster",
           "Vi spärrar datumen på dina andra sajter.", "Spärra gärna datumen på Nettimökki också.",
           "Obs: datumen krockar med en annan bokning ({other}). Kontrollera innan du godkänner den.", "Dina bokningar", "Rantio"),
    "nb": ("Ny booking: {cottage}, {dates}", "En ny booking for {cottage}.", "Nettsted", "Innsjekk", "Utsjekk", "Gjester",
           "Vi sperrer datoene på de andre nettstedene dine.", "Husk å sperre datoene på Nettimökki også.",
           "Obs: datoene overlapper en annen booking ({other}). Sjekk før du godtar den.", "Bookingene dine", "Rantio"),
    "nn": ("Ny booking: {cottage}, {dates}", "Ei ny booking for {cottage}.", "Nettstad", "Innsjekk", "Utsjekk", "Gjester",
           "Vi sperrar datoane på dei andre nettstadene dine.", "Hugs å sperre datoane på Nettimökki òg.",
           "Obs: datoane overlappar ei anna booking ({other}). Sjekk før du godtek henne.", "Bookingane dine", "Rantio"),
    "da": ("Ny booking: {cottage}, {dates}", "En ny booking af {cottage}.", "Side", "Indtjekning", "Udtjekning", "Gæster",
           "Vi blokerer datoerne på dine andre sider.", "Husk også at blokere datoerne på Nettimökki.",
           "Bemærk: datoerne overlapper en anden booking ({other}). Tjek før du accepterer den.", "Dine bookinger", "Rantio"),
    "is": ("Ný bókun: {cottage}, {dates}", "Ný bókun fyrir {cottage}.", "Vefur", "Koma", "Brottför", "Gestir",
           "Við lokum þessum dögum á hinum vefjunum þínum.", "Mundu að loka þessum dögum líka á Nettimökki.",
           "Athugið: dagarnir skarast við aðra bókun ({other}). Athugaðu áður en þú samþykkir hana.", "Bókanirnar þínar", "Rantio"),
    "et": ("Uus broneering: {cottage}, {dates}", "{cottage} sai uue broneeringu.", "Sait", "Saabumine", "Lahkumine", "Külalisi",
           "Blokeerime need päevad sinu teistel saitidel.", "Blokeeri need päevad ka Nettimökkis.",
           "Tähelepanu: päevad kattuvad teise broneeringuga ({other}). Kontrolli enne kinnitamist.", "Sinu broneeringud", "Rantio"),
    "lv": ("Jauna rezervācija: {cottage}, {dates}", "Jauna rezervācija: {cottage}.", "Vietne", "Ierašanās", "Izbraukšana", "Viesi",
           "Mēs bloķēsim šos datumus jūsu pārējās vietnēs.", "Lūdzu, bloķējiet šos datumus arī Nettimökki.",
           "Uzmanību: datumi pārklājas ar citu rezervāciju ({other}). Pārbaudiet pirms apstiprināšanas.", "Jūsu rezervācijas", "Rantio"),
    "lt": ("Nauja rezervacija: {cottage}, {dates}", "Nauja rezervacija: {cottage}.", "Svetainė", "Atvykimas", "Išvykimas", "Svečiai",
           "Šias datas užblokuosime kitose Jūsų svetainėse.", "Užblokuokite šias datas ir Nettimökki.",
           "Dėmesio: datos sutampa su kita rezervacija ({other}). Patikrinkite prieš patvirtindami.", "Jūsų rezervacijos", "Rantio"),
    "de": ("Neue Buchung: {cottage}, {dates}", "Eine neue Buchung für {cottage}.", "Seite", "Anreise", "Abreise", "Gäste",
           "Wir sperren diese Daten auf deinen anderen Seiten.", "Bitte sperre diese Daten auch auf Nettimökki.",
           "Achtung: Diese Daten überschneiden sich mit einer anderen Buchung ({other}). Prüfe das, bevor du sie annimmst.", "Deine Buchungen", "Rantio"),
}
DATE_FORMATS = {"en": "%-d %b %Y", "sv": "%Y-%m-%d", "lt": "%Y-%m-%d"}  # others: 12.7.2027


def fmt(day: date, lang: str) -> str:
    return day.strftime(DATE_FORMATS.get(lang, "%-d.%-m.%Y"))


@contextmanager
def muted():
    """No alerts inside this block (demo data, imports)."""
    token = _muted.set(True)
    try:
        yield
    finally:
        _muted.reset(token)


def overlapping(b: Booking):
    return (
        Booking.objects.filter(cottage=b.cottage, cancelled=False, check_in__lt=b.check_out, check_out__gt=b.check_in)
        .exclude(pk=b.pk)
        .order_by("check_in")
    )


def booking_created(b: Booking) -> None:
    owner = b.cottage.owner
    lang = owner.language if owner.language in TEXTS else "en"
    t = TEXTS[lang]
    other = overlapping(b).first()
    dates = f"{fmt(b.check_in, lang)}–{fmt(b.check_out, lang)}"
    lines = [
        t[1], "",
        f"{t[2]}: {b.get_channel_display()}",
        f"{t[3]}: {fmt(b.check_in, lang)}",
        f"{t[4]}: {fmt(b.check_out, lang)}",
        f"{t[5]}: {b.guests}", "",
    ]
    if other:
        other_text = f"{other.get_channel_display()}, {fmt(other.check_in, lang)}–{fmt(other.check_out, lang)}"
        lines += [t[8].format(other=other_text), ""]
    if b.channel == Booking.Channel.NETTIMOKKI:
        lines.append(t[6])
    elif b.channel != Booking.Channel.OWNER:
        lines.append(t[7])
    lines += ["", f"{t[9]}: {settings.SITE_URL}/{lang}/hosting", "", t[10]]
    _send(t[0].format(cottage=b.cottage.name, dates=dates), "\n".join(lines), [owner.email])
    app.notify(owner, t[0].format(cottage=b.cottage.name, dates=dates), f"{b.get_channel_display()} · {t[5]}: {b.guests}",
               {"type": "booking", "booking": b.pk})
    if other and settings.SIGNUP_NOTIFY_EMAILS:
        _send(
            f"Double booking? {b.cottage.name}",
            f"{b.get_channel_display()} {b.check_in}–{b.check_out} overlaps {other.get_channel_display()} "
            f"{other.check_in}–{other.check_out} at {b.cottage.name} ({owner.name}).\n\n"
            f"{settings.ADMIN_URL}/owners/booking/{b.pk}/change/",
            settings.SIGNUP_NOTIFY_EMAILS,
        )


def _send(subject: str, body: str, to: list[str]) -> None:
    try:
        send_mail(subject, body, settings.DEFAULT_FROM_EMAIL, to)
    except Exception:  # a mail outage must not undo the booking
        logger.exception("Could not send a booking alert to %s", to)


@receiver(post_save, sender=Booking, dispatch_uid="booking-alert")
def _on_booking_saved(sender, instance: Booking, created: bool, raw: bool = False, **kwargs):
    if not created or raw or _muted.get() or not settings.BOOKING_ALERTS:
        return
    if instance.cancelled or instance.check_out < timezone.localdate():
        return
    transaction.on_commit(lambda: booking_created(instance))

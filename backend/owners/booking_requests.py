"""Booking requests through the owner's own link (/<lang>/book/<token>).

The owner shares the link with their own guests: returning families, friends, their
Facebook page. A request is a conversation with dates; nothing is booked or paid
until the owner accepts. Accepting creates the stay as the owner's own booking
(never charged) and closes the dates everywhere. The owner takes the payment the
way they do today; Rantio handles no money here.
"""

from __future__ import annotations

import logging
import secrets
from datetime import date
from decimal import Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from . import alerts, calendar, messaging
from . import app
from .models import Booking, Conversation, Cottage, Message, RequestStatus

logger = logging.getLogger(__name__)
MAX_NIGHTS = 60
BOOKABLE_DAYS_AHEAD = 2 * 365


class RequestError(Exception):
    """Why a request can't be made or accepted; `code` is for the page to put into words."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# (subject, body) per language. {name} {cottage} {dates} {guests} {text} {link} are filled in.
OWNER_REQUESTED = {
    "en": ("Booking request: {name}, {dates}", "{name} would like to book {cottage}.\n\nDates: {dates}\nGuests: {guests}\n\n“{text}”\n\nAccept or decline in Rantio. The dates stay open until you accept:\n{link}"),
    "fi": ("Varauspyyntö: {name}, {dates}", "{name} haluaisi varata kohteen {cottage}.\n\nPäivät: {dates}\nVieraita: {guests}\n\n”{text}”\n\nHyväksy tai hylkää Rantiossa. Päivät pysyvät vapaina, kunnes hyväksyt:\n{link}"),
    "sv": ("Bokningsförfrågan: {name}, {dates}", "{name} vill boka {cottage}.\n\nDatum: {dates}\nGäster: {guests}\n\n”{text}”\n\nGodkänn eller avböj i Rantio. Datumen är lediga tills du godkänner:\n{link}"),
    "nb": ("Bookingforespørsel: {name}, {dates}", "{name} vil gjerne booke {cottage}.\n\nDatoer: {dates}\nGjester: {guests}\n\n«{text}»\n\nGodta eller avslå i Rantio. Datoene er ledige til du godtar:\n{link}"),
    "nn": ("Bookingførespurnad: {name}, {dates}", "{name} vil gjerne booke {cottage}.\n\nDatoar: {dates}\nGjester: {guests}\n\n«{text}»\n\nGodta eller avslå i Rantio. Datoane er ledige til du godtek:\n{link}"),
    "da": ("Bookingforespørgsel: {name}, {dates}", "{name} vil gerne booke {cottage}.\n\nDatoer: {dates}\nGæster: {guests}\n\n»{text}«\n\nAccepter eller afvis i Rantio. Datoerne er ledige, indtil du accepterer:\n{link}"),
    "is": ("Bókunarbeiðni: {name}, {dates}", "{name} vill bóka {cottage}.\n\nDagsetningar: {dates}\nGestir: {guests}\n\n„{text}“\n\nSamþykktu eða hafnaðu í Rantio. Dagarnir eru lausir þar til þú samþykkir:\n{link}"),
    "et": ("Broneerimissoov: {name}, {dates}", "{name} soovib broneerida: {cottage}.\n\nKuupäevad: {dates}\nKülalisi: {guests}\n\n„{text}“\n\nKinnita või keeldu Rantios. Kuupäevad on vabad, kuni sa kinnitad:\n{link}"),
    "lv": ("Rezervācijas pieprasījums: {name}, {dates}", "{name} vēlas rezervēt {cottage}.\n\nDatumi: {dates}\nViesi: {guests}\n\n“{text}”\n\nApstipriniet vai noraidiet Rantio. Datumi paliek brīvi, līdz jūs apstiprināt:\n{link}"),
    "lt": ("Rezervacijos užklausa: {name}, {dates}", "{name} nori rezervuoti {cottage}.\n\nDatos: {dates}\nSvečiai: {guests}\n\n„{text}“\n\nPatvirtinkite arba atmeskite Rantio. Datos lieka laisvos, kol patvirtinsite:\n{link}"),
    "de": ("Buchungsanfrage: {name}, {dates}", "{name} möchte {cottage} buchen.\n\nDaten: {dates}\nGäste: {guests}\n\n„{text}“\n\nNimm die Anfrage in Rantio an oder lehne sie ab. Die Daten bleiben frei, bis du annimmst:\n{link}"),
}
GUEST_REQUESTED = {
    "en": ("Your booking request: {cottage}", "Hi {name},\n\nwe've sent your request for {cottage}, {dates}, to the owner. Nothing is booked or paid yet: the owner confirms and tells you how to pay.\n\nYour request and the owner's answer:\n{link}\n\nRantio"),
    "fi": ("Varauspyyntösi: {cottage}", "Hei {name},\n\nlähetimme pyyntösi kohteeseen {cottage}, {dates}, omistajalle. Mitään ei ole vielä varattu tai maksettu: omistaja vahvistaa varauksen ja kertoo, miten maksat.\n\nPyyntösi ja omistajan vastaus:\n{link}\n\nRantio"),
    "sv": ("Din bokningsförfrågan: {cottage}", "Hej {name},\n\nvi har skickat din förfrågan om {cottage}, {dates}, till ägaren. Inget är bokat eller betalt ännu: ägaren bekräftar och berättar hur du betalar.\n\nDin förfrågan och ägarens svar:\n{link}\n\nRantio"),
    "nb": ("Bookingforespørselen din: {cottage}", "Hei {name},\n\nvi har sendt forespørselen din om {cottage}, {dates}, til eieren. Ingenting er booket eller betalt ennå: eieren bekrefter og forteller hvordan du betaler.\n\nForespørselen din og eierens svar:\n{link}\n\nRantio"),
    "nn": ("Bookingførespurnaden din: {cottage}", "Hei {name},\n\nvi har sendt førespurnaden din om {cottage}, {dates}, til eigaren. Ingenting er booka eller betalt enno: eigaren stadfestar og fortel korleis du betaler.\n\nFørespurnaden din og svaret frå eigaren:\n{link}\n\nRantio"),
    "da": ("Din bookingforespørgsel: {cottage}", "Hej {name},\n\nvi har sendt din forespørgsel om {cottage}, {dates}, til ejeren. Intet er booket eller betalt endnu: ejeren bekræfter og fortæller, hvordan du betaler.\n\nDin forespørgsel og ejerens svar:\n{link}\n\nRantio"),
    "is": ("Bókunarbeiðnin þín: {cottage}", "Hæ {name},\n\nvið höfum sent beiðni þína um {cottage}, {dates}, til eigandans. Ekkert er bókað eða greitt enn: eigandinn staðfestir og segir þér hvernig þú greiðir.\n\nBeiðnin þín og svar eigandans:\n{link}\n\nRantio"),
    "et": ("Sinu broneerimissoov: {cottage}", "Tere {name},\n\nsaatsime sinu soovi ({cottage}, {dates}) omanikule. Midagi pole veel broneeritud ega makstud: omanik kinnitab ja ütleb, kuidas maksta.\n\nSinu soov ja omaniku vastus:\n{link}\n\nRantio"),
    "lv": ("Jūsu rezervācijas pieprasījums: {cottage}", "Sveiki, {name}!\n\nMēs nosūtījām jūsu pieprasījumu par {cottage}, {dates}, īpašniekam. Nekas vēl nav rezervēts vai samaksāts: īpašnieks apstiprinās un pateiks, kā maksāt.\n\nJūsu pieprasījums un īpašnieka atbilde:\n{link}\n\nRantio"),
    "lt": ("Jūsų rezervacijos užklausa: {cottage}", "Sveiki, {name},\n\nJūsų užklausą dėl {cottage}, {dates}, išsiuntėme savininkui. Kol kas niekas nerezervuota ir nesumokėta: savininkas patvirtins ir praneš, kaip sumokėti.\n\nJūsų užklausa ir savininko atsakymas:\n{link}\n\nRantio"),
    "de": ("Deine Buchungsanfrage: {cottage}", "Hallo {name},\n\nwir haben deine Anfrage für {cottage}, {dates}, an den Gastgeber geschickt. Noch ist nichts gebucht oder bezahlt: Der Gastgeber bestätigt und sagt dir, wie du bezahlst.\n\nDeine Anfrage und die Antwort des Gastgebers:\n{link}\n\nRantio"),
}
GUEST_ACCEPTED = {
    "en": ("Confirmed: {cottage}, {dates}", "Hi {name},\n\ngood news: the owner of {cottage} has accepted your request for {dates}. The dates are yours. The owner will tell you how to pay; you can write to them here:\n{link}\n\nRantio"),
    "fi": ("Vahvistettu: {cottage}, {dates}", "Hei {name},\n\nhyviä uutisia: kohteen {cottage} omistaja hyväksyi pyyntösi ajalle {dates}. Päivät ovat sinun. Omistaja kertoo, miten maksat; voit kirjoittaa hänelle täällä:\n{link}\n\nRantio"),
    "sv": ("Bekräftat: {cottage}, {dates}", "Hej {name},\n\ngoda nyheter: ägaren till {cottage} har godkänt din förfrågan för {dates}. Datumen är dina. Ägaren berättar hur du betalar; du kan skriva till hen här:\n{link}\n\nRantio"),
    "nb": ("Bekreftet: {cottage}, {dates}", "Hei {name},\n\ngode nyheter: eieren av {cottage} har godtatt forespørselen din for {dates}. Datoene er dine. Eieren forteller hvordan du betaler; du kan skrive til eieren her:\n{link}\n\nRantio"),
    "nn": ("Stadfesta: {cottage}, {dates}", "Hei {name},\n\ngode nyheiter: eigaren av {cottage} har godteke førespurnaden din for {dates}. Datoane er dine. Eigaren fortel korleis du betaler; du kan skrive til eigaren her:\n{link}\n\nRantio"),
    "da": ("Bekræftet: {cottage}, {dates}", "Hej {name},\n\ngode nyheder: ejeren af {cottage} har accepteret din forespørgsel for {dates}. Datoerne er dine. Ejeren fortæller, hvordan du betaler; du kan skrive til ejeren her:\n{link}\n\nRantio"),
    "is": ("Staðfest: {cottage}, {dates}", "Hæ {name},\n\ngóðar fréttir: eigandi {cottage} hefur samþykkt beiðni þína fyrir {dates}. Dagarnir eru þínir. Eigandinn segir þér hvernig þú greiðir; þú getur skrifað honum hér:\n{link}\n\nRantio"),
    "et": ("Kinnitatud: {cottage}, {dates}", "Tere {name},\n\nhead uudised: {cottage} omanik kinnitas sinu soovi ({dates}). Kuupäevad on sinu omad. Omanik ütleb, kuidas maksta; talle saad kirjutada siin:\n{link}\n\nRantio"),
    "lv": ("Apstiprināts: {cottage}, {dates}", "Sveiki, {name}!\n\nLabas ziņas: {cottage} īpašnieks apstiprināja jūsu pieprasījumu par {dates}. Datumi ir jūsu. Īpašnieks pateiks, kā maksāt; viņam varat rakstīt šeit:\n{link}\n\nRantio"),
    "lt": ("Patvirtinta: {cottage}, {dates}", "Sveiki, {name},\n\ngeros žinios: {cottage} savininkas patvirtino Jūsų užklausą {dates}. Datos Jūsų. Savininkas praneš, kaip sumokėti; jam galite parašyti čia:\n{link}\n\nRantio"),
    "de": ("Bestätigt: {cottage}, {dates}", "Hallo {name},\n\ngute Nachrichten: Der Gastgeber von {cottage} hat deine Anfrage für {dates} angenommen. Die Daten gehören dir. Der Gastgeber sagt dir, wie du bezahlst; hier kannst du ihm schreiben:\n{link}\n\nRantio"),
}
GUEST_DECLINED = {
    "en": ("{cottage}: dates not available", "Hi {name},\n\nunfortunately the owner of {cottage} can't take your request for {dates}. You can write to them here to ask about other dates:\n{link}\n\nRantio"),
    "fi": ("{cottage}: päivät eivät käy", "Hei {name},\n\nvalitettavasti kohteen {cottage} omistaja ei voi ottaa vastaan pyyntöäsi ajalle {dates}. Voit kysyä muita päiviä täällä:\n{link}\n\nRantio"),
    "sv": ("{cottage}: datumen är inte lediga", "Hej {name},\n\ntyvärr kan ägaren till {cottage} inte ta emot din förfrågan för {dates}. Du kan fråga om andra datum här:\n{link}\n\nRantio"),
    "nb": ("{cottage}: datoene er ikke ledige", "Hei {name},\n\ndessverre kan ikke eieren av {cottage} ta imot forespørselen din for {dates}. Du kan spørre om andre datoer her:\n{link}\n\nRantio"),
    "nn": ("{cottage}: datoane er ikkje ledige", "Hei {name},\n\ndessverre kan ikkje eigaren av {cottage} ta imot førespurnaden din for {dates}. Du kan spørje om andre datoar her:\n{link}\n\nRantio"),
    "da": ("{cottage}: datoerne er ikke ledige", "Hej {name},\n\ndesværre kan ejeren af {cottage} ikke tage imod din forespørgsel for {dates}. Du kan spørge om andre datoer her:\n{link}\n\nRantio"),
    "is": ("{cottage}: dagarnir eru ekki lausir", "Hæ {name},\n\nþví miður getur eigandi {cottage} ekki tekið við beiðni þinni fyrir {dates}. Þú getur spurt um aðra daga hér:\n{link}\n\nRantio"),
    "et": ("{cottage}: kuupäevad pole vabad", "Tere {name},\n\nkahjuks ei saa {cottage} omanik sinu soovi ({dates}) vastu võtta. Teiste kuupäevade kohta saad küsida siin:\n{link}\n\nRantio"),
    "lv": ("{cottage}: datumi nav pieejami", "Sveiki, {name}!\n\nDiemžēl {cottage} īpašnieks nevar pieņemt jūsu pieprasījumu par {dates}. Par citiem datumiem varat jautāt šeit:\n{link}\n\nRantio"),
    "lt": ("{cottage}: datos neprieinamos", "Sveiki, {name},\n\ndeja, {cottage} savininkas negali priimti Jūsų užklausos {dates}. Apie kitas datas galite paklausti čia:\n{link}\n\nRantio"),
    "de": ("{cottage}: Daten nicht verfügbar", "Hallo {name},\n\nleider kann der Gastgeber von {cottage} deine Anfrage für {dates} nicht annehmen. Hier kannst du ihm schreiben und nach anderen Daten fragen:\n{link}\n\nRantio"),
}


def _send(templates: dict, lang: str, to: list[str], **values) -> None:
    subject, body = templates.get(lang) or templates["en"]
    try:
        send_mail(subject.format(**values), body.format(**values), settings.DEFAULT_FROM_EMAIL, to)
    except Exception:  # a mail outage must not lose the request
        logger.exception("Could not send a booking-request email to %s", to)


def dates_text(c: Conversation, lang: str) -> str:
    return f"{alerts.fmt(c.check_in, lang)}–{alerts.fmt(c.check_out, lang)}"


def estimate(cottage: Cottage, check_in: date, check_out: date) -> Decimal:
    """The owner's own price for the stay: each night's price (owners/pricing.py), less a
    weekly or monthly discount, plus cleaning."""
    from . import pricing

    return Decimal(pricing.quote(cottage, check_in, check_out)["total"])


def check_dates(cottage: Cottage, check_in: date, check_out: date, guests: int) -> None:
    today = timezone.localdate()
    nights = (check_out - check_in).days
    if check_in < today or (check_in - today).days > BOOKABLE_DAYS_AHEAD:
        raise RequestError("dates")
    if nights < max(1, cottage.min_nights):
        raise RequestError("min_nights")
    if nights > MAX_NIGHTS:
        raise RequestError("max_nights")
    if guests > cottage.max_guests:
        raise RequestError("guests")
    if not calendar.is_free(cottage, check_in, check_out):
        raise RequestError("taken")


@transaction.atomic
def create(cottage: Cottage, *, name: str, email: str, phone: str, lang: str, check_in: date, check_out: date,
           adults: int, children: int, text: str) -> Conversation:
    if not cottage.booking_requests_open or cottage.status in (Cottage.Status.PAUSED, Cottage.Status.ARCHIVED):
        raise RequestError("closed")
    Cottage.objects.select_for_update().get(pk=cottage.pk)  # two requests at once can't both pass the check
    check_dates(cottage, check_in, check_out, adults + children)
    c = Conversation.objects.create(
        cottage=cottage, listing_slug=cottage.listing_slug, channel=Booking.Channel.DIRECT, guest_name=name,
        guest_email=email, guest_phone=phone, guest_language=lang, check_in=check_in, check_out=check_out,
        guests=adults, children=children, token=secrets.token_urlsafe(24), guest_read_at=timezone.now(),
        request_status=RequestStatus.PENDING,
    )
    messaging.add(c, Message.Sender.GUEST, text, notify=False)
    owner = cottage.owner
    guests = adults + children
    _send(GUEST_REQUESTED, lang, [email], name=name.split()[0], cottage=cottage.name, dates=dates_text(c, lang),
          link=messaging.guest_link(c))
    _send(OWNER_REQUESTED, owner.language, [owner.email], name=name, cottage=cottage.name, guests=guests,
          dates=dates_text(c, owner.language), text=messaging._excerpt(text),
          link=f"{settings.SITE_URL}/{owner.language}/hosting/calendar?request={c.pk}")
    subject = (OWNER_REQUESTED.get(owner.language) or OWNER_REQUESTED["en"])[0]
    values = {"name": name, "cottage": cottage.name, "guests": guests, "dates": dates_text(c, owner.language)}
    app.notify(owner, subject.format(**values), cottage.name, {"type": "request", "conversation": c.pk})
    return c


@transaction.atomic
def accept(c: Conversation, payout: Decimal) -> Booking:
    cottage = Cottage.objects.select_for_update().get(pk=c.cottage_id)
    # Read again under the lock: an accept and a decline sent at the same moment can't both win.
    c.request_status = Conversation.objects.select_for_update().values_list("request_status", flat=True).get(pk=c.pk)
    if c.request_status != RequestStatus.PENDING:
        raise RequestError("not_pending")
    if not calendar.is_free(cottage, c.check_in, c.check_out):
        raise RequestError("taken")
    with alerts.muted():  # the owner is accepting it right now; no "new booking" email to them
        b = Booking.objects.create(
            cottage=cottage, channel=Booking.Channel.OWNER, external_id=f"request-{c.pk}",
            check_in=c.check_in, check_out=c.check_out, guests=(c.guests or 1) + c.children, owner_payout=payout,
        )
    c.booking = b
    c.request_status = RequestStatus.ACCEPTED
    c.save(update_fields=["booking", "request_status"])
    lang = c.guest_language
    _send(GUEST_ACCEPTED, lang, [c.guest_email], name=c.guest_name.split()[0], cottage=cottage.name,
          dates=dates_text(c, lang), link=messaging.guest_link(c))
    return b


@transaction.atomic
def decline(c: Conversation) -> None:
    Cottage.objects.select_for_update().get(pk=c.cottage_id)
    c.request_status = Conversation.objects.select_for_update().values_list("request_status", flat=True).get(pk=c.pk)
    if c.request_status != RequestStatus.PENDING:
        raise RequestError("not_pending")
    c.request_status = RequestStatus.DECLINED
    c.save(update_fields=["request_status"])
    lang = c.guest_language
    _send(GUEST_DECLINED, lang, [c.guest_email], name=c.guest_name.split()[0], cottage=c.cottage.name,
          dates=dates_text(c, lang), link=messaging.guest_link(c))

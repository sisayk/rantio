"""Guest–owner messages: who may read what, and the emails that say a new message is waiting.

Guests have no account. Each conversation has a long random token; the link with it
is the guest's way back in, so it is only ever sent to the guest's own email (and
shown to them right after they write). Owners never see the guest's email address.
"""

import logging
import secrets

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from . import app
from .models import Booking, Conversation, Cottage, Message

logger = logging.getLogger(__name__)

# (subject, body) per site language. {cottage} {name} {link} {text} are filled in.
GUEST_STARTED = {
    "en": ("Your message about {cottage}", "Hi {name},\n\nthanks for your message about {cottage}. The owner usually answers within a day. You can read the answer and write more here:\n\n{link}\n\nKeep this link to yourself: it opens your conversation.\n\nRantio"),
    "fi": ("Viestisi kohteesta {cottage}", "Hei {name},\n\nkiitos viestistäsi kohteesta {cottage}. Omistaja vastaa yleensä vuorokauden sisällä. Voit lukea vastauksen ja jatkaa keskustelua täällä:\n\n{link}\n\nPidä linkki omana tietonasi: se avaa keskustelusi.\n\nRantio"),
    "sv": ("Ditt meddelande om {cottage}", "Hej {name},\n\ntack för ditt meddelande om {cottage}. Ägaren svarar oftast inom ett dygn. Du kan läsa svaret och skriva mer här:\n\n{link}\n\nDela inte länken: den öppnar ert samtal.\n\nRantio"),
    "nb": ("Meldingen din om {cottage}", "Hei {name},\n\ntakk for meldingen din om {cottage}. Eieren svarer vanligvis innen et døgn. Du kan lese svaret og skrive mer her:\n\n{link}\n\nIkke del lenken: den åpner samtalen deres.\n\nRantio"),
    "nn": ("Meldinga di om {cottage}", "Hei {name},\n\ntakk for meldinga di om {cottage}. Eigaren svarar vanlegvis innan eit døgn. Du kan lese svaret og skrive meir her:\n\n{link}\n\nIkkje del lenkja: ho opnar samtalen dykkar.\n\nRantio"),
    "da": ("Din besked om {cottage}", "Hej {name},\n\ntak for din besked om {cottage}. Ejeren svarer som regel inden for et døgn. Du kan læse svaret og skrive mere her:\n\n{link}\n\nDel ikke linket: det åbner jeres samtale.\n\nRantio"),
    "is": ("Skilaboðin þín um {cottage}", "Hæ {name},\n\ntakk fyrir skilaboðin um {cottage}. Eigandinn svarar yfirleitt innan sólarhrings. Þú getur lesið svarið og skrifað meira hér:\n\n{link}\n\nDeildu ekki hlekknum: hann opnar samtalið ykkar.\n\nRantio"),
    "et": ("Sinu sõnum: {cottage}", "Tere {name},\n\naitäh sõnumi eest ({cottage}). Omanik vastab tavaliselt ööpäeva jooksul. Vastust saad lugeda ja edasi kirjutada siin:\n\n{link}\n\nÄra jaga seda linki: see avab teie vestluse.\n\nRantio"),
    "lv": ("Jūsu ziņa par {cottage}", "Sveiki, {name}!\n\nPaldies par ziņu par {cottage}. Īpašnieks parasti atbild diennakts laikā. Atbildi varat izlasīt un rakstīt vēl šeit:\n\n{link}\n\nNedalieties ar šo saiti: tā atver jūsu sarunu.\n\nRantio"),
    "lt": ("Jūsų žinutė apie {cottage}", "Sveiki, {name},\n\načiū už žinutę apie {cottage}. Savininkas paprastai atsako per parą. Atsakymą galite perskaityti ir rašyti toliau čia:\n\n{link}\n\nNesidalykite šia nuoroda: ji atveria Jūsų pokalbį.\n\nRantio"),
}
GUEST_REPLY = {
    "en": ("New reply about {cottage}", "Hi {name},\n\nthe owner of {cottage} has answered:\n\n“{text}”\n\nRead and reply here:\n{link}\n\nRantio"),
    "fi": ("Uusi vastaus: {cottage}", "Hei {name},\n\nkohteen {cottage} omistaja vastasi:\n\n”{text}”\n\nLue ja vastaa täällä:\n{link}\n\nRantio"),
    "sv": ("Nytt svar om {cottage}", "Hej {name},\n\nägaren till {cottage} har svarat:\n\n”{text}”\n\nLäs och svara här:\n{link}\n\nRantio"),
    "nb": ("Nytt svar om {cottage}", "Hei {name},\n\neieren av {cottage} har svart:\n\n«{text}»\n\nLes og svar her:\n{link}\n\nRantio"),
    "nn": ("Nytt svar om {cottage}", "Hei {name},\n\neigaren av {cottage} har svart:\n\n«{text}»\n\nLes og svar her:\n{link}\n\nRantio"),
    "da": ("Nyt svar om {cottage}", "Hej {name},\n\nejeren af {cottage} har svaret:\n\n»{text}«\n\nLæs og svar her:\n{link}\n\nRantio"),
    "is": ("Nýtt svar um {cottage}", "Hæ {name},\n\neigandi {cottage} hefur svarað:\n\n„{text}“\n\nLestu og svaraðu hér:\n{link}\n\nRantio"),
    "et": ("Uus vastus: {cottage}", "Tere {name},\n\n{cottage} omanik vastas:\n\n„{text}“\n\nLoe ja vasta siin:\n{link}\n\nRantio"),
    "lv": ("Jauna atbilde par {cottage}", "Sveiki, {name}!\n\n{cottage} īpašnieks atbildēja:\n\n“{text}”\n\nIzlasiet un atbildiet šeit:\n{link}\n\nRantio"),
    "lt": ("Naujas atsakymas apie {cottage}", "Sveiki, {name},\n\n{cottage} savininkas atsakė:\n\n„{text}“\n\nPerskaitykite ir atsakykite čia:\n{link}\n\nRantio"),
}
OWNER_NEW = {
    "en": ("New message from {name} about {cottage}", "{name} wrote about {cottage}:\n\n“{text}”\n\nAnswer in your Rantio inbox:\n{link}"),
    "fi": ("Uusi viesti: {name}, {cottage}", "{name} kirjoitti kohteesta {cottage}:\n\n”{text}”\n\nVastaa Rantion viesteissä:\n{link}"),
    "sv": ("Nytt meddelande från {name} om {cottage}", "{name} skrev om {cottage}:\n\n”{text}”\n\nSvara i din inkorg hos Rantio:\n{link}"),
    "nb": ("Ny melding fra {name} om {cottage}", "{name} skrev om {cottage}:\n\n«{text}»\n\nSvar i innboksen din hos Rantio:\n{link}"),
    "nn": ("Ny melding frå {name} om {cottage}", "{name} skreiv om {cottage}:\n\n«{text}»\n\nSvar i innboksen din hos Rantio:\n{link}"),
    "da": ("Ny besked fra {name} om {cottage}", "{name} skrev om {cottage}:\n\n»{text}«\n\nSvar i din indbakke hos Rantio:\n{link}"),
    "is": ("Ný skilaboð frá {name} um {cottage}", "{name} skrifaði um {cottage}:\n\n„{text}“\n\nSvaraðu í pósthólfinu þínu hjá Rantio:\n{link}"),
    "et": ("Uus sõnum: {name}, {cottage}", "{name} kirjutas ({cottage}):\n\n„{text}“\n\nVasta Rantio postkastis:\n{link}"),
    "lv": ("Jauna ziņa no {name} par {cottage}", "{name} rakstīja par {cottage}:\n\n“{text}”\n\nAtbildiet savā Rantio iesūtnē:\n{link}"),
    "lt": ("Nauja žinutė nuo {name} apie {cottage}", "{name} parašė apie {cottage}:\n\n„{text}“\n\nAtsakykite savo Rantio pašto dėžutėje:\n{link}"),
}


def _send(templates: dict, lang: str, to: list[str], **values) -> None:
    subject, body = templates.get(lang) or templates["en"]
    try:
        send_mail(subject.format(**values), body.format(**values), settings.DEFAULT_FROM_EMAIL, to)
    except Exception:  # a mail outage must not lose the message itself
        logger.exception("Could not send a message notification to %s", to)


def guest_link(c: Conversation) -> str:
    return f"{settings.SITE_URL}/{c.guest_language}/messages/{c.token}"


def inbox_link(owner_language: str, c: Conversation) -> str:
    return f"{settings.SITE_URL}/{owner_language}/hosting/messages?c={c.pk}"


def cottage_label(c: Conversation) -> str:
    return c.cottage.name if c.cottage else c.listing_slug.replace("-", " ").title()


def _excerpt(text: str) -> str:
    return text if len(text) <= 300 else text[:297] + "…"


@transaction.atomic
def start(*, listing_slug: str, name: str, email: str, lang: str, text: str, check_in=None, check_out=None,
          guests=None, children=0) -> Conversation:
    """A guest writes from a cottage page; the owner (or, for cottages not yet with an owner, the team) is told."""
    cottage = Cottage.objects.filter(listing_slug=listing_slug).select_related("owner").first()
    c = Conversation.objects.create(
        cottage=cottage, listing_slug=listing_slug, channel=Booking.Channel.DIRECT, guest_name=name,
        guest_email=email, guest_language=lang, check_in=check_in, check_out=check_out, guests=guests,
        children=children or 0, token=secrets.token_urlsafe(24), guest_read_at=timezone.now(),
    )
    add(c, Message.Sender.GUEST, text, notify=False)
    _send(GUEST_STARTED, lang, [email], name=name.split()[0], cottage=cottage_label(c), link=guest_link(c))
    _notify_owner(c, name, text)
    return c


def _notify_owner(c: Conversation, name: str, text: str) -> None:
    owner = c.owner
    if owner:
        _send(OWNER_NEW, owner.language, [owner.email], name=name, cottage=cottage_label(c), text=_excerpt(text),
              link=inbox_link(owner.language, c))
        subject = (OWNER_NEW.get(owner.language) or OWNER_NEW["en"])[0]
        app.notify(owner, subject.format(name=name, cottage=cottage_label(c)), _excerpt(text),
                   {"type": "message", "conversation": c.pk})
    elif settings.SIGNUP_NOTIFY_EMAILS:  # an example cottage with no owner yet: the team answers in the admin
        _send(OWNER_NEW, "en", settings.SIGNUP_NOTIFY_EMAILS, name=name, cottage=cottage_label(c), text=_excerpt(text),
              link=f"{settings.ADMIN_URL}/owners/conversation/{c.pk}/change/")


def add(c: Conversation, sender: str, text: str, *, notify: bool = True) -> Message:
    now = timezone.now()
    m = Message.objects.create(conversation=c, sender=sender, body=text.strip(), created_at=now)
    c.last_message_at = now
    fields = ["last_message_at", "archived"]
    c.archived = False  # a new message brings an archived conversation back
    if sender == Message.Sender.HOST:
        c.owner_read_at = now
        fields.append("owner_read_at")
    else:
        c.guest_read_at = now
        fields.append("guest_read_at")
    c.save(update_fields=fields)
    if notify and sender == Message.Sender.GUEST:
        _notify_owner(c, c.guest_name, text)
    if notify and sender == Message.Sender.HOST and c.replies_here and c.guest_email:
        _send(GUEST_REPLY, c.guest_language, [c.guest_email], name=c.guest_name.split()[0], cottage=cottage_label(c),
              text=_excerpt(text), link=guest_link(c))
    return m


def unread_for_owner(c: Conversation) -> bool:
    last_guest = next((m for m in reversed(list(c.messages.all())) if m.sender == Message.Sender.GUEST), None)
    return bool(last_guest and (not c.owner_read_at or last_guest.created_at > c.owner_read_at))


def message_row(m: Message) -> dict:
    return {"id": m.pk, "sender": m.sender, "body": m.body, "at": m.created_at.isoformat()}


def conversation_row(c: Conversation) -> dict:
    msgs = list(c.messages.all())
    last = msgs[-1] if msgs else None
    return {
        "id": c.pk,
        "guest_name": c.guest_name,
        "guest_language": c.guest_language,
        "cottage": cottage_label(c),
        "channel": c.channel,
        "channel_label": c.get_channel_display(),
        "replies_here": c.replies_here,
        "check_in": c.check_in.isoformat() if c.check_in else None,
        "check_out": c.check_out.isoformat() if c.check_out else None,
        "guests": c.guests,
        "children": c.children,
        "request_status": c.request_status,
        "guest_phone": c.guest_phone,
        "booking_id": c.booking_id,
        "archived": c.archived,
        "unread": unread_for_owner(c),
        "last_at": c.last_message_at.isoformat() if c.last_message_at else None,
        "preview": {"sender": last.sender, "body": last.body[:140]} if last else None,
    }


def owner_conversations(owner):
    return (
        Conversation.objects.filter(cottage__owner=owner)
        .select_related("cottage", "booking")
        .prefetch_related("messages")
    )

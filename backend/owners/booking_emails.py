"""Reading forwarded Nettimökki booking emails, so their dates are blocked everywhere else.

Nettimökki has no calendar sync. Each cottage has its own forwarding address,
bookings+<code>@rantio.fi; the owner forwards Nettimökki's booking emails there (a
mail-app rule does it automatically). Each email is stored, matched to its cottage,
and read for the dates:

- clear dates  → a Nettimökki booking (never charged), which blocks the dates;
- a cancellation → the matching booking is cancelled;
- anything unclear → "Needs a look" in the admin, nothing is guessed.

Emails come in over IMAP (manage.py read_booking_emails) or from an inbound-email
service posting to /api/inbound/booking-email/.
"""

from __future__ import annotations

import hashlib
import html
import re
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from email import message_from_bytes, message_from_string, policy
from email.message import EmailMessage
from email.utils import getaddresses

from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import Booking, Cottage, InboundEmail, Owner

MAX_NIGHTS = 60
RAW_LIMIT = 500_000

# d.m.yyyy, d.m.yy is not used by Nettimökki; ISO dates for English mail clients.
DMY = r"(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})"
ISO = r"(\d{4})-(\d{2})-(\d{2})"
ONE_DATE = re.compile(rf"{DMY}|{ISO}")
# 12.7.–19.7.2027 or 12.7.2027 - 19.7.2027
RANGE = re.compile(r"(\d{1,2})\.\s?(\d{1,2})\.?\s?(\d{4})?\s*(?:[-–—]|to|till|asti)\s*(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})")
ARRIVE = re.compile(r"saapu|tulopäivä|tulo\b|alkaa|alkupäivä|check[- ]?in|arrival|ankomst|incheck", re.I)
LEAVE = re.compile(r"lähtö|lähtee|päättyy|loppupäivä|check[- ]?out|departure|avresa|utcheck|avreise", re.I)
CANCEL_SUBJECT = re.compile(r"peru|cancel|avbok|avbest|annull", re.I)
CANCEL_BODY = re.compile(
    r"varaus on peruttu|on peruutettu|peruttu varaus|perui varauksen|has been cancell?ed|booking cancell?ed|är avbokad",
    re.I,
)
GUESTS = re.compile(r"(\d{1,2})\s*(?:henkilö|hlö|aikuis|vieras|vierasta|guests?|persons?|people|personer|gäster)", re.I)
GUESTS_LABEL = re.compile(r"(?:henkilömäärä|henkilöitä|vieraita|guests|personer|antal gäster)\s*:?\s*(\d{1,2})", re.I)
REFERENCE = re.compile(r"(?:varausnumero|varaustunnus|varaus\s*nro|tilausnumero|booking (?:number|id|reference)|bokningsnummer)\s*:?\s*#?\s*([A-Z0-9-]{3,30})", re.I)
AMOUNT = re.compile(r"(?:yhteensä|hinta|kokonaishinta|total|summa|pris)\s*:?\s*(\d[\d  ]*(?:[.,]\d{1,2})?)\s*(?:€|eur)", re.I)
PLUS_CODE = re.compile(r"\+([0-9a-f]{8})@", re.I)
NETTIMOKKI_ID = re.compile(r"nettimokki\.com/\S*?(\d{3,})")


@dataclass
class Parsed:
    kind: str  # "booking", "cancellation" or "unclear"
    check_in: date | None = None
    check_out: date | None = None
    guests: int | None = None
    reference: str = ""
    amount: Decimal | None = None
    why: str = ""


# ---------- reading the email ----------

def to_message(raw: bytes | str) -> EmailMessage:
    if isinstance(raw, bytes):
        return message_from_bytes(raw, policy=policy.default)
    return message_from_string(raw, policy=policy.default)


def plain_text(msg: EmailMessage) -> str:
    part = msg.get_body(preferencelist=("plain", "html"))
    if part is None:
        return ""
    text = part.get_content()
    if part.get_content_type() == "text/html":
        text = re.sub(r"(?is)<(script|style).*?</\1>", " ", text)
        text = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d)>", "\n", text)
        text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return re.sub(r"[ \t ]+", " ", text).strip()


def addresses(msg: EmailMessage, *headers: str) -> list[str]:
    values = [v for h in headers for v in msg.get_all(h, [])]
    return [a.lower() for _, a in getaddresses([str(v) for v in values]) if a]


def _date(groups) -> date | None:
    try:
        if groups[0] is not None:  # d.m.yyyy
            return date(int(groups[2]), int(groups[1]), int(groups[0]))
        return date(int(groups[3]), int(groups[4]), int(groups[5]))
    except (TypeError, ValueError):
        return None


def _dates_in(text: str) -> list[date]:
    return [d for m in ONE_DATE.finditer(text) if (d := _date(m.groups()))]


def parse(subject: str, body: str, today: date | None = None) -> Parsed:
    today = today or timezone.localdate()
    kind = "cancellation" if CANCEL_SUBJECT.search(subject) or CANCEL_BODY.search(body) else "booking"
    check_in = check_out = None

    # 1. Labelled lines: "Saapuminen: 12.7.2027" / "Lähtö: 19.7.2027" (the date may be on the next line).
    lines = body.splitlines()
    for i, line in enumerate(lines):
        nearby = " ".join(lines[i:i + 2])
        found = _dates_in(line) or _dates_in(nearby)
        if not found:
            continue
        if check_in is None and check_out is None and ARRIVE.search(line) and LEAVE.search(line) and len(found) >= 2:
            check_in, check_out = found[0], found[1]
        elif check_in is None and ARRIVE.search(line):
            check_in = found[0]
        elif check_out is None and LEAVE.search(line):
            check_out = found[0]

    # 2. A range: "12.7.–19.7.2027".
    if not (check_in and check_out):
        for text in (subject, body):
            if m := RANGE.search(text):
                d1, m1, y1, d2, m2, y2 = m.groups()
                try:
                    check_out = date(int(y2), int(m2), int(d2))
                    check_in = date(int(y1 or y2), int(m1), int(d1))
                    if check_in > check_out and not y1:  # 28.12.–3.1.2027
                        check_in = check_in.replace(year=check_in.year - 1)
                except ValueError:
                    check_in = check_out = None
                break

    # 3. Exactly two different dates anywhere: the stay.
    if not (check_in and check_out):
        found = sorted(set(_dates_in(subject + "\n" + body)))
        if len(found) == 2:
            check_in, check_out = found

    guests = None
    if m := (GUESTS_LABEL.search(body) or GUESTS.search(body)):
        guests = int(m.group(1)) or None
    reference = m.group(1) if (m := REFERENCE.search(body) or REFERENCE.search(subject)) else ""
    amount = None
    if m := AMOUNT.search(body):
        try:
            amount = Decimal(re.sub(r"[  ]", "", m.group(1)).replace(",", "."))
        except InvalidOperation:
            amount = None

    p = Parsed(kind, check_in, check_out, guests, reference, amount)
    if not (check_in and check_out):
        p.kind, p.why = ("unclear", "No stay dates found.") if kind == "booking" or not reference else (kind, "")
        return p
    if check_out <= check_in:
        p.kind, p.why = "unclear", "Check-out is not after check-in."
    elif (check_out - check_in).days > MAX_NIGHTS:
        p.kind, p.why = "unclear", f"More than {MAX_NIGHTS} nights — probably not the stay."
    elif check_out < today - timedelta(days=1) or check_in > today + timedelta(days=760):
        p.kind, p.why = "unclear", "The dates are in the past or too far ahead."
    return p


# ---------- which cottage ----------

def find_cottage(msg: EmailMessage, body: str) -> tuple[Cottage | None, str]:
    to = addresses(msg, "To", "Cc", "Delivered-To", "X-Original-To", "X-Forwarded-To", "Envelope-To", "Resent-To")
    for a in to:
        if m := PLUS_CODE.search(a + "@"):
            cottage = Cottage.objects.filter(inbound_code=m.group(1).lower()).select_related("owner").first()
            if cottage:
                return cottage, ""
    # No code: the owner forwarded to the plain address. Recognise them by their email.
    people = set(addresses(msg, "From", "Sender", "Reply-To", "Resent-From", "X-Forwarded-For", "To", "Delivered-To"))
    people |= {a.lower() for a in re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", body)}
    owner = Owner.objects.filter(email__in=people).first()
    if not owner:
        return None, "No cottage code in the address and no owner's email in the message."
    cottages = list(owner.cottages.all())
    if len(cottages) == 1:
        return cottages[0], ""
    for c in cottages:  # several cottages: the Nettimökki link or the name in the email decides
        cid = NETTIMOKKI_ID.search(c.nettimokki_url or "")
        if (cid and cid.group(1) in body) or c.name.lower() in body.lower():
            return c, ""
    return None, f"{owner.name} has {len(cottages)} cottages and the email doesn't say which."


# ---------- storing it ----------

def ingest(raw: bytes | str) -> InboundEmail:
    msg = to_message(raw)
    message_id = str(msg.get("Message-ID", "")).strip()[:300]
    raw_text = raw.decode("utf-8", "replace") if isinstance(raw, bytes) else raw
    if message_id and (earlier := InboundEmail.objects.filter(message_id=message_id).exclude(status=InboundEmail.Status.DUPLICATE).first()):
        return InboundEmail.objects.create(
            message_id=message_id, subject=str(msg.get("Subject", ""))[:300], status=InboundEmail.Status.DUPLICATE,
            note=f"Same email as #{earlier.pk}.", booking=earlier.booking, cottage=earlier.cottage,
        )
    email = InboundEmail.objects.create(
        message_id=message_id,
        from_address=str(msg.get("From", ""))[:300],
        to_address=", ".join(addresses(msg, "To", "Delivered-To", "X-Original-To"))[:500],
        subject=str(msg.get("Subject", ""))[:300],
        body=plain_text(msg)[:100_000],
        raw=raw_text[:RAW_LIMIT],
    )
    return process(email, msg)


def reread(email: InboundEmail) -> InboundEmail:
    """Read a stored email again, e.g. after fixing the cottage's code or the owner's email."""
    return process(email, to_message(email.raw))


def process(email: InboundEmail, msg: EmailMessage) -> InboundEmail:
    cottage, why = find_cottage(msg, email.body)
    email.cottage = cottage
    if not cottage:
        return _done(email, InboundEmail.Status.REVIEW, why)
    p = parse(email.subject, email.body)
    if p.kind == "unclear":
        return _done(email, InboundEmail.Status.REVIEW, p.why)
    external_id = p.reference or "mail-" + hashlib.sha1((email.message_id or str(email.pk)).encode()).hexdigest()[:16]

    if p.kind == "cancellation":
        found = Booking.objects.filter(cottage=cottage, channel=Booking.Channel.NETTIMOKKI, cancelled=False)
        if p.reference:
            found = found.filter(external_id=p.reference)
        elif p.check_in:
            found = found.filter(check_in=p.check_in, check_out=p.check_out)
        else:
            found = found.none()
        booking = found.first()
        if not booking:
            return _done(email, InboundEmail.Status.REVIEW, "A cancellation, but no matching Nettimökki booking.")
        booking.cancelled = True
        booking.save(update_fields=["cancelled"])
        email.booking = booking
        return _done(email, InboundEmail.Status.CANCELLED, f"Cancelled {booking.check_in}–{booking.check_out}.")

    existing = Booking.objects.filter(cottage=cottage, channel=Booking.Channel.NETTIMOKKI, cancelled=False,
                                      check_in=p.check_in, check_out=p.check_out).first()
    if existing:  # a request, then its confirmation: one stay
        email.booking = existing
        return _done(email, InboundEmail.Status.DUPLICATE, "These dates are already blocked for Nettimökki.")
    try:
        with transaction.atomic():
            booking = Booking.objects.create(
                cottage=cottage, channel=Booking.Channel.NETTIMOKKI, external_id=external_id[:80],
                check_in=p.check_in, check_out=p.check_out, guests=p.guests or 1,
                owner_payout=p.amount or Decimal("0.00"),
            )
    except IntegrityError:
        booking = Booking.objects.filter(channel=Booking.Channel.NETTIMOKKI, external_id=external_id[:80]).first()
        email.booking = booking
        return _done(email, InboundEmail.Status.DUPLICATE, "Already added from an earlier email.")
    email.booking = booking
    clash = Booking.objects.filter(cottage=cottage, cancelled=False, check_in__lt=booking.check_out,
                                   check_out__gt=booking.check_in).exclude(pk=booking.pk).first()
    if clash:
        return _done(email, InboundEmail.Status.CONFLICT,
                     f"Overlaps {clash.get_channel_display()} {clash.check_in}–{clash.check_out}.")
    return _done(email, InboundEmail.Status.BOOKED, f"Blocked {booking.check_in}–{booking.check_out}.")


def _done(email: InboundEmail, status: str, note: str) -> InboundEmail:
    email.status, email.note = status, note[:300]
    email.save()
    return email

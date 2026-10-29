"""AI help for owners' replies: Claude reads the conversation and the cottage's facts and
suggests a reply. It only ever fills the owner's reply box; the owner edits and sends it.

Needs ANTHROPIC_API_KEY. Guests' messages are sent to Anthropic for this, so the privacy
policy must name Anthropic as a processor before launch.
"""

import logging
import re
from datetime import timedelta

from django.conf import settings
from django.utils import timezone

from .models import Booking, Conversation, Language

logger = logging.getLogger(__name__)


class NotConfigured(Exception):
    """No API key: the dashboard says how to turn the helper on."""


class DraftFailed(Exception):
    pass


SYSTEM = """You help the owner of a holiday cottage in the Nordics or the Baltics answer guests.
Write the owner's next reply in the conversation below.

Rules:
- Reply in the language of the guest's latest message, even if the owner's notes are in another language.
- Sound like a friendly, practical local host: short, warm, clear. No marketing talk, no emojis unless the guest uses them.
- Answer every question the guest asked, in their order.
- Use only the facts given here and in the owner's notes. Never invent prices, codes, times, addresses, rules or availability.
  When the reply needs something you don't know, put a short placeholder in square brackets for the owner to fill in,
  for example [check-in time] or [price for 5 nights].
- Availability: the booked dates listed are from Stugora's calendar and may be incomplete. If asked whether dates are
  free, say they look free (or taken) and that the owner will confirm, unless the owner's notes say otherwise.
- If the guest booked on a site such as Airbnb or Booking.com, keep everything on that site: never ask for payment,
  phone numbers or emails outside it.
- Never promise anything the owner hasn't stated (discounts, early check-in, pets) unless the notes say so.
- End with the owner's first name. Output only the reply text, nothing else."""


def _facts(c: Conversation, today) -> str:
    cottage, owner = c.cottage, c.owner
    lines = [f"Owner's first name: {owner.name.split()[0] if owner and owner.name else 'the owner'}"]
    if cottage:
        lines += [
            f"Cottage: {cottage.name}, {cottage.municipality or ''} ({cottage.get_country_display()})".replace(" ,", ","),
            f"Sleeps up to {cottage.max_guests} guests; {cottage.bedrooms} bedrooms, {cottage.beds} beds",
            f"Sauna: {'yes' if cottage.has_sauna else 'no'}; own lake or sea shore: {'yes' if cottage.has_lake_or_sea_access else 'no'}",
            f"Price the owner nets per night: {cottage.price_per_night} EUR; cleaning fee {cottage.cleaning_fee} EUR; minimum stay {cottage.min_nights} nights",
        ]
        if cottage.amenities:
            # Feature keys read well enough as words: "privateShore" -> "private shore".
            words = [re.sub(r"(?<!^)(?=[A-Z])", " ", k).lower() for k in cottage.amenities if isinstance(k, str)]
            lines.append("Has: " + ", ".join(words))
        if cottage.house_rules:
            lines.append(f"House rules: {cottage.house_rules}")
        about = cottage.description_en or cottage.description_fi
        if about:
            lines.append(f"About the cottage (owner's own words): {about}")
        booked = (
            cottage.bookings.filter(cancelled=False, check_out__gt=today, check_in__lt=today + timedelta(days=365))
            .order_by("check_in")
            .values_list("check_in", "check_out")
        )
        if booked:
            lines.append("Booked dates in the next 12 months: " + ", ".join(f"{a}–{b}" for a, b in booked))
    lines.append(f"Today is {today.isoformat()}.")
    where = "an enquiry from Stugora's own website" if c.channel == Booking.Channel.DIRECT else f"a guest of {c.get_channel_display()}"
    stay = f"; asking about {c.check_in}–{c.check_out}" if c.check_in and c.check_out else ""
    if c.booking_id:
        b = c.booking
        stay = f"; booked {b.check_in}–{b.check_out} for {b.guests} guests"
    party = f"; {c.guests} guests" if c.guests and not c.booking_id else ""
    lines.append(f"This is {where}: {c.guest_name}{stay}{party}. Guest's site language: {Language(c.guest_language).label}.")
    return "\n".join(lines)


def _transcript(c: Conversation) -> str:
    return "\n\n".join(
        f"[{m.created_at:%Y-%m-%d %H:%M}] {'Guest' if m.sender == 'guest' else 'Owner'}: {m.body}" for m in c.messages.all()
    )


def suggest_reply(c: Conversation, notes: str = "", draft: str = "") -> str:
    if not settings.ANTHROPIC_API_KEY:
        raise NotConfigured
    try:
        import anthropic  # imported here so the site still runs before `pip install` has added it
    except ImportError as err:
        logger.error("The anthropic package is missing: run pip install -r requirements.txt (./dev.sh does it)")
        raise NotConfigured from err

    today = timezone.localdate()
    parts = [f"<facts>\n{_facts(c, today)}\n</facts>", f"<conversation>\n{_transcript(c)}\n</conversation>"]
    if draft.strip():
        parts.append(f"<owner_draft>\n{draft.strip()}\n</owner_draft>\nImprove the owner's draft: keep its meaning and decisions, fix language and tone, and add any answers it misses.")
    if notes.strip():
        parts.append(f"<owner_notes>\n{notes.strip()}\n</owner_notes>\nFollow the owner's notes; they override the facts.")
    parts.append("Write the owner's reply now.")
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY, timeout=40)
        res = client.messages.create(
            model=settings.ANTHROPIC_MODEL,
            max_tokens=700,
            system=SYSTEM,
            messages=[{"role": "user", "content": "\n\n".join(parts)}],
        )
    except Exception as err:
        logger.exception("Reply suggestion failed for conversation %s", c.pk)
        raise DraftFailed from err
    text = "".join(getattr(block, "text", "") for block in res.content).strip()
    if not text:
        raise DraftFailed
    return text

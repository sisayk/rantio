"""One calendar per cottage, the master: every booking site's dates in one place.

What makes a date busy:
- a booking from any site (Booking), cancelled ones excepted;
- a block (CalendarBlock): dates the owner closed, or dates taken on a booking site
  whose calendar link (iCal) we read.

The booking sites read the cottage's own calendar link back (export_ics), so a date
closed or booked anywhere closes everywhere. Each site is given a link that leaves
out its own dates; it already has those.

Dates are nights: `start` is the first night, `end` (check-out) the first free day.
"""

from __future__ import annotations

import ipaddress
import logging
import re
import socket
import time
import urllib.error
import urllib.request
from urllib.parse import urlparse
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone as dt_timezone

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import F
from django.utils import timezone

from .models import Booking, CalendarBlock, CalendarFeed, Conversation, Cottage, RequestStatus

logger = logging.getLogger(__name__)

# Sites that let a host paste a calendar link to import, and give one to export.
FEED_CHANNELS = [Booking.Channel.AIRBNB, Booking.Channel.BOOKING, Booking.Channel.VRBO, Booking.Channel.AGODA]
MAX_FEED_BYTES = 2_000_000
FETCH_TIMEOUT = 20  # per read
FETCH_DEADLINE = 30  # for the whole calendar: a site sending a byte at a time can't hold a worker (or the sync) up
HORIZON_DAYS = 2 * 365  # nothing further ahead is exported or imported


@dataclass(frozen=True)
class Entry:
    """One busy stretch in the owner's calendar."""

    kind: str  # "booking", "block" (owner), "site" (from a booking site's calendar), "request" (waiting)
    id: int
    cottage_id: int
    start: date
    end: date
    channel: str = ""
    label: str = ""
    guests: int | None = None
    note: str = ""

    @property
    def busy(self) -> bool:
        """Requests don't close dates until the owner accepts them."""
        return self.kind != "request"

    def as_dict(self) -> dict:
        return {
            "kind": self.kind, "id": self.id, "cottage_id": self.cottage_id,
            "start": self.start.isoformat(), "end": self.end.isoformat(),
            "channel": self.channel, "label": self.label, "guests": self.guests, "note": self.note,
        }


def overlaps(a_start: date, a_end: date, b_start: date, b_end: date) -> bool:
    return a_start < b_end and b_start < a_end


def entries(cottages, start: date, end: date, *, requests: bool = True) -> list[Entry]:
    """Everything in these cottages' calendars that touches [start, end)."""
    ids = [c.pk for c in cottages]
    out: list[Entry] = []
    for b in Booking.objects.filter(
        cottage_id__in=ids, cancelled=False, check_in__lt=end, check_out__gt=start
    ).order_by("check_in"):
        out.append(Entry("booking", b.pk, b.cottage_id, b.check_in, b.check_out, b.channel, b.get_channel_display(), b.guests))
    blocks = CalendarBlock.objects.filter(cottage_id__in=ids, start__lt=end, end__gt=start).select_related("feed__link")
    for k in blocks:
        if k.feed:
            out.append(Entry("site", k.pk, k.cottage_id, k.start, k.end, k.feed.site, k.feed.label, note=k.note))
        else:
            out.append(Entry("block", k.pk, k.cottage_id, k.start, k.end, "", "", note=k.note))
    if requests:
        for c in Conversation.objects.filter(
            cottage_id__in=ids, request_status=RequestStatus.PENDING, check_in__lt=end, check_out__gt=start
        ):
            out.append(Entry("request", c.pk, c.cottage_id, c.check_in, c.check_out, Booking.Channel.OWNER,
                             c.guest_name, (c.guests or 0) + c.children))
    return sorted(out, key=lambda e: (e.start, e.end, e.kind))


def conflicts(items: list[Entry]) -> list[tuple[Entry, Entry]]:
    """Busy stretches of one cottage that overlap: a double booking to sort out.

    The same site never clashes with itself: Airbnb's calendar also lists the Airbnb
    stays we have as bookings. Two closed stretches overlapping are harmless too.
    Anything else overlapping (Nettimökki and Airbnb, a booking on dates the owner
    closed) is a real clash."""
    busy = [e for e in items if e.busy]
    pairs = []
    for i, a in enumerate(busy):
        for b in busy[i + 1:]:
            if a.cottage_id != b.cottage_id or not overlaps(a.start, a.end, b.start, b.end):
                continue
            if a.kind == "block" and b.kind == "block":
                continue
            if a.channel and a.channel == b.channel and "site" in (a.kind, b.kind):
                continue
            pairs.append((a, b))
    return pairs


def is_free(cottage: Cottage, start: date, end: date) -> bool:
    return not any(e.busy for e in entries([cottage], start, end, requests=False))


def busy_ranges(cottage: Cottage, start: date, end: date) -> list[tuple[date, date]]:
    """Busy nights merged into stretches, for a guest choosing dates. Says nothing about why."""
    spans = sorted((e.start, e.end) for e in entries([cottage], start, end, requests=False) if e.busy)
    merged: list[list[date]] = []
    for s, e in spans:
        if merged and s <= merged[-1][1]:
            merged[-1][1] = max(merged[-1][1], e)
        else:
            merged.append([s, e])
    return [(s, e) for s, e in merged]


# ---------- the cottage's own calendar link, read by the booking sites ----------

def export_url(cottage: Cottage, channel: str | None = None) -> str:
    base = f"{settings.SITE_URL}/api/calendar/{cottage.calendar_token}.ics"
    return f"{base}?site={channel}" if channel else base


def _ics_text(value: str) -> str:
    return value.replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,").replace("\n", "\\n")


def _fold(line: str) -> str:
    """iCal lines are at most 75 octets; longer ones continue on lines starting with a space."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    parts, chunk = [], b""
    for ch in line:
        b = ch.encode("utf-8")
        if len(chunk) + len(b) > (75 if not parts else 74):
            parts.append(chunk.decode("utf-8"))
            chunk = b""
        chunk += b
    parts.append(chunk.decode("utf-8"))
    return "\r\n ".join(parts)


def export_ics(cottage: Cottage, for_channel: str = "") -> str:
    """Busy dates as all-day events. Guest names and sites are never included, only
    "Not available", since the link works for anyone who has it."""
    today = timezone.localdate()
    stamp = timezone.now().astimezone(dt_timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Rantio//Calendar//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_ics_text(cottage.name)}",
    ]
    for e in entries([cottage], today - timedelta(days=1), today + timedelta(days=HORIZON_DAYS), requests=False):
        if for_channel and e.channel == for_channel and e.kind in ("booking", "site"):
            continue  # the site already has its own bookings
        lines += [
            "BEGIN:VEVENT",
            f"UID:stugora-{e.kind}-{e.id}@rantio.fi",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{e.start:%Y%m%d}",
            f"DTEND;VALUE=DATE:{e.end:%Y%m%d}",
            "SUMMARY:Not available",
            "TRANSP:OPAQUE",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


# ---------- reading a booking site's calendar link ----------

@dataclass(frozen=True)
class Event:
    uid: str
    start: date
    end: date
    summary: str


DATE_VALUE = re.compile(r"(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?")


def _date(value: str) -> date | None:
    m = DATE_VALUE.match(value.strip())
    if not m:
        return None
    y, mo, d = int(m[1]), int(m[2]), int(m[3])
    try:
        if m[4] and m[7]:  # a UTC time: the guest's day where the cottage is
            moment = datetime(y, mo, d, int(m[4]), int(m[5]), int(m[6]), tzinfo=dt_timezone.utc)
            return timezone.localtime(moment).date()
        return date(y, mo, d)
    except (ValueError, OverflowError):  # 20261340: not a date; the event is skipped
        return None


def parse_ics(text: str) -> list[Event]:
    """The events in an iCal file; anything unreadable is skipped, never guessed."""
    unfolded = re.sub(r"\r?\n[ \t]", "", text)
    events: list[Event] = []
    current: dict[str, str] | None = None
    for line in unfolded.splitlines():
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT" and current is not None:
            start = _date(current.get("DTSTART", ""))
            end = _date(current.get("DTEND", "")) if current.get("DTEND") else None
            if start:
                end = end or start + timedelta(days=1)
                if end > start and (end - start).days <= 366:
                    uid = current.get("UID") or f"{start:%Y%m%d}-{end:%Y%m%d}"
                    events.append(Event(uid[:255], start, end, current.get("SUMMARY", "")[:200]))
            current = None
        elif current is not None and ":" in line:
            name, _, value = line.partition(":")
            key = name.split(";")[0].upper()
            if key in ("UID", "DTSTART", "DTEND", "SUMMARY", "STATUS"):
                current[key] = value.strip()
                if key == "STATUS" and value.strip().upper() == "CANCELLED":
                    current["DTSTART"] = ""  # a cancelled event frees its dates
    return events


class FeedError(Exception):
    """A calendar link that can't be read; the message is shown to the owner as is."""


def check_address(url: str) -> None:
    """Only https on port 443 to a public address: an owner's link mustn't reach the server's own
    network (localhost, 10.x, the cloud's metadata address…). Checked again on every redirect."""
    p = urlparse(url)
    if p.scheme != "https" or not p.hostname:
        raise FeedError("The link must start with https://")
    if p.port not in (None, 443):
        raise FeedError("That address can't be read.")
    try:
        infos = socket.getaddrinfo(p.hostname, 443, proto=socket.IPPROTO_TCP)
    except (socket.gaierror, UnicodeError) as exc:
        raise FeedError("Couldn't find that address.") from exc
    if not infos or any(not ipaddress.ip_address(i[4][0].split("%")[0]).is_global for i in infos):
        raise FeedError("That address can't be read.")


class _CheckedRedirects(urllib.request.HTTPRedirectHandler):
    max_redirections = 5

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        check_address(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


_opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), _CheckedRedirects)


def fetch(url: str) -> str:
    check_address(url)
    req = urllib.request.Request(url, headers={"User-Agent": "Rantio calendar sync (+https://rantio.fi)"})
    try:
        deadline = time.monotonic() + FETCH_DEADLINE
        with _opener.open(req, timeout=FETCH_TIMEOUT) as res:  # noqa: S310 (address checked above)
            chunks, size = [], 0
            while size <= MAX_FEED_BYTES and (chunk := res.read1(65536)):
                if time.monotonic() > deadline:
                    raise FeedError("The site took too long to send the calendar.")
                chunks.append(chunk)
                size += len(chunk)
            body = b"".join(chunks)
    except FeedError:
        raise
    except urllib.error.HTTPError as exc:  # the site's own answer (404, 403…)
        raise FeedError(f"The site answered {exc.code}.") from exc
    except Exception as exc:  # network, TLS, timeout: no details, they could describe other hosts
        raise FeedError("Couldn't read the link.") from exc
    if len(body) > MAX_FEED_BYTES:
        raise FeedError("The calendar is too large.")
    return body.decode("utf-8", errors="replace")


def sync_feed(feed: CalendarFeed, *, get=fetch) -> int:
    """Brings the site's busy dates into the cottage's calendar. Returns how many stretches it has."""
    try:
        text = get(feed.url)
        if "BEGIN:VCALENDAR" not in text:
            raise FeedError("That link isn't a calendar (iCal) link.")
        events = parse_ics(text)
    except FeedError as exc:
        feed.last_error = str(exc)
        feed.save(update_fields=["last_error"])
        raise
    today = timezone.localdate()
    events = [e for e in events if e.end >= today and e.start <= today + timedelta(days=HORIZON_DAYS)]
    # Our own calendar read back by the site (some sites echo it) isn't the site's booking.
    events = [e for e in events if not e.uid.startswith("stugora-")]
    # A site that suddenly sends an empty calendar is more often broken than empty: the dates stay
    # closed until the next read says the same (otherwise Beds24 would open them within minutes).
    quiet = f"feed-empty:{feed.pk}"
    if not events and CalendarBlock.objects.filter(feed=feed).exists() and not cache.get(quiet):
        cache.set(quiet, 1, 6 * 3600)
        feed.last_synced_at = timezone.now()
        feed.save(update_fields=["last_synced_at"])
        return 0
    if events:
        cache.delete(quiet)
    with transaction.atomic():
        kept = set()
        for e in events:
            block, _ = CalendarBlock.objects.update_or_create(
                feed=feed, uid=e.uid,
                defaults={"cottage": feed.cottage, "start": e.start, "end": e.end, "note": e.summary},
            )
            kept.add(block.pk)
        CalendarBlock.objects.filter(feed=feed).exclude(pk__in=kept).delete()
        feed.last_synced_at = timezone.now()
        feed.last_error = ""
        feed.save(update_fields=["last_synced_at", "last_error"])
    return len(events)


def sync_all(*, get=fetch) -> tuple[int, int]:
    ok = failed = 0
    # The one read longest ago first, so a slow or broken calendar can't keep the others waiting.
    feeds = CalendarFeed.objects.select_related("cottage").order_by(F("last_synced_at").asc(nulls_first=True), "pk")
    for feed in feeds:
        try:
            sync_feed(feed, get=get)
            ok += 1
        except FeedError:
            failed += 1
            logger.warning("Calendar %s couldn't be read: %s", feed.pk, feed.last_error)
        except Exception:  # one calendar's surprise must not stop the rest
            failed += 1
            logger.exception("Calendar %s failed", feed.pk)
    return ok, failed

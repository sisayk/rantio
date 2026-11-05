"""Beds24, the channel manager: Rantio sends each cottage there, and Beds24 puts it on
Airbnb, Booking.com and Vrbo (connected once in Beds24's own control panel).

API V2 (https://beds24.com/api/v2): a refresh token, made once from an invite code by
deploy/set-beds24.sh, gives a token for 24 hours (sent in a `token` header). What's sent:
  - the property and its one room (POST /properties; no id creates, an id updates);
  - the nightly prices and minimum stay for the next year (POST /inventory/rooms/calendar),
    from the same prices Rantio's own pages use (owners/pricing.py).
Photos can't go through API V2 yet, and availability and bookings coming back follow once
tested on the real account. Without BEDS24_REFRESH_TOKEN nothing is sent.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from .models import Cottage

TOKEN_CACHE = "beds24:token"
PRICE_DAYS = 365


class Beds24Error(Exception):
    pass


def enabled() -> bool:
    return bool(settings.BEDS24_REFRESH_TOKEN)


def _request(method: str, path: str, *, body=None, params: dict | None = None, headers: dict | None = None):
    url = f"{settings.BEDS24_API}{path}"
    if params:
        url += "?" + urllib.parse.urlencode(params, doseq=True)
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Accept", "application/json")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        detail = e.read()[:400].decode(errors="replace")
        raise Beds24Error(f"{method} {path}: HTTP {e.code} {detail}") from e
    except urllib.error.URLError as e:
        raise Beds24Error(f"{method} {path}: {e.reason}") from e
    return json.loads(raw) if raw else None


def token(*, fresh: bool = False) -> str:
    """A token for the next 24 hours, from the refresh token (kept a little shorter in the cache)."""
    if not enabled():
        raise Beds24Error("Beds24 isn't connected (BEDS24_REFRESH_TOKEN is empty).")
    if not fresh and (cached := cache.get(TOKEN_CACHE)):
        return cached
    got = _request("GET", "/authentication/token", headers={"refreshToken": settings.BEDS24_REFRESH_TOKEN}) or {}
    value = got.get("token")
    if not value:
        raise Beds24Error("Beds24 gave no token: the refresh token may be wrong or unused for 30 days.")
    cache.set(TOKEN_CACHE, value, max(60, int(got.get("expiresIn") or 86400) - 600))
    return value


def call(method: str, path: str, *, body=None, params: dict | None = None):
    try:
        return _request(method, path, body=body, params=params, headers={"token": token()})
    except Beds24Error as e:
        if "HTTP 401" not in str(e):
            raise
        return _request(method, path, body=body, params=params, headers={"token": token(fresh=True)})


def _items(response) -> list:
    if isinstance(response, list):
        return response
    if isinstance(response, dict):
        return response.get("data") if isinstance(response.get("data"), list) else [response]
    return []


def _failed(item) -> str:
    if isinstance(item, dict) and item.get("success") is False:
        return json.dumps(item.get("errors") or item.get("error") or item)[:400]
    return ""


# ---------- what is sent ----------

# Rantio's languages in Beds24's codes (Beds24 has one Norwegian, no Latvian).
TEXT_LANGS = {"en": "en", "fi": "fi", "sv": "sv", "nb": "no", "da": "da", "is": "is", "et": "et", "lt": "lt", "de": "de"}


def _quarter(t) -> str | None:
    """A time as Beds24 takes it: HH:MM on a quarter hour."""
    if not t:
        return None
    minutes = (t.hour * 60 + t.minute) // 15 * 15
    return f"{minutes // 60:02d}:{minutes % 60:02d}"


def property_payload(c: Cottage) -> dict:
    """The cottage as one Beds24 property with one room (the whole cottage, let as one unit)."""
    from .listings import descriptions_of

    room = {
        "name": c.name[:60],
        "roomType": "holidayHome",
        "qty": 1,
        "maxPeople": c.max_guests,
        "minStay": max(1, c.min_nights),
        "rackRate": float(c.price_per_night),
        "cleaningFee": float(c.cleaning_fee or 0),
        "securityDeposit": float(c.security_deposit or 0),
    }
    if c.max_nights:
        room["maxStay"] = c.max_nights
    if c.floor_area:
        room["roomSize"] = c.floor_area
    if c.beds24_room_id:
        room["id"] = c.beds24_room_id
    p = {
        "name": c.name,
        "propertyType": settings.BEDS24_PROPERTY_TYPE or "cottage",
        "currency": c.currency,
        "address": c.address,
        "city": c.municipality,
        "country": c.country,
        "roomTypes": [room],
    }
    if c.latitude is not None and c.longitude is not None:
        p["latitude"], p["longitude"] = float(c.latitude), float(c.longitude)
    for key, value in (("checkInStart", _quarter(c.check_in_from)), ("checkInEnd", _quarter(c.check_in_until)), ("checkOutEnd", _quarter(c.check_out_by))):
        if value:
            p[key] = value
    texts = []
    for lang, text in descriptions_of(c).items():
        if lang in TEXT_LANGS:
            entry = {"language": TEXT_LANGS[lang], "propertyDescription": text}
            if lang == "en" and c.house_rules:
                entry["houseRules"] = c.house_rules
            texts.append(entry)
    if texts:
        p["texts"] = texts
    if c.beds24_property_id:
        p["id"] = c.beds24_property_id
    return p


def price_ranges(c: Cottage, *, days: int = PRICE_DAYS, today=None) -> list[dict]:
    """The next `days` nights as runs of the same price: [{"from", "to" (last night), "price1", "minStay"}]."""
    from . import pricing

    start = today or timezone.localdate()
    runs: list[dict] = []
    for n in pricing.nights(c, start, start + timedelta(days=days), today=start):
        price = float(Decimal(n.price).quantize(Decimal("0.01")))
        last = runs[-1] if runs else None
        if last and last["price1"] == price and last["_to"] + timedelta(days=1) == n.date:
            last["_to"] = n.date
        else:
            runs.append({"_from": n.date, "_to": n.date, "price1": price, "minStay": max(1, c.min_nights)})
    return [{"from": r["_from"].isoformat(), "to": r["_to"].isoformat(), "price1": r["price1"], "minStay": r["minStay"]} for r in runs]


# ---------- sending ----------

def push_property(c: Cottage) -> tuple[int, int]:
    """Creates or updates the property and its room; returns (property id, room id)."""
    items = _items(call("POST", "/properties", body=[property_payload(c)]))
    item = items[0] if items else {}
    if why := _failed(item):
        raise Beds24Error(f"Beds24 refused the property: {why}")
    found = (item.get("new") or item.get("modified") or item) if isinstance(item, dict) else {}
    pid = found.get("id") or c.beds24_property_id
    if not pid:
        raise Beds24Error(f"Beds24 didn't say which property it made: {json.dumps(item)[:300]}")
    rid = c.beds24_room_id
    if not rid:
        props = _items(call("GET", "/properties", params={"id": pid, "includeAllRooms": "true"}))
        rooms = (props[0].get("roomTypes") or []) if props and isinstance(props[0], dict) else []
        rid = rooms[0].get("id") if rooms else None
        if not rid:
            raise Beds24Error(f"Beds24 made property {pid} but no room for it.")
    c.beds24_property_id, c.beds24_room_id = int(pid), int(rid)
    c.save(update_fields=["beds24_property_id", "beds24_room_id"])
    return c.beds24_property_id, c.beds24_room_id


def push_prices(c: Cottage) -> int:
    """Sends the next year's nightly prices; returns how many runs of equal prices went."""
    if not c.beds24_room_id:
        raise Beds24Error("Send the cottage itself first.")
    ranges = price_ranges(c)
    # Never a free night on Airbnb or Booking.com: every night needs a real price.
    if not ranges or any(r["price1"] <= 0 for r in ranges):
        raise Beds24Error("Some nights have no price (0). Set the cottage's nightly price in Rantio first; nothing was sent.")
    items = _items(call("POST", "/inventory/rooms/calendar", body=[{"roomId": c.beds24_room_id, "calendar": ranges}]))
    for item in items:
        if why := _failed(item):
            raise Beds24Error(f"Beds24 refused the prices: {why}")
    return len(ranges)


def sync(c: Cottage, *, prices: bool = True) -> str:
    """Sends the cottage and its prices. Keeps the outcome on the cottage for the admin.
    Without a nightly price nothing is sent at all (prices=False sends the property alone, for a test)."""
    try:
        if prices and c.price_per_night <= 0:
            raise Beds24Error("The cottage has no nightly price yet. Set it in Rantio first; nothing was sent.")
        pid, rid = push_property(c)
        if not prices:
            c.beds24_synced_at, c.beds24_error = timezone.now(), ""
            c.save(update_fields=["beds24_synced_at", "beds24_error"])
            return f"{c.name}: property {pid}, room {rid} (no prices sent)"
        runs = push_prices(c)
    except Beds24Error as e:
        c.beds24_error = str(e)[:500]
        c.save(update_fields=["beds24_error"])
        raise
    c.beds24_synced_at, c.beds24_error = timezone.now(), ""
    c.save(update_fields=["beds24_synced_at", "beds24_error"])
    return f"{c.name}: property {pid}, room {rid}, {runs} price runs"


def check() -> str:
    """A quick look that the connection works: how many properties Beds24 has."""
    return f"Connected to Beds24: {len(_items(call('GET', '/properties')))} properties in the account."


# ---------- bookings coming in ----------

BOOKINGS_SINCE = "beds24:bookings_since"
# Beds24's channel names → Rantio's. Anything else (a booking typed into Beds24 by hand,
# its own booking page) counts as "another site", which is never charged commission.
CHANNELS = {
    "airbnb": "airbnb", "airbnbical": "airbnb", "booking": "booking", "vrbo": "vrbo", "homeaway": "vrbo",
    "expedia": "expedia", "agoda": "agoda", "google": "google", "holidu": "holidu", "hometogo": "hometogo",
}


def _pages(path: str, params: dict) -> list[dict]:
    out, page = [], 1
    while True:
        got = call("GET", path, params={**params, "page": page} if page > 1 else params)
        out += _items(got)
        more = isinstance(got, dict) and (got.get("pages") or {}).get("nextPageExists")
        if not more or page >= 50:
            return out
        page += 1


def _payout(b: dict, c: Cottage) -> Decimal:
    """What the owner gets: the guest's price less the site's commission and the cleaning fee.
    A best reading of Beds24's numbers; the admin can correct one by hand."""
    price = Decimal(str(b.get("price") or 0))
    site_fee = Decimal(str(b.get("commission") or 0))
    payout = price - site_fee - (c.cleaning_fee or Decimal("0"))
    return max(Decimal("0.00"), payout).quantize(Decimal("0.01"))


def pull_bookings() -> dict:
    """New and changed bookings since the last look become (or update) Rantio bookings.
    A new one emails the owner like any booking (owners/alerts.py). Returns counts."""
    from datetime import date

    from .models import Booking

    by_room = {c.beds24_room_id: c for c in Cottage.objects.filter(beds24_room_id__isnull=False)}
    if not by_room:
        return {"new": 0, "changed": 0, "skipped": 0}
    started = timezone.now()
    since = cache.get(BOOKINGS_SINCE) or (started - timedelta(days=400))
    rows = _pages("/bookings", {
        "propertyId": sorted({c.beds24_property_id for c in by_room.values()}),
        "modifiedFrom": (since - timedelta(minutes=5)).strftime("%Y-%m-%dT%H:%M:%S"),
        "status": ["confirmed", "new", "request", "cancelled"],
    })
    counts = {"new": 0, "changed": 0, "skipped": 0}
    for b in rows:
        c = by_room.get(b.get("roomId"))
        try:
            check_in, check_out = date.fromisoformat(b["arrival"]), date.fromisoformat(b["departure"])
        except (KeyError, TypeError, ValueError):
            c = None
        if not c or check_out <= check_in:
            counts["skipped"] += 1
            continue
        ext = f"b24:{b['id']}"
        values = {
            "cottage": c,
            "channel": CHANNELS.get(str(b.get("channel") or "").lower(), Booking.Channel.OTHER),
            "check_in": check_in,
            "check_out": check_out,
            "guests": max(1, int(b.get("numAdult") or 0) + int(b.get("numChild") or 0)),
            "owner_payout": _payout(b, c),
            "cancelled": b.get("status") == "cancelled",
        }
        existing = Booking.objects.filter(external_id=ext).first()
        if existing:
            for k, v in values.items():
                setattr(existing, k, v)
            existing.save()
            counts["changed"] += 1
        elif not values["cancelled"]:
            Booking.objects.create(external_id=ext, **values)
            counts["new"] += 1
    cache.set(BOOKINGS_SINCE, started, None)
    return counts


# ---------- dates closed in Rantio going out ----------

CLOSE_DAYS = 365


def _closed_in_rantio(c: Cottage, start, end) -> set:
    """Nights Rantio knows are taken that Beds24 doesn't: the owner's own closed dates,
    Nettimökki and other calendars Rantio reads, and stays booked on Rantio itself.
    (Bookings that came from Beds24 are already in its calendar.)"""
    from . import calendar
    from .models import Booking

    from_beds24 = set(Booking.objects.filter(cottage=c, external_id__startswith="b24:").values_list("pk", flat=True))
    nights = set()
    for e in calendar.entries([c], start, end, requests=False):
        if not e.busy or (e.kind == "booking" and e.id in from_beds24):
            continue
        d = max(e.start, start)
        while d < min(e.end, end):
            nights.add(d)
            d += timedelta(days=1)
    return nights


def _blacked_out(c: Cottage, start, end) -> set:
    from datetime import date

    rows = _items(call("GET", "/inventory/rooms/calendar", params={
        "roomId": [c.beds24_room_id], "startDate": start.isoformat(), "endDate": (end - timedelta(days=1)).isoformat(),
        "includeOverride": "true",
    }))
    nights = set()
    for row in rows:
        for entry in (row.get("calendar") or []) if isinstance(row, dict) else []:
            if entry.get("override") != "blackout":
                continue
            d, last = date.fromisoformat(entry["from"]), date.fromisoformat(entry.get("to") or entry["from"])
            while d <= last:
                nights.add(d)
                d += timedelta(days=1)
    return nights


def _runs(nights: set, override: str) -> list[dict]:
    out = []
    for d in sorted(nights):
        if out and out[-1]["_to"] + timedelta(days=1) == d:
            out[-1]["_to"] = d
        else:
            out.append({"_from": d, "_to": d})
    return [{"from": r["_from"].isoformat(), "to": r["_to"].isoformat(), "override": override} for r in out]


def push_closed_dates(c: Cottage) -> tuple[int, int]:
    """Makes Beds24's closed nights match Rantio's: closes the new ones, opens the ones Rantio
    no longer has. Rantio's calendar is the one that counts; returns (closed, opened) nights."""
    if not c.beds24_room_id:
        raise Beds24Error("Send the cottage itself first.")
    start = timezone.localdate()
    end = start + timedelta(days=CLOSE_DAYS)
    want, have = _closed_in_rantio(c, start, end), _blacked_out(c, start, end)
    close, reopen = want - have, have - want
    calendar = _runs(close, "blackout") + _runs(reopen, "none")
    if calendar:
        items = _items(call("POST", "/inventory/rooms/calendar", body=[{"roomId": c.beds24_room_id, "calendar": calendar}]))
        for item in items:
            if why := _failed(item):
                raise Beds24Error(f"Beds24 refused the closed dates: {why}")
    return len(close), len(reopen)


def sync_calendars() -> list[str]:
    """Every 15 minutes: bookings in, closed dates out. Returns a line per cottage."""
    lines = [f"Bookings: {pull_bookings()}"]
    for c in Cottage.objects.filter(beds24_room_id__isnull=False):
        try:
            closed, opened = push_closed_dates(c)
            lines.append(f"{c.name}: closed {closed}, opened {opened} nights")
        except Beds24Error as e:
            c.beds24_error = str(e)[:500]
            c.save(update_fields=["beds24_error"])
            lines.append(f"{c.name}: {e}")
    return lines

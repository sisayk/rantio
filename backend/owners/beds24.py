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

def property_payload(c: Cottage) -> dict:
    room = {"name": c.name[:60], "qty": 1, "maxPeople": c.max_guests, "minStay": max(1, c.min_nights)}
    if c.beds24_room_id:
        room["id"] = c.beds24_room_id
    p = {
        "name": c.name,
        "currency": c.currency,
        "address": c.address,
        "city": c.municipality,
        "country": c.country,
        "roomTypes": [room],
    }
    if settings.BEDS24_PROPERTY_TYPE:
        p["propertyType"] = settings.BEDS24_PROPERTY_TYPE
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
    items = _items(call("POST", "/inventory/rooms/calendar", body=[{"roomId": c.beds24_room_id, "calendar": ranges}]))
    for item in items:
        if why := _failed(item):
            raise Beds24Error(f"Beds24 refused the prices: {why}")
    return len(ranges)


def sync(c: Cottage) -> str:
    """Sends the cottage and its prices. Keeps the outcome on the cottage for the admin."""
    try:
        pid, rid = push_property(c)
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

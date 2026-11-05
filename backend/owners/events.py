"""Events near a cottage during a guest's stay, for the cottage page's "Nearby" section.

GET /api/events/?lat=60.17&lng=24.94&from=2026-11-06&to=2026-11-09&lang=en

Sources, both official event listings that link to the event's own or ticket page:
- Linked Events (api.hel.fi): the open event database of Helsinki, Espoo and Vantaa and
  partners. Free, no key. Used when the cottage is in the Helsinki region.
- Ticketmaster Discovery API: concerts, sports and shows across the Nordics (Finland,
  Sweden, Norway, Denmark). Used when TICKETMASTER_API_KEY is set on the server. With
  TICKETMASTER_AFFILIATE_LINK (Rantio's Impact tracking link) the ticket links carry
  Rantio's affiliate tag; those events say "sponsored", and the pages say so to guests.
  Commission never changes which events are shown or their order.

Only events that take place during the stay (from arrival day to departure day) within
RADIUS_KM of the cottage are returned, nearest dates first, each with its distance, price
(free / paid / amounts when known) and a link. Answers are cached for a few hours, so guests
looking at the same cottage and dates don't ask the sources again.
"""

from __future__ import annotations

import hashlib
import json
import logging
import math
import urllib.parse
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

from django.conf import settings
from django.core.cache import cache
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework.views import APIView

logger = logging.getLogger(__name__)

RADIUS_KM = 40
MAX_EVENTS = 60
PER_DAY = 6  # events shown for each day of the stay
LONG_SHOWN = 8  # and running through it (exhibitions, festivals)
LONGEST_DAYS = 400
MAX_STAY_DAYS = 60
CACHE_SECONDS = 6 * 3600
LANGS = ("en", "fi", "sv")  # Linked Events has these; other site languages get English

LINKED_EVENTS = "https://api.hel.fi/linkedevents/v1/event/"
LINKED_DAYS = 10  # days of a stay asked one by one; a longer stay shows its first ten
# The Helsinki region Linked Events covers: Helsinki, Espoo, Vantaa, Kauniainen and nearby.
LINKED_AREA = (59.8, 23.8, 60.7, 26.0)  # south, west, north, east: within reach of its events
TICKETMASTER = "https://app.ticketmaster.com/discovery/v2/events.json"
TICKETMASTER_COUNTRIES = (54.4, 4.0, 71.2, 31.6)  # roughly FI, SE, NO, DK

INTERESTS = ("music", "festival", "market", "arts", "sports", "family", "food", "other")
# Words in a source's own categories that point to one of the interests above.
KEYWORDS = {
    "music": ("music", "concert", "konsert", "musiikki", "konsertti", "jazz", "rock", "pop", "classical", "opera", "choir"),
    "festival": ("festival", "festivaali", "festivaler", "carnival", "karnevaali"),
    "market": ("market", "markkinat", "tori", "marknad", "flea", "kirpputori", "christmas market", "joulumarkkinat"),
    "arts": ("exhibition", "näyttely", "utställning", "art", "taide", "konst", "theatre", "theater", "teatteri", "museum",
             "museo", "dance", "tanssi", "film", "cinema", "elokuva", "literature", "arts & theatre"),
    "sports": ("sport", "urheilu", "idrott", "football", "jalkapallo", "ice hockey", "jääkiekko", "running", "ski",
               "match", "ottelu", "basketball", "tennis", "golf", "motorsport"),
    "family": ("famil", "perhe", "child", "lapset", "kids", "barn", "lasten", "youth", "nuoret"),
    "food": ("food", "ruoka", "mat", "wine", "viini", "beer", "olut", "restaurant", "ravintola", "tasting"),
}


class EventsThrottle(AnonRateThrottle):
    scope = "events"


def km_between(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def box(lat: float, lng: float, km: float) -> tuple[float, float, float, float]:
    dlat = km / 111.0
    dlng = km / (111.0 * max(math.cos(math.radians(lat)), 0.1))
    return lat - dlat, lng - dlng, lat + dlat, lng + dlng


def inside(lat: float, lng: float, area: tuple[float, float, float, float]) -> bool:
    return area[0] <= lat <= area[2] and area[1] <= lng <= area[3]


def interests_of(words: list[str]) -> list[str]:
    """Interests whose words begin a word in the source's categories ("ski" isn't "skills")."""
    text = " ".join(w.lower() for w in words if w)
    def says(stem: str) -> bool:
        # A short word only on its own or with an ending (ski, skiing); a longer one begins a word.
        tail = r"(?:s|es|ing|er|ers)?(?!\w)" if len(stem) <= 4 else ""
        return re.search(rf"(?<!\w){re.escape(stem)}{tail}", text) is not None

    found = [k for k, stems in KEYWORDS.items() if any(says(st) for st in stems)]
    return found or ["other"]


def _get(url: str, timeout: int = 10) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": f"Rantio cottage pages ({settings.DEFAULT_FROM_EMAIL})",
                                               "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read())


def _pick(texts: dict | None, lang: str) -> str:
    if not isinstance(texts, dict):
        return ""
    for k in (lang, "en", "fi", "sv"):
        if texts.get(k):
            return str(texts[k]).strip()
    return ""


def _strip(html: str, limit: int = 240) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def from_linked_events(lat: float, lng: float, start: date, end: date, lang: str) -> list[dict]:
    south, west, north, east = box(lat, lng, RADIUS_KM)
    base = {"bbox": f"{west:.4f},{south:.4f},{east:.4f},{north:.4f}", "include": "location,keywords", "sort": "start_time"}
    # One ask per day of the stay for that day's events (at most a day long), so a busy day
    # doesn't crowd out the others, and one for longer ones such as exhibitions and festivals.
    days = [start + timedelta(days=i) for i in range(min((end - start).days + 1, LINKED_DAYS))]
    asks = [{**base, "start": d.isoformat(), "end": d.isoformat(), "max_duration": "1d", "page_size": 50} for d in days]
    asks.append({**base, "start": start.isoformat(), "end": end.isoformat(), "min_duration": "2d", "page_size": 20})
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages = list(pool.map(lambda q: _get(f"{LINKED_EVENTS}?{urllib.parse.urlencode(q)}"), asks))
    out = []
    for e in (row for page in pages for row in page.get("data", [])):
        # A series ("recurring") or a festival's frame ("umbrella") spans months; its own dates
        # come as separate events, which are what guests can go to.
        if e.get("event_status") in ("EventCancelled", "EventPostponed") or e.get("super_event_type") in ("umbrella", "recurring"):
            continue
        if e.get("is_virtualevent"):  # online only: nothing to go to near the cottage
            continue
        # Only events presented in the guest's language: guests reading in English get the
        # ones written for visitors, not every local club meeting.
        names = e.get("name") or {}
        if not (names.get(lang) if lang in ("fi", "sv") else names.get("en")):
            continue
        loc = e.get("location") or {}
        coords = ((loc.get("position") or {}).get("coordinates")) or []
        if len(coords) != 2:
            continue
        offers = e.get("offers") or []
        free = any(o.get("is_free") for o in offers) if offers else None
        price_text = next((_pick(o.get("price"), lang) for o in offers if _pick(o.get("price"), lang)), "")
        if price_text.startswith(("http://", "https://")):  # a link where a price should be
            price_text = ""
        url = _pick(e.get("info_url"), lang) or next((_pick(o.get("info_url"), lang) for o in offers if _pick(o.get("info_url"), lang)), "")
        if not url:
            url = f"https://tapahtumat.hel.fi/{'fi' if lang == 'fi' else 'en'}/events/{e.get('id', '')}"
        keywords = [_pick(k.get("name"), "en") for k in (e.get("keywords") or []) if isinstance(k, dict)]
        out.append({
            "id": f"linked:{e.get('id')}",
            "source": "Linked Events",
            "name": _pick(e.get("name"), lang),
            "start": e.get("start_time"),
            "end": e.get("end_time"),
            "all_day": False,
            "venue": _pick(loc.get("name"), lang),
            "lat": coords[1], "lng": coords[0],
            "description": _strip(_pick(e.get("short_description"), lang) or _pick(e.get("description"), lang)),
            "url": url,
            "price": {"free": free, "text": "" if free else price_text[:80], "min": None, "max": None, "currency": ""},
            "interests": interests_of(keywords + [_pick(e.get("name"), "en")]),
            "image": next((i.get("url") for i in (e.get("images") or []) if i.get("url")), ""),
        })
    return out


def affiliate_link(url: str) -> str:
    """The event's Ticketmaster page through Rantio's Impact tracking link, when there is one.
    The link may hold {url}; otherwise the page goes in its u= parameter (Impact's deep link)."""
    base = settings.TICKETMASTER_AFFILIATE_LINK
    if not base:
        return url
    page = urllib.parse.quote(url, safe="")
    if "{url}" in base:
        return base.replace("{url}", page)
    return f"{base}{'&' if '?' in base else '?'}u={page}"


def from_ticketmaster(lat: float, lng: float, start: date, end: date, lang: str) -> list[dict]:
    params = urllib.parse.urlencode({
        "apikey": settings.TICKETMASTER_API_KEY, "latlong": f"{lat:.4f},{lng:.4f}", "radius": RADIUS_KM, "unit": "km",
        "startDateTime": f"{start.isoformat()}T00:00:00Z", "endDateTime": f"{end.isoformat()}T23:59:59Z",
        "size": 60, "sort": "date,asc", "locale": "*",
    })
    data = _get(f"{TICKETMASTER}?{params}")
    out = []
    for e in (data.get("_embedded") or {}).get("events", []):
        venue = ((e.get("_embedded") or {}).get("venues") or [{}])[0]
        loc = venue.get("location") or {}
        try:
            vlat, vlng = float(loc["latitude"]), float(loc["longitude"])
        except (KeyError, TypeError, ValueError):
            continue
        dates = e.get("dates") or {}
        st = dates.get("start") or {}
        if (dates.get("status") or {}).get("code") in ("cancelled", "postponed"):
            continue
        ranges = e.get("priceRanges") or []
        low = min((r.get("min") for r in ranges if r.get("min") is not None), default=None)
        high = max((r.get("max") for r in ranges if r.get("max") is not None), default=None)
        cls = (e.get("classifications") or [{}])[0]
        words = [(cls.get(k) or {}).get("name", "") for k in ("segment", "genre", "subGenre")]
        start_at = st.get("dateTime") or (f"{st['localDate']}T{st.get('localTime', '00:00:00')}" if st.get("localDate") else None)
        if not start_at or not e.get("url"):
            continue
        images = sorted(e.get("images") or [], key=lambda i: abs((i.get("width") or 0) - 640))
        out.append({
            "id": f"tm:{e.get('id')}",
            "source": "Ticketmaster",
            "name": e.get("name", ""),
            "start": start_at,
            "end": (dates.get("end") or {}).get("dateTime"),
            "all_day": bool(st.get("dateTBD") or st.get("noSpecificTime") or (st.get("localDate") and not st.get("localTime"))),
            "venue": venue.get("name", ""),
            "lat": vlat, "lng": vlng,
            "description": _strip(e.get("info") or e.get("description") or " · ".join(w for w in words if w and w != "Undefined")),
            "url": affiliate_link(e["url"]),
            "sponsored": bool(settings.TICKETMASTER_AFFILIATE_LINK),
            "price": {"free": (high == 0) if high is not None else None, "text": "", "min": low, "max": high,
                      "currency": (ranges[0].get("currency") if ranges else "") or ""},
            "interests": interests_of(words + [e.get("name", "")]),
            "image": images[0].get("url", "") if images else "",
        })
    return out


def _day(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).date()
    except ValueError:
        try:
            return date.fromisoformat(value[:10])
        except ValueError:
            return None


def find(lat: float, lng: float, start: date, end: date, lang: str) -> dict:
    lang = lang if lang in LANGS else "en"
    key = "events7:" + hashlib.sha256(f"{lat:.2f}|{lng:.2f}|{start}|{end}|{lang}".encode()).hexdigest()
    hit = cache.get(key)
    if hit is not None:
        return hit
    found, sources = [], []
    providers = []
    if inside(lat, lng, LINKED_AREA):
        providers.append(("Linked Events", from_linked_events))
    if settings.TICKETMASTER_API_KEY and inside(lat, lng, TICKETMASTER_COUNTRIES):
        providers.append(("Ticketmaster", from_ticketmaster))
    for name, provider in providers:
        try:
            found += provider(lat, lng, start, end, lang)
            sources.append(name)
        except Exception:  # one source down: the others still show
            logger.warning("Events from %s failed", name, exc_info=True)
    events, seen = [], set()
    for e in found:
        first, last = _day(e["start"]), _day(e.get("end")) or _day(e["start"])
        if not first or not e["name"] or not e["url"].startswith(("https://", "http://")):
            continue
        if last < start or first > end:  # only what happens during the stay
            continue
        if (last - first).days > LONGEST_DAYS:  # permanent collections and standing offers aren't events
            continue
        dist = km_between(lat, lng, float(e["lat"]), float(e["lng"]))
        if dist > RADIUS_KM:
            continue
        dedupe = (e["name"].strip().lower(), first)
        if dedupe in seen:
            continue
        seen.add(dedupe)
        events.append({**e, "km": round(dist, 1), "sponsored": bool(e.get("sponsored")), "_long": (last - first).days > 3})
    # Each day of the stay gets its share (nearest first), then long-running ones such as
    # exhibitions, so a busy first day doesn't push the rest of the stay off the list.
    events.sort(key=lambda e: (e["_long"], max(_day(e["start"]), start), e["km"]))
    per_day: dict = {}
    chosen = []
    for e in events:
        group = "long" if e["_long"] else max(_day(e["start"]), start)
        per_day[group] = per_day.get(group, 0) + 1
        if per_day[group] <= (LONG_SHOWN if group == "long" else PER_DAY):
            chosen.append(e)
    for e in chosen:
        del e["_long"]
    chosen = chosen[:MAX_EVENTS]
    answer = {"events": chosen, "sources": sources, "covered": bool(providers), "affiliate": any(e["sponsored"] for e in chosen)}
    cache.set(key, answer, CACHE_SECONDS)
    return answer


class QuerySerializer(serializers.Serializer):
    lat = serializers.FloatField(min_value=50, max_value=72)
    lng = serializers.FloatField(min_value=-26, max_value=35)
    to = serializers.DateField()
    lang = serializers.CharField(max_length=2, required=False, default="en")

    def to_internal_value(self, data):
        # "from" is a Python keyword: read it here instead of as a field name.
        values = super().to_internal_value(data)
        try:
            values["start"] = date.fromisoformat(str(data.get("from", "")))
        except ValueError as e:
            raise serializers.ValidationError({"from": "Use YYYY-MM-DD."}) from e
        return values

    def validate(self, attrs):
        if attrs["to"] < attrs["start"]:
            raise serializers.ValidationError({"to": "Departure comes after arrival."})
        if (attrs["to"] - attrs["start"]).days > MAX_STAY_DAYS:
            raise serializers.ValidationError({"to": f"At most {MAX_STAY_DAYS} days."})
        if attrs["to"] < date.today() - timedelta(days=1):
            raise serializers.ValidationError({"to": "The stay is in the past."})
        return attrs


class EventsView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [EventsThrottle]

    def get(self, request):
        q = QuerySerializer(data=request.query_params)
        q.is_valid(raise_exception=True)
        v = q.validated_data
        res = Response(find(v["lat"], v["lng"], v["start"], v["to"], v["lang"]))
        res["Cache-Control"] = "public, max-age=1800"
        return res

"""Finding an address on the map for the listing editor's suggested pin.

The owner's address (and town) go to OpenStreetMap's Nominatim, limited to the cottage's
country. The answer is only a suggestion: the editor shows it, and the coordinates are saved
only when the owner confirms or moves the pin. Answers are cached for 30 days, so the same
address isn't asked twice; Nominatim's rules ask for at most one request a second, a real
User-Agent, and caching (https://operations.osmfoundation.org/policies/nominatim/).
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
import urllib.parse
import urllib.request

from django.conf import settings
from django.core.cache import cache
from rest_framework import serializers
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView

from .portal import IsOwner

logger = logging.getLogger(__name__)

SEARCH = "https://nominatim.openstreetmap.org/search"
CACHE_DAYS = 30
_lock = threading.Lock()
_last = [0.0]


class GeocodeThrottle(UserRateThrottle):
    scope = "geocode"


class QuerySerializer(serializers.Serializer):
    address = serializers.CharField(max_length=200, allow_blank=True, default="")
    municipality = serializers.CharField(max_length=80, allow_blank=True, default="")
    country = serializers.ChoiceField(choices=["FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT"])


def search(address: str, municipality: str, country: str) -> dict | None:
    """{lat, lng, label} for the best match in the country, or None."""
    query = ", ".join(part.strip() for part in (address, municipality) if part.strip())
    if not query:
        return None
    key = "geocode:" + hashlib.sha256(f"{country}|{query.lower()}".encode()).hexdigest()
    hit = cache.get(key)
    if hit is not None:
        return hit or None
    params = urllib.parse.urlencode({
        "q": query, "countrycodes": "ax," + country.lower() if country == "FI" else country.lower(),
        "format": "jsonv2", "limit": 1, "addressdetails": 0,
    })
    req = urllib.request.Request(f"{SEARCH}?{params}", headers={
        "User-Agent": f"Rantio listing editor ({settings.DEFAULT_FROM_EMAIL})", "Accept-Language": "en",
    })
    with _lock:  # one request a second from this server process
        wait = 1.0 - (time.monotonic() - _last[0])
        if wait > 0:
            time.sleep(wait)
        _last[0] = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=8) as resp:
            rows = json.loads(resp.read())
    except Exception:  # an outage only means no suggestion; the owner can still place the pin
        logger.warning("Geocoding failed for a %s address", country, exc_info=True)
        return None
    found = None
    if rows:
        row = rows[0]
        found = {"lat": round(float(row["lat"]), 6), "lng": round(float(row["lon"]), 6),
                 "label": row.get("display_name", "")[:200]}
    cache.set(key, found or {}, CACHE_DAYS * 86400)
    return found


class GeocodeView(APIView):
    """GET ?address=&municipality=&country=FI → {found, lat, lng, label}: a suggested pin."""

    permission_classes = [IsOwner]
    throttle_classes = [GeocodeThrottle]

    def get(self, request):
        q = QuerySerializer(data=request.query_params)
        q.is_valid(raise_exception=True)
        found = search(q.validated_data["address"], q.validated_data["municipality"], q.validated_data["country"])
        return Response({"found": True, **found} if found else {"found": False})

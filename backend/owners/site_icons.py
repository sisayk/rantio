"""Listing sites' icons (Airbnb, Booking.com…) served from Rantio itself.

The pages used to load each icon straight from Google's favicon service, which showed
every visitor's IP address to Google. Now the server fetches an icon once, keeps it for
a month and serves it, so visitors' browsers only talk to rantio.fi. Only the sites in
SITES can be fetched (keep it in step with CHANNELS in frontend/src/lib/catalog.ts).
"""

import logging
import urllib.request

from django.core.cache import cache
from django.http import Http404, HttpResponse

logger = logging.getLogger(__name__)

SITES = {
    "airbnb": "airbnb.com",
    "booking": "booking.com",
    "vrbo": "vrbo.com",
    "expedia": "expedia.com",
    "agoda": "agoda.com",
    "google": "google.com",
    "holidu": "holidu.com",
    "hometogo": "hometogo.com",
    "nettimokki": "nettimokki.com",
    "lomarengas": "lomarengas.fi",
    "novasol": "novasol.com",
    "stugsommar": "stugsommar.se",
    "finn": "finn.no",
    "inatur": "inatur.no",
    "dancenter": "dancenter.com",
    "sologstrand": "sologstrand.dk",
}
KEEP = 60 * 60 * 24 * 30  # a month
RETRY = 60 * 60  # after a failed fetch, try again in an hour
MAX_BYTES = 200_000


def fetch(domain: str) -> tuple[bytes, str] | None:
    url = f"https://www.google.com/s2/favicons?domain={domain}&sz=64"
    try:
        with urllib.request.urlopen(url, timeout=10) as res:  # noqa: S310 (fixed https URL, allow-listed domain)
            kind = res.headers.get_content_type()
            body = res.read(MAX_BYTES + 1)
    except Exception:  # noqa: BLE001 — no icon is fine; the page shows the site's name anyway
        logger.warning("Could not fetch the icon for %s", domain)
        return None
    if not kind.startswith("image/") or len(body) > MAX_BYTES:
        return None
    return body, kind


def site_icon(request, site: str):
    domain = SITES.get(site)
    if not domain:
        raise Http404
    key = f"site-icon:{site}"
    hit = cache.get(key)
    if hit is None:
        got = fetch(domain)
        hit = got or (b"", "")
        cache.set(key, hit, KEEP if got else RETRY)
    body, kind = hit
    if not body:
        raise Http404
    res = HttpResponse(body, content_type=kind)
    res["Cache-Control"] = "public, max-age=604800"  # a week in the browser
    return res

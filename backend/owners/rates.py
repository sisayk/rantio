"""Exchange rates: the European Central Bank's daily reference rates for the kronor Rantio uses.

The ECB publishes once each working day around 16:00 CET. Stored rates are refreshed
when they are older than REFRESH_AFTER; if the ECB can't be reached the stored ones
(or, before the first fetch, FALLBACK) are used and the next try waits RETRY_AFTER.
"""

import logging
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.core.cache import cache
from django.utils import timezone

from .models import CENT, CURRENCIES, ExchangeRate

log = logging.getLogger(__name__)

ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml"
REFRESH_AFTER = timedelta(hours=12)
RETRY_AFTER = 60 * 60  # seconds
TIMEOUT = 6

# Units per 1 EUR (ECB, 28 Oct 2026); only used until the first successful fetch.
FALLBACK = {"EUR": Decimal("1"), "SEK": Decimal("11.056"), "NOK": Decimal("10.3475"),
            "DKK": Decimal("7.4741"), "ISK": Decimal("135.8")}


def fetch_ecb() -> tuple[date, dict[str, Decimal]]:
    with urllib.request.urlopen(ECB_URL, timeout=TIMEOUT) as res:  # noqa: S310 (fixed https URL)
        root = ET.fromstring(res.read())
    day, rates = None, {}
    for el in root.iter():
        if el.tag.endswith("Cube") and "time" in el.attrib:
            day = date.fromisoformat(el.attrib["time"])
        if el.tag.endswith("Cube") and el.attrib.get("currency") in CURRENCIES:
            rates[el.attrib["currency"]] = Decimal(el.attrib["rate"])
    if not day or not rates:
        raise ValueError("ECB file had no rates")
    return day, rates


def refresh() -> bool:
    """Fetch and store today's rates. False if the ECB couldn't be reached."""
    try:
        day, rates = fetch_ecb()
    except Exception as err:  # network, timeout, bad XML: keep what we have
        log.warning("Exchange rates not refreshed: %s", err)
        return False
    now = timezone.now()
    for code, per_eur in rates.items():
        ExchangeRate.objects.update_or_create(currency=code, defaults={"per_eur": per_eur, "rate_date": day, "fetched_at": now})
    return True


def current() -> tuple[dict[str, Decimal], str | None]:
    """Units per 1 EUR for every currency, and the ECB date they're from (None: built-in fallback)."""
    stored = list(ExchangeRate.objects.all())
    stale = not stored or min(r.fetched_at for r in stored) < timezone.now() - REFRESH_AFTER
    if stale and cache.add("rates:trying", True, RETRY_AFTER) and refresh():
        stored = list(ExchangeRate.objects.all())
    rates = {**FALLBACK, **{r.currency: r.per_eur for r in stored}, "EUR": Decimal("1")}
    day = max((r.rate_date for r in stored), default=None)
    return rates, day.isoformat() if day else None


def convert(amount: Decimal, frm: str, to: str, rates: dict[str, Decimal]) -> Decimal:
    if frm == to:
        return amount
    return (amount / rates[frm] * rates[to]).quantize(CENT, rounding=ROUND_HALF_UP)

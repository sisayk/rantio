"""Nightly prices: what one night at a cottage costs on Rantio's own pages and booking link.

For each night, in this order:
  1. a price the owner set for that date (NightPrice): always wins;
  2. smart pricing, when the owner has turned it on: the usual price adjusted for demand,
     kept between the owner's lowest and highest price;
  3. the usual price: a seasonal price if the night falls in one, else the Friday/Saturday
     price on those nights, else the price per night.

Smart pricing works like Airbnb's: it raises prices for Nordic holidays, busy weekends and
dates when many cottages nearby are booked, and lowers them for nights that would otherwise
stay empty (last-minute nights, gaps between stays shorter than the minimum stay). It only
uses Rantio's own data; the booking sites keep their own prices until a channel manager is
connected.
"""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.utils import timezone

from . import calendar
from .models import Cottage, NightPrice

ONE = Decimal("1")
# Round prices like people do: whole euros, tens of crowns, hundreds of Icelandic krónur.
ROUNDING = {"EUR": Decimal("1"), "SEK": Decimal("10"), "NOK": Decimal("10"), "DKK": Decimal("10"), "ISK": Decimal("100")}
# Without an owner's limits, smart pricing stays between these shares of the usual price.
DEFAULT_MIN = Decimal("0.75")
DEFAULT_MAX = Decimal("2.0")

WEEKEND = Decimal("1.15")      # Friday and Saturday nights, when the owner hasn't set a weekend price
JULY = Decimal("1.10")         # high summer, when no seasonal price of the owner's covers the night
DEMAND_HIGH = Decimal("1.20")  # 80 % or more of the cottages around are booked
DEMAND_UP = Decimal("1.10")    # 60 % or more
DEMAND_LOW = Decimal("0.95")   # 20 % or less, within the next 30 days
LAST_3 = Decimal("0.85")       # still free 3 days before
LAST_7 = Decimal("0.92")       # still free a week before
GAP = Decimal("0.85")          # a gap between stays too short for the minimum stay


@dataclass
class Night:
    date: date
    price: Decimal
    base: Decimal
    suggested: Decimal
    override: bool
    free: bool
    reasons: list[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {
            "date": self.date.isoformat(),
            "price": f"{self.price:.2f}",
            "base": f"{self.base:.2f}",
            "suggested": f"{self.suggested:.2f}",
            "override": self.override,
            "free": self.free,
            "reasons": self.reasons,
        }


# ---------- holidays ----------

def easter(year: int) -> date:
    """Western Easter Sunday (anonymous Gregorian algorithm)."""
    a, b, c = year % 19, year // 100, year % 100
    d, e = b // 4, b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i, k = c // 4, c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7  # noqa: E741
    m = (a + 11 * h + 22 * l) // 451
    month = (h + l - 7 * m + 114) // 31
    day = (h + l - 7 * m + 114) % 31 + 1
    return date(year, month, day)


def holiday(d: date, country: str) -> tuple[str, Decimal] | None:
    """The holiday a night falls in, by the cottage's country, and how much it lifts demand."""
    y = d.year
    # Christmas to New Year: the busiest cottage weeks of winter everywhere in the North.
    if (d.month == 12 and d.day >= 22) or (d.month == 1 and d.day == 1):
        return "christmas", Decimal("1.25")
    # Midsummer: Finland and Sweden on the Friday and Saturday between 19 and 26 June;
    # Norway, Denmark and the Baltics on 23 and 24 June (St John's Eve and Day).
    if d.month == 6:
        if country in ("FI", "SE"):
            friday = next(date(y, 6, n) for n in range(19, 26) if date(y, 6, n).weekday() == 4)
            if d in (friday - timedelta(days=1), friday, friday + timedelta(days=1)):
                return "midsummer", Decimal("1.30")
        elif d.day in (23, 24):
            return "midsummer", Decimal("1.25")
    # Easter: Maundy Thursday to Easter Monday.
    e = easter(y)
    if e - timedelta(days=3) <= d < e + timedelta(days=1):
        return "easter", Decimal("1.15")
    week = d.isocalendar().week
    # School winter holidays (ski weeks): weeks 7 to 10 in Finland, Sweden and Norway.
    if country in ("FI", "SE", "NO") and 7 <= week <= 10:
        return "winter_holiday", Decimal("1.10")
    # Autumn holiday week 42 in Finland, Sweden, Norway and Denmark.
    if country in ("FI", "SE", "NO", "DK") and week == 42:
        return "autumn_holiday", Decimal("1.10")
    return None


# ---------- the usual price ----------

def _in_season(d: date, start: str, end: str) -> bool:
    md = d.strftime("%m-%d")
    return start <= md <= end if start <= end else (md >= start or md <= end)  # a season can wrap the new year


def usual_price(c: Cottage, d: date) -> tuple[Decimal, list[str]]:
    for s in c.seasonal_prices or []:
        try:
            if _in_season(d, s["start"], s["end"]):
                return Decimal(str(s["price"])), ["season"]
        except (KeyError, TypeError, ValueError, ArithmeticError):
            continue
    if c.weekend_price and d.weekday() in (4, 5):
        return c.weekend_price, ["weekend"]
    return c.price_per_night, []


def round_price(value: Decimal, currency: str) -> Decimal:
    step = ROUNDING.get(currency, ONE)
    return ((value / step).quantize(ONE, rounding=ROUND_HALF_UP) * step).quantize(Decimal("0.01"))


def limits(c: Cottage) -> tuple[Decimal, Decimal]:
    low = c.smart_min_price if c.smart_min_price is not None else c.price_per_night * DEFAULT_MIN
    high = c.smart_max_price if c.smart_max_price is not None else c.price_per_night * DEFAULT_MAX
    return low, max(low, high)


# ---------- demand ----------

def _busy_nights(cottages: list[Cottage], start: date, end: date) -> dict[int, set[date]]:
    busy: dict[int, set[date]] = defaultdict(set)
    for e in calendar.entries(cottages, start, end, requests=False):
        if not e.busy:
            continue
        d = max(e.start, start)
        while d < min(e.end, end):
            busy[e.cottage_id].add(d)
            d += timedelta(days=1)
    return busy


def _neighbours(c: Cottage) -> list[Cottage]:
    """Other Rantio cottages in the same region (or country, when no region is set)."""
    qs = Cottage.objects.filter(country=c.country).exclude(pk=c.pk).exclude(status=Cottage.Status.ARCHIVED)
    if c.region:
        qs = qs.filter(region=c.region)
    return list(qs.only("pk"))


def _gap_nights(busy: set[date], start: date, end: date, min_nights: int) -> set[date]:
    """Free nights between two busy ones, in a stretch shorter than the minimum stay."""
    gaps: set[date] = set()
    d = start
    while d < end:
        if d in busy or (d - timedelta(days=1)) not in busy:
            d += timedelta(days=1)
            continue
        run = []
        while d < end and d not in busy:
            run.append(d)
            d += timedelta(days=1)
        if d < end and len(run) < min_nights:
            gaps.update(run)
    return gaps


# ---------- nights ----------

def nights(c: Cottage, start: date, end: date, *, today: date | None = None) -> list[Night]:
    """Each night in [start, end) with its price and why."""
    today = today or timezone.localdate()
    overrides = {p.date: p.price for p in NightPrice.objects.filter(cottage=c, date__gte=start, date__lt=end)}
    # Look a little past the ends so a gap at the edge of the range is still seen.
    look_start, look_end = start - timedelta(days=14), end + timedelta(days=14)
    own = _busy_nights([c], look_start, look_end).get(c.pk, set())
    gaps = _gap_nights(own, look_start, look_end, max(1, c.min_nights))
    others = _neighbours(c)
    others_busy = _busy_nights(others, start, end) if others else {}
    low, high = limits(c)
    out = []
    d = start
    while d < end:
        base, why = usual_price(c, d)
        free = d not in own
        factor, smart_why = ONE, []
        if "weekend" not in why and "season" not in why and d.weekday() in (4, 5):
            factor *= WEEKEND
            smart_why.append("weekend")
        h = holiday(d, c.country)
        if h:
            factor *= h[1]
            smart_why.append(h[0])
        elif d.month == 7 and "season" not in why:
            factor *= JULY
            smart_why.append("summer")
        if len(others) >= 3:
            share = sum(1 for o in others if d in others_busy.get(o.pk, ())) / len(others)
            if share >= 0.8:
                factor *= DEMAND_HIGH
                smart_why.append("demand_high")
            elif share >= 0.6:
                factor *= DEMAND_UP
                smart_why.append("demand_up")
            elif share <= 0.2 and (d - today).days <= 30:
                factor *= DEMAND_LOW
                smart_why.append("demand_low")
        if free:
            ahead = (d - today).days
            if 0 <= ahead <= 3:
                factor *= LAST_3
                smart_why.append("last_minute")
            elif 0 <= ahead <= 7:
                factor *= LAST_7
                smart_why.append("last_minute")
            if d in gaps:
                factor *= GAP
                smart_why.append("gap")
        suggested = base * factor
        if suggested < low:
            suggested, smart_why = low, smart_why + ["min"]
        elif suggested > high:
            suggested, smart_why = high, smart_why + ["max"]
        suggested = round_price(suggested, c.currency)
        base = round_price(base, c.currency)
        if d in overrides:
            out.append(Night(d, overrides[d], base, suggested, True, free, ["override"]))
        elif c.smart_pricing:
            out.append(Night(d, suggested, base, suggested, False, free, ["smart", *why, *smart_why]))
        else:
            out.append(Night(d, base, base, suggested, False, free, why))
        d += timedelta(days=1)
    return out


def quote(c: Cottage, check_in: date, check_out: date) -> dict:
    """A stay's price: the nights, a weekly or monthly discount, cleaning."""
    rows = nights(c, check_in, check_out)
    subtotal = sum((n.price for n in rows), Decimal("0"))
    count = len(rows)
    pct = c.monthly_discount if count >= 28 and c.monthly_discount else c.weekly_discount if count >= 7 else 0
    discount = (subtotal * Decimal(pct) / 100).quantize(Decimal("0.01"))
    total = subtotal - discount + c.cleaning_fee
    return {
        "currency": c.currency,
        "nights": [{"date": n.date.isoformat(), "price": f"{n.price:.2f}"} for n in rows],
        "subtotal": f"{subtotal:.2f}",
        "discount_percent": pct,
        "discount": f"{discount:.2f}",
        "cleaning_fee": f"{c.cleaning_fee:.2f}",
        "total": f"{total:.2f}",
    }

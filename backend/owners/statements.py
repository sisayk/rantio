"""What an owner sees on their dashboard: earnings, Rantio's share and stays, per calendar year.

A stay counts in the year (and month) of its check-in day. Yearly fees count in the
year their listing year starts.

Money is shown in the owner's currency: the one their cottages are in (a Swedish
owner sees kronor). Rantio's yearly fee is set in euros; it is listed in euros and
counted in the totals at the day's ECB rate.
"""

from collections import Counter, defaultdict
from datetime import date
from decimal import Decimal

from . import rates as fx
from .models import Booking, Cottage, Owner, vat_on

ZERO = Decimal("0.00")


def money(value: Decimal) -> str:
    return f"{value:.2f}"


def owner_currency(cottages: list[Cottage]) -> str:
    """The currency most of the owner's cottages are in (EUR before they have any)."""
    counts = Counter(c.currency for c in cottages)
    return counts.most_common(1)[0][0] if counts else "EUR"


def bookings_for(owner: Owner, year: int):
    return (
        Booking.objects.filter(cottage__owner=owner, check_in__year=year)
        .select_related("cottage", "cottage__owner")
        .order_by("check_in")
    )


def booking_row(b: Booking, today: date) -> dict:
    return {
        "id": b.pk,
        "cottage": b.cottage.name,
        "cottage_id": b.cottage_id,
        "channel": b.channel,
        "channel_label": b.get_channel_display(),
        "check_in": b.check_in.isoformat(),
        "check_out": b.check_out.isoformat(),
        "nights": b.nights,
        "guests": b.guests,
        "payout": money(b.owner_payout),
        "currency": b.cottage.currency,
        "charged": b.is_chargeable,
        "commission": money(b.commission),
        "commission_vat": money(b.commission_vat),
        "cancelled": b.cancelled,
        "staying_now": not b.cancelled and b.check_in <= today < b.check_out,
    }


def fees_for(cottage: Cottage, year: int) -> list[dict]:
    """Yearly fees whose listing year starts in this calendar year."""
    if not cottage.listing_started_on:
        return []
    fees, n = [], 1
    while (starts := cottage.listing_year_starts_on(n)).year <= year:
        if starts.year == year:
            fee = cottage.yearly_fee(n)
            fees.append({"listing_year": n, "starts_on": starts, "fee": fee, "vat": vat_on(fee)})
        n += 1
    return fees


def summary(owner: Owner, year: int, today: date) -> dict:
    cottages = list(owner.cottages.all())
    bookings = list(bookings_for(owner, year))
    active = [b for b in bookings if not b.cancelled]
    currency = owner_currency(cottages)
    needs_rates = currency != "EUR" or any(c.currency != currency for c in cottages)
    rates, rate_date = fx.current() if needs_rates else ({}, None)

    def mine(amount: Decimal, frm: str) -> Decimal:
        """An amount in the owner's currency."""
        return fx.convert(amount, frm, currency, rates)

    months = [{"month": m, "stugora": ZERO, "own": ZERO, "nights": 0} for m in range(1, 13)]
    channels: dict[str, dict] = {}
    per_cottage = defaultdict(lambda: {"nights": 0, "payout": ZERO, "bookings": 0})
    totals = defaultdict(lambda: ZERO)

    for b in active:
        payout, commission, commission_vat = (mine(v, b.cottage.currency) for v in (b.owner_payout, b.commission, b.commission_vat))
        m = months[b.check_in.month - 1]
        m["stugora" if b.is_chargeable else "own"] += payout
        m["nights"] += b.nights
        c = channels.setdefault(
            b.channel,
            {"channel": b.channel, "label": b.get_channel_display(), "charged": b.is_chargeable,
             "bookings": 0, "nights": 0, "payout": ZERO, "commission": ZERO},
        )
        c["bookings"] += 1
        c["nights"] += b.nights
        c["payout"] += payout
        c["commission"] += commission
        pc = per_cottage[b.cottage_id]
        pc["nights"] += b.nights
        pc["payout"] += payout
        pc["bookings"] += 1
        totals["payout"] += payout
        totals["payout_stugora" if b.is_chargeable else "payout_own"] += payout
        totals["commission"] += commission
        totals["commission_vat"] += commission_vat

    fee_rows = []
    for cottage in cottages:
        for f in fees_for(cottage, year):
            fee_rows.append({"cottage": cottage.name, **f})
            totals["fees"] += mine(f["fee"], "EUR")
            totals["fees_vat"] += mine(f["vat"], "EUR")
    stugora_total = totals["commission"] + totals["commission_vat"] + totals["fees"] + totals["fees_vat"]

    cottage_rows = []
    for cottage in cottages:
        start = max(date(year, 1, 1), cottage.listing_started_on or date(year, 1, 1))
        open_days = max((date(year + 1, 1, 1) - start).days, 0) if cottage.status == Cottage.Status.LIVE else 0
        listing_year = cottage.listing_year_on(today)
        next_fee_on = cottage.listing_year_starts_on(listing_year + 1) if listing_year else None
        pc = per_cottage[cottage.pk]
        cottage_rows.append({
            "id": cottage.pk,
            "name": cottage.name,
            "municipality": cottage.municipality,
            "country": cottage.country,
            "status": cottage.status,
            "status_label": cottage.get_status_display(),
            "currency": cottage.currency,
            "price_per_night": money(cottage.price_per_night),
            "listing_started_on": cottage.listing_started_on.isoformat() if cottage.listing_started_on else None,
            "listing_year": listing_year,
            "next_fee_on": next_fee_on.isoformat() if next_fee_on else None,
            "next_fee": money(cottage.yearly_fee(listing_year + 1)) if listing_year else None,
            "bookings": pc["bookings"],
            "nights": pc["nights"],
            "payout": money(pc["payout"]),
            "occupancy": round(pc["nights"] / open_days, 3) if open_days else None,
        })

    upcoming = (
        Booking.objects.filter(cottage__owner=owner, cancelled=False, check_out__gt=today)
        .select_related("cottage", "cottage__owner")
        .order_by("check_in")[:6]
    )
    first = Booking.objects.filter(cottage__owner=owner).order_by("check_in").values_list("check_in", flat=True).first()
    years = list(range(min(first.year if first else today.year, today.year), max(today.year, year) + 2))

    return {
        "owner": {
            "name": owner.name,
            "first_name": owner.name.split()[0] if owner.name else "",
            "email": owner.email,
            "language": owner.language,
            "is_pilot": owner.is_pilot,
            "commission_rate": f"{owner.commission_rate:.2f}",
        },
        "currency": currency,
        "fee_currency": "EUR",
        "rate": {"per_eur": f"{rates[currency]}", "date": rate_date} if currency != "EUR" else None,
        "year": year,
        "years": years,
        "today": today.isoformat(),
        "totals": {
            "bookings": len(active),
            "nights": sum(b.nights for b in active),
            "cancelled": len(bookings) - len(active),
            **{k: money(totals[k]) for k in
               ["payout", "payout_stugora", "payout_own", "commission", "commission_vat", "fees", "fees_vat"]},
            "stugora_total": money(stugora_total),
            "net": money(totals["payout"] - stugora_total),
        },
        "months": [{**m, "stugora": money(m["stugora"]), "own": money(m["own"])} for m in months],
        "channels": sorted(
            ({**c, "payout": money(c["payout"]), "commission": money(c["commission"])} for c in channels.values()),
            key=lambda c: Decimal(c["payout"]),
            reverse=True,
        ),
        "cottages": cottage_rows,
        "fees": [{**f, "starts_on": f["starts_on"].isoformat(), "fee": money(f["fee"]), "vat": money(f["vat"]),
                  "fee_local": money(mine(f["fee"] + f["vat"], "EUR"))} for f in fee_rows],
        "upcoming": [booking_row(b, today) for b in upcoming],
    }

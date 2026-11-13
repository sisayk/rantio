"""Monthly commission invoices.

Each month, one invoice per owner, with Finnish VAT, in the owner's currency (the one most
of their cottages are in: kronor for a Swedish owner):
- commission on stays from the channels Rantio added, by check-in day (as on the
  owner's dashboard). Nettimökki and the owner's own bookings are never charged.
  Airbnb stays are left off when Airbnb pays Rantio directly as co-host.
- yearly fees whose listing year starts that month (pilot owners' first year is free),
  the set amount in the cottage's currency (models.YEARLY_FEES).

Anything in another currency than the invoice's (an owner with cottages in two
countries) is converted at the ECB rate of the day the invoice is made. Invoices start as drafts; stripe_api.send() sends them.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db.models import Q
from django.db import transaction

from . import rates as fx
from .models import Booking, Invoice, Owner, add_months, vat_on
from .statements import owner_currency

ZERO = Decimal("0.00")


def pct(rate: Decimal) -> str:
    return str(int(rate)) if rate == int(rate) else str(rate.normalize()).replace(".", ",")


def month_start(day: date) -> date:
    return day.replace(day=1)


def previous_month(today: date) -> date:
    return add_months(month_start(today), -1)


def lines_for(owner: Owner, month: date, rates: dict, currency: str = "EUR") -> list[dict]:
    start, end = month_start(month), add_months(month_start(month), 1)
    bookings = (
        Booking.objects.filter(cottage__owner=owner, check_in__gte=start, check_in__lt=end, cancelled=False)
        .exclude(channel__in=Booking.UNCHARGED_CHANNELS)
        .select_related("cottage", "cottage__owner")
        .order_by("check_in")
    )
    if owner.airbnb_cohost_payout:
        bookings = bookings.exclude(channel=Booking.Channel.AIRBNB)
    lines = []
    for b in bookings:
        if b.commission <= 0:
            continue
        amount = fx.convert(b.commission, b.currency, currency, rates)
        lines.append({
            "kind": "commission",
            "booking": b.pk,
            "description": f"{pct(owner.commission_rate)} % commission · {b.cottage.name} · "
                           f"{b.get_channel_display()} · {b.check_in:%-d.%-m.}–{b.check_out:%-d.%-m.%Y}",
            "amount": str(amount),
            "original": f"{b.commission} {b.currency}" if b.currency != currency else "",
        })
    for cottage in owner.cottages.exclude(listing_started_on=None):
        n = 1
        while (starts := cottage.listing_year_starts_on(n)) < end:
            fee = cottage.yearly_fee(n)
            if starts >= start and fee > 0:
                lines.append({
                    "kind": "yearly_fee",
                    "cottage": cottage.pk,
                    "description": f"Yearly fee · {cottage.name} · listing year {n} from {starts:%-d.%-m.%Y}",
                    "amount": str(fx.convert(fee, cottage.currency, currency, rates)),
                    "original": f"{fee} {cottage.currency}" if cottage.currency != currency else "",
                })
            n += 1
    return lines


def _next_number(year: int) -> str:
    prefix = f"STG-{year}-"
    last = Invoice.objects.filter(number__startswith=prefix).order_by("-number").values_list("number", flat=True).first()
    return f"{prefix}{int(last.rsplit('-', 1)[1]) + 1 if last else 1:04d}"


@transaction.atomic
def build(owner: Owner, month: date, rates: tuple[dict, str | None] | None = None) -> Invoice | None:
    """Make (or refresh, while still a draft) the owner's invoice for the month. None when nothing is due."""
    month = month_start(month)
    table, rates_day = rates or fx.current()
    invoice = Invoice.objects.select_for_update().filter(owner=owner, month=month).first()
    if invoice and invoice.status != Invoice.Status.DRAFT:
        return invoice
    currency = owner_currency(list(owner.cottages.all()))
    lines = lines_for(owner, month, table, currency)
    if not lines:
        if invoice:
            invoice.delete()
        return None
    subtotal = sum((Decimal(x["amount"]) for x in lines), ZERO)
    if invoice is None:
        invoice = Invoice(owner=owner, month=month, number=_next_number(month.year))
    invoice.currency = currency
    invoice.lines = lines
    invoice.subtotal = subtotal
    invoice.vat = vat_on(subtotal)
    invoice.total = subtotal + invoice.vat
    invoice.rates_date = (rates_day or "") if any(x["original"] for x in lines) else ""
    invoice.save()
    return invoice


def build_all(month: date) -> list[Invoice]:
    rates = fx.current()
    # Closed accounts too (is_host False, cottages kept): stays before the account was deleted are still owed.
    owners = Owner.objects.filter(Q(is_host=True) | Q(cottages__isnull=False)).distinct()
    return [inv for owner in owners if (inv := build(owner, month, rates))]

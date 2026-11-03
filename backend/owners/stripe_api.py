"""Sending invoices through Stripe, with plain HTTPS calls (no extra package).

Flow per invoice: make sure the owner is a Stripe customer, create an empty invoice, add
one item per line and finalize it. An owner who saved a card at sign-up (owners/trial.py)
is charged on it; otherwise the invoice is sent (due in INVOICE_DAYS_UNTIL_DUE days) and
Stripe emails a payment page (card, bank transfer, MobilePay where enabled). Without
STRIPE_SECRET_KEY nothing is sent and invoices stay drafts.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from decimal import Decimal

from django.conf import settings
from django.utils import timezone

from .invoicing import pct
from .models import VAT_RATE, Invoice, Owner

API = "https://api.stripe.com/v1"


class StripeError(Exception):
    pass


def enabled() -> bool:
    return bool(settings.STRIPE_SECRET_KEY)


def _flatten(data: dict, prefix: str = "") -> list[tuple[str, str]]:
    out = []
    for key, value in data.items():
        name = f"{prefix}[{key}]" if prefix else key
        if isinstance(value, dict):
            out += _flatten(value, name)
        elif isinstance(value, (list, tuple)):
            for i, v in enumerate(value):
                out += _flatten(v, f"{name}[{i}]") if isinstance(v, dict) else [(f"{name}[{i}]", str(v))]
        elif value is not None:
            out.append((name, str(value).lower() if isinstance(value, bool) else str(value)))
    return out


def _post(path: str, data: dict | None = None, idempotency_key: str | None = None) -> dict:
    body = urllib.parse.urlencode(_flatten(data or {})).encode()
    req = urllib.request.Request(f"{API}{path}", data=body, method="POST")
    req.add_header("Authorization", f"Bearer {settings.STRIPE_SECRET_KEY}")
    if idempotency_key:
        req.add_header("Idempotency-Key", idempotency_key)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            message = json.loads(e.read()).get("error", {}).get("message", "")
        except ValueError:
            message = ""
        raise StripeError(f"Stripe {path}: {e.code} {message}") from e


post = _post


def get(path: str, params: dict | None = None) -> dict:
    query = urllib.parse.urlencode(_flatten(params or {}))
    req = urllib.request.Request(f"{API}{path}{'?' + query if query else ''}")
    req.add_header("Authorization", f"Bearer {settings.STRIPE_SECRET_KEY}")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise StripeError(f"Stripe {path}: {e.code}") from e


def cents(amount: Decimal, currency: str = "EUR") -> int:
    """Stripe's smallest unit. Icelandic krónur have no öre: Stripe still wants two decimals,
    but in whole krónur (a multiple of 100)."""
    if currency.upper() == "ISK":
        return int(amount.quantize(Decimal("1"))) * 100
    return int((amount * 100).quantize(Decimal("1")))


def payment_method(owner: Owner) -> str:
    """The card the owner saved at sign-up (owners/trial.py), if any."""
    if not owner.stripe_payment_method and owner.signup and owner.signup.stripe_payment_method:
        owner.stripe_payment_method = owner.signup.stripe_payment_method
        owner.save(update_fields=["stripe_payment_method"])
    return owner.stripe_payment_method


def ensure_customer(owner: Owner) -> str:
    # The customer made at sign-up holds the saved card.
    if not owner.stripe_customer_id and owner.signup and owner.signup.stripe_customer_id:
        owner.stripe_customer_id = owner.signup.stripe_customer_id
        owner.save(update_fields=["stripe_customer_id"])
    if not owner.stripe_customer_id:
        c = _post("/customers", {
            "email": owner.email, "name": owner.name, "phone": owner.phone or None,
            "preferred_locales": [owner.language], "metadata": {"stugora_owner": owner.pk},
        }, idempotency_key=f"customer-{owner.pk}")
        owner.stripe_customer_id = c["id"]
        owner.save(update_fields=["stripe_customer_id"])
    return owner.stripe_customer_id


def send(invoice: Invoice) -> Invoice:
    if not enabled():
        raise StripeError("STRIPE_SECRET_KEY is not set.")
    if invoice.status != Invoice.Status.DRAFT:
        return invoice
    customer = ensure_customer(invoice.owner)
    card = payment_method(invoice.owner)
    key = f"invoice-{invoice.number}-{invoice.subtotal}"
    # With a saved card the invoice is charged to it; otherwise Stripe emails a payment page.
    how = (
        {"collection_method": "charge_automatically", "default_payment_method": card}
        if card else {"collection_method": "send_invoice", "days_until_due": settings.INVOICE_DAYS_UNTIL_DUE}
    )
    inv = _post("/invoices", {
        "customer": customer, **how, "currency": invoice.currency.lower(), "pending_invoice_items_behavior": "exclude",
        "auto_advance": False, "description": f"Rantio {invoice.month:%m/%Y} · {invoice.number}",
        "metadata": {"stugora_invoice": invoice.number},
    }, idempotency_key=key)
    tax = [settings.STRIPE_TAX_RATE_ID] if settings.STRIPE_TAX_RATE_ID else None
    for i, line in enumerate(invoice.lines):
        _post("/invoiceitems", {
            "customer": customer, "invoice": inv["id"], "currency": invoice.currency.lower(),
            "amount": cents(Decimal(line["amount"]), invoice.currency), "description": line["description"], "tax_rates": tax,
        }, idempotency_key=f"{key}-item-{i}")
    if not tax:  # no tax rate set up in Stripe: VAT as its own line
        _post("/invoiceitems", {
            "customer": customer, "invoice": inv["id"], "currency": invoice.currency.lower(),
            "amount": cents(invoice.vat, invoice.currency), "description": f"ALV / VAT {pct(VAT_RATE)} %",
        }, idempotency_key=f"{key}-vat")
    final = _post(f"/invoices/{inv['id']}/finalize", {}, idempotency_key=f"{key}-finalize")
    failed = ""
    if card:
        try:
            final = _post(f"/invoices/{inv['id']}/pay", {}, idempotency_key=f"{key}-pay")
        except StripeError as e:  # declined card: the invoice stays open with its payment page
            failed = str(e)
    else:
        final = _post(f"/invoices/{inv['id']}/send", {}, idempotency_key=f"{key}-send")
    invoice.stripe_invoice_id = inv["id"]
    invoice.stripe_url = final.get("hosted_invoice_url") or ""
    invoice.status = Invoice.Status.PAID if final.get("status") == "paid" else Invoice.Status.SENT
    invoice.sent_at = timezone.now()
    invoice.save(update_fields=["stripe_invoice_id", "stripe_url", "status", "sent_at"])
    if failed:
        raise StripeError(f"The card was not charged ({failed}); pay page: {invoice.stripe_url}")
    return invoice

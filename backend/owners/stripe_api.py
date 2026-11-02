"""Sending invoices through Stripe, with plain HTTPS calls (no extra package).

Flow per invoice: make sure the owner is a Stripe customer, create an empty invoice
(send_invoice, due in INVOICE_DAYS_UNTIL_DUE days), add one item per line, finalize
and send. Stripe emails the owner a payment page (card, bank transfer, MobilePay
where enabled). Without STRIPE_SECRET_KEY nothing is sent and invoices stay drafts.
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


def cents(amount: Decimal) -> int:
    return int((amount * 100).quantize(Decimal("1")))


def ensure_customer(owner: Owner) -> str:
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
    key = f"invoice-{invoice.number}-{invoice.subtotal}"
    inv = _post("/invoices", {
        "customer": customer, "collection_method": "send_invoice", "currency": "eur",
        "days_until_due": settings.INVOICE_DAYS_UNTIL_DUE, "pending_invoice_items_behavior": "exclude",
        "auto_advance": False, "description": f"Rantio {invoice.month:%m/%Y} · {invoice.number}",
        "metadata": {"stugora_invoice": invoice.number},
    }, idempotency_key=key)
    tax = [settings.STRIPE_TAX_RATE_ID] if settings.STRIPE_TAX_RATE_ID else None
    for i, line in enumerate(invoice.lines):
        _post("/invoiceitems", {
            "customer": customer, "invoice": inv["id"], "currency": "eur",
            "amount": cents(Decimal(line["amount"])), "description": line["description"], "tax_rates": tax,
        }, idempotency_key=f"{key}-item-{i}")
    if not tax:  # no tax rate set up in Stripe: VAT as its own line
        _post("/invoiceitems", {
            "customer": customer, "invoice": inv["id"], "currency": "eur",
            "amount": cents(invoice.vat), "description": f"ALV / VAT {pct(VAT_RATE)} %",
        }, idempotency_key=f"{key}-vat")
    _post(f"/invoices/{inv['id']}/finalize", {}, idempotency_key=f"{key}-finalize")
    sent = _post(f"/invoices/{inv['id']}/send", {}, idempotency_key=f"{key}-send")
    invoice.stripe_invoice_id = inv["id"]
    invoice.stripe_url = sent.get("hosted_invoice_url") or ""
    invoice.status = Invoice.Status.SENT
    invoice.sent_at = timezone.now()
    invoice.save(update_fields=["stripe_invoice_id", "stripe_url", "status", "sent_at"])
    return invoice

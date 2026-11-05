"""Account: the profile photo, and the payment method Rantio's fees are charged to.

Payment method: the owner saves (or changes) a card or bank account on Stripe's own page, as at
sign-up (owners/trial.py). Nothing is charged there. When they come back, the new method becomes
the customer's default, so the next invoice is charged to it.
"""

import logging

from django.conf import settings
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import stripe_api, trial
from .media_checks import IMAGE_MAX, image_type
from .models import COUNTRY_CURRENCY, Owner
from .portal import IsAccount, IsOwner

logger = logging.getLogger(__name__)


# --- Profile photo ------------------------------------------------------------------------------

class ProfilePhotoView(APIView):
    """POST a photo (multipart "file"); DELETE removes it."""

    permission_classes = [IsAccount]

    def post(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return Response({"file": ["missing"]}, status=status.HTTP_400_BAD_REQUEST)
        if upload.size > IMAGE_MAX:
            return Response({"file": ["too_big"]}, status=status.HTTP_400_BAD_REQUEST)
        kind = image_type(upload.read(16))
        upload.seek(0)
        if not kind:
            return Response({"file": ["not_image"]}, status=status.HTTP_400_BAD_REQUEST)
        upload.name = f"photo.{'jpg' if kind == 'jpeg' else kind}"
        o = request.user.owner
        old = o.photo.name if o.photo else ""
        o.photo = upload
        o.save(update_fields=["photo"])
        if old:
            o.photo.storage.delete(old)
        return Response({"photo": o.photo.url}, status=status.HTTP_201_CREATED)

    def delete(self, request):
        o = request.user.owner
        if o.photo:
            o.photo.delete(save=False)
            o.photo = ""
            o.save(update_fields=["photo"])
        return Response({"photo": None})


# --- Payment method -----------------------------------------------------------------------------

def _customer(owner: Owner) -> str:
    """The owner's Stripe customer (the sign-up's, or a new one)."""
    if owner.stripe_customer_id:
        return owner.stripe_customer_id
    if owner.signup and owner.signup.stripe_customer_id:
        owner.stripe_customer_id = owner.signup.stripe_customer_id
    else:
        c = stripe_api.post("/customers", {
            "email": owner.email, "name": owner.name, "phone": owner.phone or None,
            "preferred_locales": [owner.language], "metadata": {"rantio_owner": owner.pk},
        }, idempotency_key=f"owner-customer-{owner.pk}")
        owner.stripe_customer_id = c["id"]
    owner.save(update_fields=["stripe_customer_id"])
    return owner.stripe_customer_id


def _method_id(owner: Owner) -> str:
    return owner.stripe_payment_method or (owner.signup.stripe_payment_method if owner.signup else "")


def _confirm(owner: Owner) -> None:
    """Came back from Stripe's page: the saved method becomes the default for invoices."""
    if not owner.stripe_checkout_id:
        return
    session = stripe_api.get(f"/checkout/sessions/{owner.stripe_checkout_id}", {"expand": ["setup_intent"]})
    intent = session.get("setup_intent") or {}
    method = intent.get("payment_method") if isinstance(intent, dict) else None
    if session.get("status") == "complete" and method:
        stripe_api.post(f"/customers/{_customer(owner)}", {"invoice_settings": {"default_payment_method": method}})
        owner.stripe_payment_method = method
    if session.get("status") in ("complete", "expired"):
        owner.stripe_checkout_id = ""
    owner.save(update_fields=["stripe_payment_method", "stripe_checkout_id"])


def describe(method_id: str) -> dict | None:
    """What the owner sees: the card's brand and last digits, or the bank account's."""
    if not method_id:
        return None
    pm = stripe_api.get(f"/payment_methods/{method_id}")
    kind = pm.get("type", "")
    if kind == "card":
        c = pm.get("card") or {}
        return {"kind": "card", "brand": c.get("brand", ""), "last4": c.get("last4", ""),
                "exp_month": c.get("exp_month"), "exp_year": c.get("exp_year")}
    if kind == "sepa_debit":
        return {"kind": "bank", "brand": "", "last4": (pm.get("sepa_debit") or {}).get("last4", ""), "exp_month": None, "exp_year": None}
    return {"kind": kind, "brand": "", "last4": "", "exp_month": None, "exp_year": None}


class PaymentMethodView(APIView):
    """GET the payment method Rantio's fees are charged to; POST {app} for Stripe's page to save a new one."""

    permission_classes = [IsOwner]

    def get(self, request):
        o = request.user.owner
        if not trial.enabled():
            return Response({"available": False, "method": None})
        try:
            _confirm(o)
            method = describe(_method_id(o))
        except stripe_api.StripeError:
            logger.exception("Could not read the payment method of owner %s", o.pk)
            return Response({"detail": "stripe_failed"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"available": True, "method": method})

    def post(self, request):
        o = request.user.owner
        if not trial.enabled():
            return Response({"detail": "not_available"}, status=status.HTTP_400_BAD_REQUEST)
        app = bool(request.data.get("app"))
        lang = o.language
        back = f"{settings.SITE_URL}/{lang}/hosting/payment-saved{'?app=1' if app else ''}"
        try:
            session = stripe_api.post("/checkout/sessions", {
                "mode": "setup",
                "customer": _customer(o),
                "currency": COUNTRY_CURRENCY.get(o.cottages.values_list("country", flat=True).first() or "FI", "EUR").lower(),
                "locale": trial.STRIPE_LOCALES.get(lang, "auto"),
                "success_url": back,
                "cancel_url": back,
                "metadata": {"rantio_owner": o.pk},
                "setup_intent_data": {"metadata": {"rantio_owner": o.pk}},
            })
        except stripe_api.StripeError:
            logger.exception("No card page for owner %s", o.pk)
            return Response({"detail": "stripe_failed"}, status=status.HTTP_502_BAD_GATEWAY)
        o.stripe_checkout_id = session["id"]
        o.save(update_fields=["stripe_checkout_id"])
        return Response({"url": session["url"]})

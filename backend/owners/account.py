"""Deleting an account (Apple requires it in the app), and the sign-in Apple's app reviewers use.

Deleting: someone who never listed a cottage is removed completely. A host's cottages, bookings and
invoices are kept for the bookkeeping the law requires, but the account can no longer be signed
into: its name, email, phone and sign-in links are wiped, the cottages are taken off every site
(archived), and Rantio's team gets an email to finish the rest (Stripe, the channel manager).

The review sign-in: App Store Connect needs a way in for the reviewer. When APP_REVIEW_EMAIL and
APP_REVIEW_CODE are set on the server (deploy/set-app-review.sh), that address signs in with that
code and no email is sent. The account is an ordinary host with one example cottage that isn't
published anywhere.
"""

import hmac
import logging
import secrets
from decimal import Decimal

from django.conf import settings
from django.contrib.auth import logout
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from .models import AppDevice, Cottage, MonitorInterest, Owner

logger = logging.getLogger(__name__)

REVIEW_COTTAGE = "Example cottage (App Review)"
REVIEW_TRIES = 20
REVIEW_TRIES_KEY = "app-review-wrong-codes"


@transaction.atomic
def delete_account(owner: Owner) -> str:
    """Deletes or wipes the account; "deleted" or "closed" (records kept for bookkeeping)."""
    pk, email, name = owner.pk, owner.email, owner.name
    user = owner.user
    keep = owner.cottages.exists() or owner.invoices.exists()
    AppDevice.objects.filter(owner=owner).delete()
    owner.login_codes.all().delete()
    MonitorInterest.objects.filter(email__iexact=email).delete()
    if not keep:
        signup = owner.signup
        owner.delete()
        if signup:
            signup.delete()
        outcome = "deleted"
    else:
        owner.cottages.exclude(status=Cottage.Status.ARCHIVED).update(status=Cottage.Status.ARCHIVED, booking_requests_open=False)
        owner.name = "Deleted account"
        owner.email = f"deleted-{pk}-{secrets.token_hex(4)}@deleted.invalid"
        owner.phone = ""
        owner.google_sub = owner.apple_sub = ""
        owner.is_host = False
        owner.user = None
        owner.save()
        if owner.signup:
            s = owner.signup
            s.name, s.email, s.phone, s.message = "Deleted account", owner.email, "", ""
            s.save(update_fields=["name", "email", "phone", "message"])
        outcome = "closed"
    if user:
        user.delete()  # ends every session on the website too
    if settings.SIGNUP_NOTIFY_EMAILS:
        try:
            send_mail(
                f"Account deleted: {name} (owner {pk})",
                f"{name} <{email}> deleted their Rantio account in the app on {timezone.localdate():%d.%m.%Y}.\n\n"
                + ("Their cottages are archived and their details wiped; bookings and invoices are kept for "
                   "bookkeeping. Remove the cottages from the channel manager and the sites, and delete the "
                   "Stripe customer once no invoice is open."
                   if outcome == "closed" else "They had no cottages or invoices; everything was removed."),
                settings.DEFAULT_FROM_EMAIL, settings.SIGNUP_NOTIFY_EMAILS,
            )
        except Exception:
            logger.exception("Could not send the account-deleted email for owner %s", pk)
    return outcome


def handle_delete(request) -> dict:
    owner = request.user.owner
    if not isinstance(request.auth, AppDevice):
        logout(request._request)
    return {"deleted": delete_account(owner)}


# --- App Review ---------------------------------------------------------------------------------

def is_review_email(email: str) -> bool:
    review = getattr(settings, "APP_REVIEW_EMAIL", "")
    return bool(review and getattr(settings, "APP_REVIEW_CODE", "") and email.strip().lower() == review.lower())


def review_sign_in(email: str, code: str) -> Owner | None:
    """The reviewer's account when the code is right, made with its example cottage the first time."""
    if not is_review_email(email):
        return None
    # The code never changes, so wrong tries are counted: after REVIEW_TRIES in a day it stops working.
    if cache.get(REVIEW_TRIES_KEY, 0) >= REVIEW_TRIES:
        return None
    if not hmac.compare_digest(code.strip(), settings.APP_REVIEW_CODE):
        cache.set(REVIEW_TRIES_KEY, cache.get(REVIEW_TRIES_KEY, 0) + 1, 24 * 3600)
        return None
    owner, _ = Owner.objects.get_or_create(
        email__iexact=email.strip(), defaults={"email": email.strip(), "name": "App Review", "language": "en", "is_host": True}
    )
    if not owner.is_host:
        owner.is_host = True
        owner.save(update_fields=["is_host"])
    if not owner.cottages.exists():
        Cottage.objects.create(owner=owner, name=REVIEW_COTTAGE, municipality="Savonlinna", country="FI", max_guests=4,
                               price_per_night=Decimal("120.00"))
    return owner

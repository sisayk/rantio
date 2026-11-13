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

from . import limits
from .models import AppDevice, Cottage, MonitorInterest, Owner

logger = logging.getLogger(__name__)

REVIEW_COTTAGE = "Example cottage (App Review)"
REVIEW_TRIES = 20
REVIEW_TRIES_KEY = "app-review-wrong-codes"
REVIEW_TRIES_ALL = 200  # wrong tries from every address together in a day; then the code rests until tomorrow


@transaction.atomic
def delete_account(owner: Owner) -> str:
    """Deletes or wipes the account; "deleted" or "closed" (records kept for bookkeeping)."""
    pk, email, name = owner.pk, owner.email, owner.name
    user = owner.user
    keep = owner.cottages.exists() or owner.invoices.exists()
    AppDevice.objects.filter(owner=owner).delete()
    if owner.photo:
        owner.photo.delete(save=False)
    owner.login_codes.all().delete()
    MonitorInterest.objects.filter(email__iexact=email).delete()
    if not keep:
        signup = owner.signup
        owner.delete()
        if signup:
            signup.delete()
        outcome = "deleted"
    else:
        wipe_cottages(owner)
        owner.name = "Deleted account"
        owner.email = f"deleted-{pk}-{secrets.token_hex(4)}@deleted.invalid"
        owner.phone = ""
        owner.google_sub = owner.apple_sub = ""
        owner.is_host = False
        owner.user = None
        # Everything personal that bookkeeping doesn't need. A company's name, business and VAT
        # numbers and country stay with its invoices; a private person's invoices are in Stripe.
        for field in ("legal_first_name", "legal_last_name", "tax_country", "tax_id_sealed", "payout_holder", "payout_iban",
                      "payout_bic", "address_line", "postal_code", "city", "postal_line", "postal_postal_code",
                      "postal_city", "postal_country", "emergency_name", "emergency_phone", "legal_rep_name",
                      "legal_rep_role", "website"):  # the saved card stays in Stripe until what's owed is settled
            setattr(owner, field, "")
        owner.date_of_birth = None
        owner.beneficial_owners = []
        owner.reservations_contact = {}
        if owner.account_type != Owner.AccountType.COMPANY:
            owner.company_name = owner.trading_name = owner.business_id = owner.vat_id = ""
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


def wipe_cottages(owner: Owner) -> None:
    """A closed account's cottages stay as the records behind bookings and invoices, without what
    was private or still in use: door codes and instructions, the address, photos, the calendar and
    booking links (new keys, so the old links stop answering), feeds, and its Mökki monitors."""
    from .models import CalendarBlock, CalendarFeed, MonitorDevice, new_link_token

    MonitorDevice.objects.filter(owner=owner).update(owner=None, cottage=None)
    for cottage in owner.cottages.all():
        for photo in cottage.photos.all():
            photo.delete()  # its file goes once this is committed (models: delete_photo_file)
        # The nights the sites' calendars had closed stay closed (as blocks of their own): Beds24
        # would otherwise open them for booking until the team has taken the listings down.
        CalendarBlock.objects.filter(cottage=cottage, feed__isnull=False).update(feed=None)
        CalendarFeed.objects.filter(cottage=cottage).delete()
        cottage.status = Cottage.Status.ARCHIVED
        cottage.booking_requests_open = False
        cottage.address = cottage.access_details = cottage.arrival_instructions = cottage.departure_instructions = ""
        cottage.nettimokki_url = ""
        cottage.calendar_token, cottage.booking_link_token = new_link_token(), new_link_token()
        cottage.save()


def handle_delete(request) -> dict:
    owner = request.user.owner
    if not isinstance(request.auth, AppDevice):
        logout(request._request)
    return {"deleted": delete_account(owner)}


# --- App Review ---------------------------------------------------------------------------------

def is_review_email(email: str) -> bool:
    review = getattr(settings, "APP_REVIEW_EMAIL", "")
    return bool(review and getattr(settings, "APP_REVIEW_CODE", "") and email.strip().lower() == review.lower())


def review_sign_in(email: str, code: str, ip: str = "") -> Owner | None:
    """The reviewer's account when the code is right, made with its example cottage the first time."""
    if not is_review_email(email):
        return None
    # The code doesn't change, so wrong tries are counted per address: after REVIEW_TRIES in a day
    # that address can't use it (others, like Apple's reviewer, still can).
    key, everyone = f"{REVIEW_TRIES_KEY}:{ip}", f"{REVIEW_TRIES_KEY}:all"
    if limits.used(key) >= REVIEW_TRIES or limits.used(everyone) >= REVIEW_TRIES_ALL:
        return None
    if not hmac.compare_digest(code.strip(), settings.APP_REVIEW_CODE):
        limits.count(key, 24 * 3600)  # the day starts at the first wrong try
        if limits.count(everyone, 24 * 3600) == REVIEW_TRIES_ALL:
            logger.error("App Review sign-in paused for a day: %s wrong codes", REVIEW_TRIES_ALL)
        return None
    from .login import find_owner

    owner = find_owner(email) or Owner.objects.create(email=email.strip(), name="App Review", language="en", is_host=True)
    if not owner.is_host:
        owner.is_host = True
        owner.save(update_fields=["is_host"])
    if not owner.cottages.exists():
        Cottage.objects.create(owner=owner, name=REVIEW_COTTAGE, municipality="Savonlinna", country="FI", max_guests=4,
                               price_per_night=Decimal("120.00"))
    return owner

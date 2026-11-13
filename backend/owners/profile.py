"""Account: the profile photo, and the payment method Rantio's fees are charged to.

Payment method: the owner saves (or changes) a card or bank account on Stripe's own page, as at
sign-up (owners/trial.py). Nothing is charged there. When they come back, the new method becomes
the customer's default, so the next invoice is charged to it.
"""

import logging
import re

import secrets
from django.conf import settings
from django.utils import timezone
from django.views.decorators.debug import sensitive_variables
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import sms, stripe_api, trial, vault
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
        upload.name = f"{secrets.token_hex(8)}.{'jpg' if kind == 'jpeg' else kind}"  # not guessable
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


# --- Details: private person or company, address, the bank account the owner is paid to ----------

DETAIL_FIELDS = ("account_type", "company_name", "business_id", "vat_id", "address_line", "postal_code", "city",
                 "address_country", "payout_holder", "payout_iban", "payout_bic")


def iban_ok(iban: str) -> bool:
    """The IBAN's own check digits (ISO 13616: mod 97 = 1)."""
    if not re.fullmatch(r"[A-Z]{2}\d{2}[A-Z0-9]{11,30}", iban):
        return False
    moved = iban[4:] + iban[:4]
    return int("".join(str(int(ch, 36)) for ch in moved)) % 97 == 1


def y_tunnus_ok(value: str) -> bool:
    """A Finnish business ID, 1234567-8, with its check digit."""
    m = re.fullmatch(r"(\d{7})-(\d)", value)
    if not m:
        return False
    total = sum(int(d) * w for d, w in zip(m.group(1), (7, 9, 10, 5, 8, 4, 2)))
    check = 0 if total % 11 == 0 else 11 - total % 11
    return check != 10 and check == int(m.group(2))


def masked_iban(iban: str) -> str:
    if vault.is_locked(iban):
        return vault.LOCKED_TEXT  # stored but can't be decrypted: holds "•", so sent back it changes nothing
    return f"{iban[:2]}•• •••• {iban[-4:]}" if iban else ""


def details_row(o: Owner) -> dict:
    return {
        "account_type": o.account_type, "company_name": o.company_name, "business_id": o.business_id, "vat_id": o.vat_id,
        "address_line": o.address_line, "postal_code": o.postal_code, "city": o.city, "address_country": o.address_country,
        # Only the end of the account number goes back to the browser or the phone.
        "payout_holder": o.payout_holder, "payout_iban": masked_iban(o.payout_iban), "payout_bic": o.payout_bic,
        "has_payout": bool(o.payout_iban),
        "legal_first_name": o.legal_first_name, "legal_last_name": o.legal_last_name,
        "date_of_birth": "" if vault.is_locked(o.date_of_birth) else o.date_of_birth.isoformat() if o.date_of_birth else "",
        "tax_country": o.tax_country, **tax_id_row(o),
        "postal_same": o.postal_same, "postal_line": o.postal_line, "postal_postal_code": o.postal_postal_code,
        "postal_city": o.postal_city, "postal_country": o.postal_country,
        "emergency_name": o.emergency_name, "emergency_phone": o.emergency_phone,
        "business_type": o.business_type, "trading_name": o.trading_name, "website": o.website,
        "legal_rep_name": o.legal_rep_name, "legal_rep_role": o.legal_rep_role,
        "beneficial_owners": [] if vault.is_locked(o.beneficial_owners) else o.beneficial_owners or [],
        "reservations_contact": o.reservations_contact or {},
        "missing": host_missing(o),
    }


# Error reports (Django's 500 emails) leave these local values out; settings.py does the same for Sentry.
@sensitive_variables("data", "tin", "born", "v")
def apply_details(o: Owner, data) -> tuple[list[str], dict]:
    """Takes the details from a PATCH; the fields changed, or errors by field."""
    changed, errors = [], {}

    def text(key: str, limit: int) -> str | None:
        if key not in data:
            return None
        v = str(data.get(key) or "").strip()
        if len(v) > limit:
            errors[key] = ["too_long"]
        return v

    kind = data.get("account_type")
    if kind is not None:
        if kind not in Owner.AccountType.values:
            errors["account_type"] = ["invalid"]
        else:
            o.account_type = kind
            changed.append("account_type")
    for key, limit in (("company_name", 160), ("address_line", 200), ("postal_code", 20), ("city", 100), ("payout_holder", 160)):
        v = text(key, limit)
        if v is not None and key not in errors:
            setattr(o, key, v)
            changed.append(key)
    country = text("address_country", 2)
    if country is not None:
        country = country.upper()
        if country and not re.fullmatch(r"[A-Z]{2}", country):
            errors["address_country"] = ["invalid"]
        else:
            o.address_country = country
            changed.append("address_country")
    bid = text("business_id", 30)
    if bid is not None:
        fi = (o.address_country or "FI") == "FI"
        if bid and fi and not y_tunnus_ok(bid):
            errors["business_id"] = ["invalid"]
        else:
            o.business_id = bid
            changed.append("business_id")
    vat = text("vat_id", 20)
    if vat is not None:
        vat = vat.replace(" ", "").upper()
        if vat and not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{2,13}", vat):
            errors["vat_id"] = ["invalid"]
        else:
            o.vat_id = vat
            changed.append("vat_id")
    if "payout_iban" in data:
        iban = re.sub(r"\s", "", str(data.get("payout_iban") or "")).upper()
        if iban and "•" in iban:
            pass  # the masked number sent back unchanged: keep the stored one
        elif iban and not iban_ok(iban):
            errors["payout_iban"] = ["invalid"]
        else:
            o.payout_iban = iban
            changed.append("payout_iban")
    bic = text("payout_bic", 11)
    if bic is not None:
        bic = bic.replace(" ", "").upper()
        if bic and not re.fullmatch(r"[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?", bic):
            errors["payout_bic"] = ["invalid"]
        else:
            o.payout_bic = bic
            changed.append("payout_bic")
    for key, limit in (("legal_first_name", 80), ("legal_last_name", 80), ("postal_line", 200), ("postal_postal_code", 20),
                       ("postal_city", 100), ("emergency_name", 120), ("trading_name", 160), ("legal_rep_name", 160),
                       ("legal_rep_role", 80)):
        v = text(key, limit)
        if v is not None and key not in errors:
            setattr(o, key, v)
            changed.append(key)
    for key in ("tax_country", "postal_country"):
        v = text(key, 2)
        if v is not None:
            v = v.upper()
            if v and not re.fullmatch(r"[A-Z]{2}", v):
                errors[key] = ["invalid"]
            else:
                setattr(o, key, v)
                changed.append(key)
    if "postal_same" in data:
        o.postal_same = bool(data.get("postal_same"))
        changed.append("postal_same")
    if "date_of_birth" in data:
        dob = parse_dob(str(data.get("date_of_birth") or ""))
        if dob is False:
            errors["date_of_birth"] = ["invalid"]
        elif dob is None and vault.is_locked(o.date_of_birth):
            pass  # shown empty because it can't be decrypted: left as stored
        else:
            o.date_of_birth = dob
            changed.append("date_of_birth")
    if "tax_id" in data:
        tin = re.sub(r"\s", "", str(data.get("tax_id") or "")).upper()
        country = o.tax_country or o.address_country or "FI"
        if tin and "•" in tin:
            pass  # the masked number sent back unchanged
        elif tin and not tax_id_ok(tin, country, o.account_type):
            errors["tax_id"] = ["invalid"]
        else:
            o.tax_id_sealed = vault.seal(tin)
            changed.append("tax_id_sealed")
            # A henkilötunnus carries the date of birth: fill it in, or catch a typo in either.
            born = hetu_birth(tin) if country == "FI" and o.account_type != Owner.AccountType.COMPANY else None
            if born and (not o.date_of_birth or vault.is_locked(o.date_of_birth)):
                o.date_of_birth = born
                changed.append("date_of_birth")
            elif born and o.date_of_birth != born:
                errors["date_of_birth"] = ["mismatch"]
    if "emergency_phone" in data:
        phone = str(data.get("emergency_phone") or "").strip()
        if phone and not sms.normalize(phone, o.address_country or "FI"):
            errors["emergency_phone"] = ["invalid"]
        else:
            o.emergency_phone = phone
            changed.append("emergency_phone")
    if "business_type" in data:
        bt = str(data.get("business_type") or "")
        if bt and bt not in Owner.BusinessType.values:
            errors["business_type"] = ["invalid"]
        else:
            o.business_type = bt
            changed.append("business_type")
    if "website" in data:
        site = str(data.get("website") or "").strip()
        if site and not re.match(r"^https?://", site):
            site = "https://" + site
        if site and (len(site) > 300 or not re.fullmatch(r"https?://[^\s/$.?#][^\s]*\.[^\s]+", site)):
            errors["website"] = ["invalid"]
        else:
            o.website = site
            changed.append("website")
    if "beneficial_owners" in data:
        rows, bad = clean_owners(data.get("beneficial_owners"))
        if bad:
            errors["beneficial_owners"] = [bad]
        elif not rows and vault.is_locked(o.beneficial_owners):
            pass  # shown empty because they can't be decrypted: left as stored
        else:
            o.beneficial_owners = rows
            changed.append("beneficial_owners")
    if "reservations_contact" in data:
        c = data.get("reservations_contact") or {}
        if not isinstance(c, dict):
            errors["reservations_contact"] = ["invalid"]
        else:
            contact = {k: str(c.get(k) or "").strip()[:160] for k in ("name", "email", "phone")}
            if contact["email"] and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", contact["email"]):
                errors["reservations_contact"] = ["invalid"]
            else:
                o.reservations_contact = {k: v for k, v in contact.items() if v}
                changed.append("reservations_contact")
    if o.account_type == Owner.AccountType.COMPANY and "company_name" in changed and not o.company_name:
        errors["company_name"] = ["required"]
    return changed, errors


# --- What the booking sites need -----------------------------------------------------------------

# Shown instead when the stored number can't be decrypted. It holds "•", so sent back unchanged
# it never overwrites the stored value.
UNREADABLE_TAX_ID = "•••••"


def masked_tax_id(tin: str) -> str:
    """What the owner and the admin see of a stored tax number. A henkilötunnus shows only its date
    part, which the date of birth gives anyway: its last four characters are what identify the person,
    so they never leave the server. Other numbers show their last two characters."""
    if not tin:
        return ""
    if re.fullmatch(r"\d{6}[-+ABCDEFUVWXY]\d{3}[0-9A-Y]", tin):
        return f"{tin[:7]}••••"
    return f"•••••{tin[-2:]}"


def tax_id_row(o: Owner) -> dict:
    """The tax number's part of the account: masked, and whether one is stored. A stored number that
    can't be decrypted (a key missing from VAULT_KEYS, or DJANGO_SECRET_KEY changed) still counts as
    given, so owners aren't asked again for an operator's mistake, and it is logged for the team."""
    if not o.tax_id_sealed:
        return {"tax_id": "", "has_tax_id": False, "tax_id_unreadable": False}
    try:
        tin = vault.unseal(o.tax_id_sealed)
    except vault.Unreadable as err:
        logger.error("Owner %s: the stored tax number can't be decrypted (%s); see `stugora-manage vault status`", o.pk, err)
        return {"tax_id": UNREADABLE_TAX_ID, "has_tax_id": True, "tax_id_unreadable": True}
    return {"tax_id": masked_tax_id(tin), "has_tax_id": True, "tax_id_unreadable": False}


def parse_dob(value: str):
    """A date of birth (YYYY-MM-DD) of someone 18 or over; None if empty, False if wrong."""
    from datetime import date

    if not value:
        return None
    value = value.strip()
    # Day first, the European way (02-07-1983 or 2.7.1983), or the ISO form (1983-07-02).
    m = re.fullmatch(r"(\d{1,2})[-./](\d{1,2})[-./](\d{4})", value)
    try:
        d = date(int(m.group(3)), int(m.group(2)), int(m.group(1))) if m else date.fromisoformat(value)
    except ValueError:
        return False
    today = timezone.localdate()
    age = today.year - d.year - ((today.month, today.day) < (d.month, d.day))
    return d if 18 <= age <= 120 else False


HETU_CHECK = "0123456789ABCDEFHJKLMNPRSTUVWXY"


def hetu_ok(value: str) -> bool:
    """A Finnish personal identity code (DDMMYYCZZZQ) with its check character."""
    m = re.fullmatch(r"(\d{6})([-+ABCDEFUVWXY])(\d{3})([0-9A-Y])", value)
    return bool(m) and HETU_CHECK[int(m.group(1) + m.group(3)) % 31] == m.group(4)


def hetu_birth(value: str):
    """The date of birth a Finnish personal identity code carries (DDMMYY plus the century sign)."""
    from datetime import date

    if not hetu_ok(value):
        return None
    century = {"+": 1800, "-": 1900, "U": 1900, "V": 1900, "W": 1900, "X": 1900, "Y": 1900}.get(value[6], 2000)
    try:
        return date(century + int(value[4:6]), int(value[2:4]), int(value[0:2]))
    except ValueError:
        return None


def tax_id_ok(tin: str, country: str, account_type: str) -> bool:
    if country == "FI":
        return y_tunnus_ok(tin) if account_type == Owner.AccountType.COMPANY else hetu_ok(tin)
    return bool(re.fullmatch(r"[A-Z0-9./-]{4,30}", tin))


def clean_owners(rows) -> tuple[list, str]:
    """Up to 10 beneficial owners, each with a name; dates and shares checked."""
    if not isinstance(rows, list) or len(rows) > 10:
        return [], "invalid"
    out = []
    for r in rows:
        if not isinstance(r, dict):
            return [], "invalid"
        name = str(r.get("name") or "").strip()[:160]
        if not name:
            continue
        dob = parse_dob(str(r.get("date_of_birth") or ""))
        country = str(r.get("country") or "").strip().upper()[:2]
        try:
            share = float(r.get("share")) if r.get("share") not in (None, "") else None
        except (TypeError, ValueError):
            return [], "invalid"
        if dob is False or (share is not None and not 0 < share <= 100) or (country and not re.fullmatch(r"[A-Z]{2}", country)):
            return [], "invalid"
        out.append({"name": name, "date_of_birth": dob.isoformat() if dob else "", "country": country, "share": share})
    return out, ""


def host_missing(o: Owner) -> list[str]:
    """What's still needed before the cottage can go onto Airbnb, Booking.com and Vrbo, which ask for
    these (also for the EU's DAC7 tax reporting). Keys match the website's and the app's texts."""
    need = []
    company = o.account_type == Owner.AccountType.COMPANY
    if company:
        for key, ok in (("company_name", o.company_name), ("business_type", o.business_type), ("business_id", o.business_id),
                        ("legal_rep", o.legal_rep_name), ("beneficial_owners", o.beneficial_owners)):
            if not ok:
                need.append(key)
    else:
        for key, ok in (("legal_name", o.legal_first_name and o.legal_last_name), ("date_of_birth", o.date_of_birth),
                        ("tax_id", o.tax_id_sealed)):
            if not ok:
                need.append(key)
    if not (o.address_line and o.postal_code and o.city and o.address_country):
        need.append("address")
    if not o.phone:
        need.append("phone")
    if not o.payout_iban:
        need.append("payout")
    if not company and not o.emergency_name:
        need.append("emergency")
    return need


def sync_customer(o: Owner) -> None:
    """Invoices carry the company's name and the address: kept in step on the Stripe customer."""
    if not (trial.enabled() and o.stripe_customer_id):
        return
    try:
        stripe_api.post(f"/customers/{o.stripe_customer_id}", {
            "name": o.company_name if o.account_type == Owner.AccountType.COMPANY and o.company_name else o.name,
            "address": {"line1": o.address_line or None, "postal_code": o.postal_code or None, "city": o.city or None,
                        "country": o.address_country or None},
        })
    except stripe_api.StripeError:
        logger.exception("Could not update the Stripe customer of owner %s", o.pk)

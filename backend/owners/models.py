import calendar
import secrets
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone

from .regions import REGION_CHOICES, REGIONS

# Plan decisions (Business and Implementation Plan, 28 Oct 2026):
# - €99 yearly fee per cottage (or the set amount in the cottage's own currency,
#   YEARLY_FEES), invoiced when each listing year starts.
# - Free trial (4 Nov 2026): the first TRIAL_MONTHS after a cottage goes live are free;
#   listing year 1 (and its fee) starts when the trial ends. The owner saves a card at
#   sign-up (owners/trial.py) and Rantio's invoices are charged to it. This replaced the
#   pilot deal (first year free, 10 %); is_pilot stays only for owners who already had it.
# - Commission is a share of the owner's payout for the stay (after platform
#   fees, cleaning fees excluded); Nettimökki bookings are never charged.
# - Both carry Finnish VAT.
STANDARD_COMMISSION_RATE = Decimal("12.00")
PILOT_COMMISSION_RATE = Decimal("10.00")
YEARLY_FEE = Decimal("99.00")
# The yearly fee in each currency, so an owner pays a set amount in their own money: about
# €99 at the ECB rate of 2 Nov 2026, rounded like Rantio's prices (tens of kronor, hundreds
# of krónur). Change them here; frontend/src/lib/content.ts YEARLY_FEES must say the same.
YEARLY_FEES = {
    "EUR": YEARLY_FEE,
    "SEK": Decimal("1080.00"),
    "NOK": Decimal("1030.00"),
    "DKK": Decimal("740.00"),
    "ISK": Decimal("13500.00"),
}
VAT_RATE = Decimal("25.50")
LISTING_TERM_MONTHS = 12
TRIAL_MONTHS = 3

CENT = Decimal("0.01")


def add_months(day: date, months: int) -> date:
    total = day.month - 1 + months
    year, month = day.year + total // 12, total % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def new_inbound_code() -> str:
    return secrets.token_hex(4)


def new_link_token() -> str:
    """A long random key for a link that works without signing in (calendar feed, booking link)."""
    return secrets.token_urlsafe(18)


def vat_on(amount: Decimal) -> Decimal:
    return (amount * VAT_RATE / Decimal(100)).quantize(CENT, rounding=ROUND_HALF_UP)


class Language(models.TextChoices):
    """The site's languages (frontend/src/i18n/locales.ts), named in themselves."""

    ENGLISH = "en", "English"
    FINNISH = "fi", "Suomi"
    SWEDISH = "sv", "Svenska"
    NORWEGIAN_BOKMAL = "nb", "Norsk bokmål"
    NORWEGIAN_NYNORSK = "nn", "Norsk nynorsk"
    DANISH = "da", "Dansk"
    ICELANDIC = "is", "Íslenska"
    ESTONIAN = "et", "Eesti"
    LATVIAN = "lv", "Latviešu"
    LITHUANIAN = "lt", "Lietuvių"
    GERMAN = "de", "Deutsch"


class Country(models.TextChoices):
    FINLAND = "FI", "Finland"
    SWEDEN = "SE", "Sweden"
    NORWAY = "NO", "Norway"
    DENMARK = "DK", "Denmark"
    ICELAND = "IS", "Iceland"
    ESTONIA = "EE", "Estonia"
    LATVIA = "LV", "Latvia"
    LITHUANIA = "LT", "Lithuania"


# The currency each country uses. Cottages are priced, and owners paid, in it;
# Rantio's own yearly fee is set and invoiced in euros.
COUNTRY_CURRENCY = {"FI": "EUR", "EE": "EUR", "LV": "EUR", "LT": "EUR", "SE": "SEK", "NO": "NOK", "DK": "DKK", "IS": "ISK"}
CURRENCIES = ("EUR", "SEK", "NOK", "DKK", "ISK")


class OwnerSignup(models.Model):
    """An owner who filled in the rantio.fi sign-up form."""

    class Status(models.TextChoices):
        NEW = "new", "New"
        CONTACTED = "contacted", "Contacted"
        ONBOARDING = "onboarding", "Onboarding"
        LIVE = "live", "Live"
        DECLINED = "declined", "Declined"

    name = models.CharField(max_length=120)
    email = models.EmailField()
    phone = models.CharField(max_length=40, blank=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.FINNISH)
    country = models.CharField(max_length=2, choices=Country.choices, default=Country.FINLAND)
    region = models.CharField(max_length=40, choices=REGION_CHOICES, blank=True, help_text="The country's official region (regions.py)")
    place = models.CharField(max_length=100, blank=True, help_text="Nearest town or municipality, as the owner wrote it")
    cottage_count = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)])
    nettimokki_url = models.URLField(blank=True)
    listed_on = models.CharField(
        max_length=80, blank=True,
        help_text="Where the cottage is listed now, from the form: nettimokki, mokkivuokra, lomarengas, airbnb, booking, vrbo, other or none.",
    )
    message = models.TextField(blank=True, max_length=2000)
    privacy_consent = models.BooleanField(default=False)
    source = models.CharField(max_length=80, blank=True, help_text="utm_source or referral")

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW)
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    # The card step after the form (owners/trial.py): a Stripe customer and the card they saved.
    token = models.CharField(max_length=32, unique=True, null=True, editable=False)
    stripe_customer_id = models.CharField(max_length=40, blank=True, editable=False)
    stripe_checkout_id = models.CharField(max_length=80, blank=True, editable=False)
    stripe_payment_method = models.CharField(max_length=40, blank=True, editable=False)
    card_saved_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} <{self.email}>"

    def save(self, *args, **kwargs):
        if not self.token:
            self.token = secrets.token_urlsafe(18)
        super().save(*args, **kwargs)

    LISTED_ON = {"nettimokki": "Nettimökki", "mokkivuokra": "Mökkivuokra", "lomarengas": "Lomarengas", "airbnb": "Airbnb", "booking": "Booking.com", "vrbo": "Vrbo",
                 "other": "somewhere else", "none": "nowhere yet"}

    @property
    def listed_on_display(self) -> str:
        return ", ".join(self.LISTED_ON[k] for k in self.listed_on.split(",") if k in self.LISTED_ON) or "-"

    @property
    def location_display(self) -> str:
        region = REGIONS.get(self.country, {}).get(self.region, "")
        return ", ".join(part for part in (self.place, region, self.get_country_display()) if part)


class MonitorInterest(models.Model):
    """Someone who asked to hear when the Mökki monitor (the cottage alert box) is ready."""

    class Rents(models.TextChoices):
        YES = "yes", "Rents it out"
        NOT_YET = "not_yet", "Not yet"
        NO = "no", "Only for own use"

    email = models.EmailField(unique=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.FINNISH)
    country = models.CharField(max_length=2, choices=Country.choices, default=Country.FINLAND)
    rents = models.CharField(max_length=8, choices=Rents.choices, blank=True)
    privacy_consent = models.BooleanField(default=False)
    source = models.CharField(max_length=80, blank=True, help_text="utm_source or referral")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Mökki monitor waitlist entry"
        verbose_name_plural = "Mökki monitor waitlist"

    def __str__(self) -> str:
        return self.email


class NewsletterSubscriber(models.Model):
    """Someone who signed up for the guest newsletter in the site footer (double opt-in)."""

    email = models.EmailField(unique=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.ENGLISH)
    # The key in the confirmation link and, later, in every newsletter's unsubscribe link.
    token = models.CharField(max_length=64, unique=True)
    source = models.CharField(max_length=80, blank=True, help_text="utm_source or referral")
    created_at = models.DateTimeField(auto_now_add=True)
    confirmed_at = models.DateTimeField(null=True, blank=True, help_text="Clicked the link in the confirmation email")
    unsubscribed_at = models.DateTimeField(null=True, blank=True)
    # How many confirmation emails went out, and when the last one did: the form can't be
    # used to flood someone else's inbox.
    confirmations_sent = models.PositiveSmallIntegerField(default=0)
    last_confirmation_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "newsletter subscriber"

    def __str__(self) -> str:
        return self.email

    @property
    def active(self) -> bool:
        return bool(self.confirmed_at and not self.unsubscribed_at)


class Owner(models.Model):
    """Someone with a Rantio account. Anyone can have one (signing in creates it); a host
    has listed a cottage through the sign-up form, and only hosts reach the hosting pages."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owner", null=True, blank=True
    )
    signup = models.OneToOneField(OwnerSignup, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=40, blank=True, help_text="Also for signing in with a code by SMS.")
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.FINNISH)
    # Set the first time the owner signs in with Google or Apple (owners/social.py).
    google_sub = models.CharField(max_length=255, blank=True, db_index=True, editable=False)
    apple_sub = models.CharField(max_length=255, blank=True, db_index=True, editable=False)
    is_host = models.BooleanField(
        default=True,
        help_text="Has listed a cottage (the sign-up form with photos and a card). Accounts made by signing in "
        "start without it and can't use the hosting pages until they list.",
    )

    is_pilot = models.BooleanField(
        default=False, help_text="The old pilot deal (first year free, 10 %). New owners get the free trial instead."
    )
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=STANDARD_COMMISSION_RATE,
        help_text="Percent of the owner's payout, before VAT.",
    )
    vat_registered = models.BooleanField(
        default=False, help_text="Owner can reclaim VAT (business owners only)."
    )
    agreement_signed_on = models.DateField(null=True, blank=True)
    airbnb_cohost_payout = models.BooleanField(
        default=True,
        help_text="Rantio is co-host on the owner's Airbnb listings and Airbnb pays the commission to Rantio "
        "directly, so Airbnb stays are left off the monthly invoice.",
    )
    stripe_customer_id = models.CharField(max_length=40, blank=True, editable=False)
    # The card the owner saved for Rantio's invoices; they're charged to it automatically.
    stripe_payment_method = models.CharField(max_length=40, blank=True, editable=False)
    stripe_checkout_id = models.CharField(
        max_length=80, blank=True, editable=False, help_text="Stripe's card page the owner opened last (Account → Payment method)."
    )
    photo = models.FileField(upload_to="owners/%Y/", blank=True, help_text="Profile photo (JPG, PNG or WebP).")

    class AccountType(models.TextChoices):
        PRIVATE = "private", "Private person"
        COMPANY = "company", "Company"

    account_type = models.CharField(max_length=10, choices=AccountType.choices, default=AccountType.PRIVATE)
    company_name = models.CharField(max_length=160, blank=True)
    business_id = models.CharField(max_length=30, blank=True, help_text="Company's registration number (Finland: Y-tunnus 1234567-8).")
    vat_id = models.CharField(max_length=20, blank=True, help_text="EU VAT number, e.g. FI12345678.")
    address_line = models.CharField(max_length=200, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    city = models.CharField(max_length=100, blank=True)
    address_country = models.CharField(max_length=2, blank=True)
    payout_holder = models.CharField(max_length=160, blank=True, help_text="Name on the bank account the owner is paid to.")
    payout_iban = models.CharField(max_length=34, blank=True, help_text="Bank account (IBAN) the owner is paid to.")
    payout_bic = models.CharField(max_length=11, blank=True)
    # What the booking sites ask of a host (and the EU's DAC7 rules): owners/profile.py HOST_CHECKLIST.
    legal_first_name = models.CharField(max_length=80, blank=True, help_text="As on an ID; no initials.")
    legal_last_name = models.CharField(max_length=80, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    tax_country = models.CharField(max_length=2, blank=True, help_text="Country that issued the tax number.")
    tax_id_sealed = models.TextField(blank=True, editable=False, help_text="Tax number (Finland: personal identity code), encrypted.")
    postal_same = models.BooleanField(default=True, help_text="Post goes to the address above.")
    postal_line = models.CharField(max_length=200, blank=True)
    postal_postal_code = models.CharField(max_length=20, blank=True)
    postal_city = models.CharField(max_length=100, blank=True)
    postal_country = models.CharField(max_length=2, blank=True)
    emergency_name = models.CharField(max_length=120, blank=True)
    emergency_phone = models.CharField(max_length=40, blank=True)

    class BusinessType(models.TextChoices):
        TMI = "tmi", "Sole trader (toiminimi)"
        OY = "oy", "Limited company (osakeyhtiö)"
        AY = "ay", "General partnership (avoin yhtiö)"
        KY = "ky", "Limited partnership (kommandiittiyhtiö)"
        COOP = "coop", "Cooperative"
        ASSOCIATION = "association", "Association or foundation"
        OTHER = "other", "Other"

    business_type = models.CharField(max_length=12, choices=BusinessType.choices, blank=True)
    trading_name = models.CharField(max_length=160, blank=True, help_text="If the company trades under another name.")
    website = models.URLField(max_length=300, blank=True)
    legal_rep_name = models.CharField(max_length=160, blank=True, help_text="Who can sign for the company.")
    legal_rep_role = models.CharField(max_length=80, blank=True)
    beneficial_owners = models.JSONField(
        default=list, blank=True, help_text='People owning 25 % or more: [{"name", "date_of_birth", "country", "share"}].'
    )
    reservations_contact = models.JSONField(
        default=dict, blank=True, help_text='Who the sites contact about bookings, if not the owner: {"name", "email", "phone"}.'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name

    def save(self, *args, **kwargs):
        if self._state.adding and self.is_pilot and self.commission_rate == STANDARD_COMMISSION_RATE:
            self.commission_rate = PILOT_COMMISSION_RATE
        super().save(*args, **kwargs)



class Cottage(models.Model):
    """What the owner gives us once, through the intake form."""

    class Status(models.TextChoices):
        INTAKE = "intake", "Intake"
        LISTING = "listing", "Setting up listings"
        LIVE = "live", "Live"
        PAUSED = "paused", "Paused"
        ARCHIVED = "archived", "Archived"

    class PropertyType(models.TextChoices):
        COTTAGE = "cottage", "Cottage"
        CABIN = "cabin", "Cabin"
        VILLA = "villa", "Villa"
        HOLIDAY_HOME = "holiday_home", "Holiday home"
        APARTMENT = "apartment", "Apartment"
        FARMHOUSE = "farmhouse", "Farmhouse"
        OTHER = "other", "Other"

    owner = models.ForeignKey(Owner, on_delete=models.CASCADE, related_name="cottages")
    name = models.CharField(max_length=120)
    country = models.CharField(max_length=2, choices=Country.choices, default=Country.FINLAND)
    region = models.CharField(max_length=40, choices=REGION_CHOICES, blank=True)
    municipality = models.CharField(max_length=80, blank=True)
    max_guests = models.PositiveSmallIntegerField(validators=[MinValueValidator(1)])
    bedrooms = models.PositiveSmallIntegerField(default=1)
    beds = models.PositiveSmallIntegerField(default=1)
    has_sauna = models.BooleanField(default=True)
    has_lake_or_sea_access = models.BooleanField(default=False)
    price_per_night = models.DecimalField(
        max_digits=9, decimal_places=2, help_text="What the owner wants to net per night, in the cottage's currency."
    )
    cleaning_fee = models.DecimalField(
        max_digits=9, decimal_places=2, default=Decimal("0.00"), help_text="In the cottage's currency."
    )
    min_nights = models.PositiveSmallIntegerField(default=2)
    house_rules = models.TextField(blank=True)
    amenities = models.JSONField(
        default=list, blank=True,
        help_text="What the cottage has, as the site's feature keys (frontend/src/lib/catalog.ts), e.g. [\"lake\", \"boat\"].",
    )
    description_fi = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    nettimokki_url = models.URLField(blank=True)
    inbound_code = models.CharField(
        max_length=16, unique=True, default=new_inbound_code, editable=False,
        help_text="Identifies the cottage in its booking-email forwarding address.",
    )
    calendar_token = models.CharField(
        max_length=32, unique=True, default=new_link_token, editable=False,
        help_text="Key in the cottage's calendar link (iCal) that the booking sites read.",
    )
    booking_link_token = models.CharField(
        max_length=32, unique=True, default=new_link_token, editable=False,
        help_text="Key in the booking-request link the owner shares with their own guests.",
    )
    booking_requests_open = models.BooleanField(
        default=True, help_text="Whether guests with the booking link can send a booking request."
    )
    listing_slug = models.SlugField(
        max_length=60, blank=True, db_index=True,
        help_text="The cottage's address on rantio.fi, e.g. lakeside-villa for /fi/cottages/lakeside-villa.",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.INTAKE)

    # ---------- the listing, as the owner edits it in Hosting → Listings ----------
    property_type = models.CharField(max_length=14, choices=PropertyType.choices, default=PropertyType.COTTAGE)
    bathrooms = models.PositiveSmallIntegerField(default=1)
    floor_area = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Square metres.")
    floors = models.PositiveSmallIntegerField(default=1)
    host_languages = models.JSONField(default=list, blank=True, help_text="Language codes the owner speaks with guests.")
    descriptions = models.JSONField(
        default=dict, blank=True,
        help_text="The description in each language the owner wrote, {\"en\": \"…\", \"sv\": \"…\"}. "
        "description_en and description_fi mirror the en and fi entries.",
    )
    descriptions_auto = models.JSONField(
        default=dict, blank=True,
        help_text="Languages Claude translated, each mapped to the language it was translated from, {\"sv\": \"en\"}. "
        "Languages the owner wrote are never here and are never overwritten.",
    )
    translating = models.JSONField(
        default=dict, blank=True,
        help_text="While translations are being written: {\"job\": \"…\", \"from\": \"en\", \"langs\": [\"sv\", …], \"started\": \"…\"}. "
        "Afterwards {\"failed\": [\"…\"]} if some languages couldn't be done, else empty.",
    )
    address = models.CharField(max_length=200, blank=True, help_text="Street address. Never shown to guests before a booking.")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    show_exact_location = models.BooleanField(
        default=False, help_text="Guests see the exact pin before booking; otherwise an area about 1 km across."
    )
    nearby = models.JSONField(default=list, blank=True, help_text="[{\"kind\": \"lake\", \"name\": \"…\", \"distance_km\": 0.2}]")
    property_id = models.CharField(
        max_length=40, blank=True, help_text="Land register id of the property (Finland: kiinteistötunnus 123-456-7-89); the sites report it (DAC7)."
    )
    licence_number = models.CharField(max_length=60, blank=True, help_text="Short-term rental licence or registration number, where required.")
    beds24_property_id = models.PositiveIntegerField(null=True, blank=True, help_text="The cottage's property in Beds24, once sent.")
    beds24_room_id = models.PositiveIntegerField(null=True, blank=True)
    beds24_synced_at = models.DateTimeField(null=True, blank=True)
    beds24_error = models.CharField(max_length=500, blank=True)
    amenity_notes = models.JSONField(
        default=dict, blank=True, help_text="{amenity key: {\"note\": \"…\", \"fee\": \"10.00\"}} for amenities with conditions or a price."
    )
    # Prices Rantio sets on its own pages and booking link. The booking sites keep their own prices.
    weekend_price = models.DecimalField(max_digits=9, decimal_places=2, null=True, blank=True, help_text="Friday and Saturday nights.")
    max_nights = models.PositiveSmallIntegerField(null=True, blank=True)
    extra_guest_fee = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal("0.00"))
    extra_guest_from = models.PositiveSmallIntegerField(null=True, blank=True, help_text="The fee is per night for each guest above this many.")
    pet_fee = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal("0.00"))
    weekly_discount = models.PositiveSmallIntegerField(default=0, help_text="Percent off stays of 7 nights or more.")
    monthly_discount = models.PositiveSmallIntegerField(default=0, help_text="Percent off stays of 28 nights or more.")
    security_deposit = models.DecimalField(max_digits=9, decimal_places=2, default=Decimal("0.00"))
    seasonal_prices = models.JSONField(default=list, blank=True, help_text="[{\"name\", \"start\": \"MM-DD\", \"end\": \"MM-DD\", \"price\"}]")
    # Smart pricing (owners/pricing.py): nightly prices follow demand, between these limits.
    smart_pricing = models.BooleanField(default=False, help_text="Nightly prices follow demand within the limits below.")
    smart_min_price = models.DecimalField(
        max_digits=9, decimal_places=2, null=True, blank=True, help_text="Smart pricing never goes below this. Empty: 75 % of the price per night."
    )
    smart_max_price = models.DecimalField(
        max_digits=9, decimal_places=2, null=True, blank=True, help_text="Smart pricing never goes above this. Empty: twice the price per night."
    )
    taxes_note = models.CharField(max_length=300, blank=True)
    # Cancellation (frontend/src/lib/cancellation.ts): Airbnb's four policies, so each booking
    # site gets the closest match; the booking link uses this one as it is.
    cancellation_policy = models.CharField(
        max_length=10,
        choices=[("flexible", "Flexible"), ("moderate", "Moderate"), ("limited", "Limited"), ("firm", "Firm")],
        default="moderate",
        help_text="Flexible: full refund up to 1 day before check-in. Moderate: 5 days. "
        "Limited: 14 days, 50 % up to 7. Firm: 30 days, 50 % up to 7.",
    )
    long_stay_policy = models.CharField(
        max_length=6, choices=[("firm", "Firm"), ("strict", "Strict")], default="firm",
        help_text="For stays of 28 nights or more.",
    )
    non_refundable_option = models.BooleanField(
        default=False, help_text="On the booking sites, guests may also choose a 10 % lower price with no refund."
    )
    # House rules
    check_in_from = models.TimeField(null=True, blank=True)
    check_in_until = models.TimeField(null=True, blank=True)
    check_out_by = models.TimeField(null=True, blank=True)
    self_check_in = models.BooleanField(default=False)
    min_age = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Youngest age of the guest who books.")
    pets_allowed = models.BooleanField(default=False)
    smoking_allowed = models.BooleanField(default=False)
    events_allowed = models.BooleanField(default=False)
    quiet_hours = models.CharField(max_length=60, blank=True)
    waste_instructions = models.TextField(blank=True, max_length=2000)
    sauna_instructions = models.TextField(blank=True, max_length=2000)
    fireplace_instructions = models.TextField(blank=True, max_length=2000)
    # Only for guests with a confirmed stay; never in public pages, feeds or previews of the listing.
    arrival_instructions = models.TextField(blank=True, max_length=4000)
    departure_instructions = models.TextField(blank=True, max_length=4000)
    access_details = models.TextField(blank=True, max_length=1000, help_text="Door codes, key box, Wi-Fi password. Private.")
    updated_at = models.DateTimeField(default=timezone.now)

    listing_started_on = models.DateField(
        null=True, blank=True, help_text="The day the listing went live; the free trial starts here."
    )
    trial_months = models.PositiveSmallIntegerField(
        default=TRIAL_MONTHS, help_text="Free months after going live, before listing year 1 and its fee start."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["owner__name", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.owner})"

    @property
    def forwarding_address(self) -> str:
        """Where the owner forwards Nettimökki booking emails, e.g. bookings+3f9a1c2e@rantio.fi."""
        local, _, domain = settings.BOOKING_FORWARD_ADDRESS.partition("@")
        return f"{local}+{self.inbound_code}@{domain}"

    @property
    def currency(self) -> str:
        """Prices and payouts are in the cottage country's currency (Swedish cottages in SEK)."""
        return COUNTRY_CURRENCY.get(self.country, "EUR")

    def listing_year_on(self, day: date) -> int | None:
        """0 during the free trial, 1 for the 12 months after it, 2 for the next, and so on."""
        if not self.listing_started_on or day < self.listing_started_on:
            return None
        if day < self.trial_ends_on:
            return 0
        year = 1
        while self.listing_year_starts_on(year + 1) <= day:
            year += 1
        return year

    @property
    def trial_ends_on(self) -> date | None:
        """The first day after the free trial (the day listing year 1 starts)."""
        return add_months(self.listing_started_on, self.trial_months) if self.listing_started_on else None

    def listing_year_starts_on(self, year: int) -> date:
        return add_months(self.listing_started_on, self.trial_months + LISTING_TERM_MONTHS * (year - 1))

    def yearly_fee(self, year: int) -> Decimal:
        """In the cottage's currency (a Swedish cottage's in kronor)."""
        if year == 1 and self.owner.is_pilot:
            return Decimal("0.00")
        return YEARLY_FEES.get(self.currency, YEARLY_FEE)

    def yearly_fee_vat(self, year: int) -> Decimal:
        return vat_on(self.yearly_fee(year))



def cottage_photo_path(photo: "CottagePhoto", filename: str) -> str:
    """A random name in the cottage's own folder; the extension comes from the checked file type."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"cottages/{photo.cottage_id}/{secrets.token_hex(8)}.{ext}"


class CottageChange(models.Model):
    """What changed in a cottage's listing, and who changed it: the owner, or the team in the admin."""

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, related_name="changes")
    at = models.DateTimeField(auto_now_add=True)
    by = models.CharField(max_length=120)
    action = models.CharField(max_length=30, help_text="edit, publish, pause, archive, photo_add …")
    fields = models.JSONField(default=list, blank=True, help_text="Which fields an edit touched (names only, no values).")

    class Meta:
        ordering = ["-at", "-pk"]

    def __str__(self) -> str:
        return f"{self.cottage.name}: {self.action} by {self.by}"


class CottagePhoto(models.Model):
    """A photo the owner added for the cottage's listings. The first one (lowest position) is the cover."""

    class Kind(models.TextChoices):
        # The same kinds as the guest site's photo tour (frontend/src/lib/listings.ts PhotoKind).
        EXTERIOR = "exterior", "Outside"
        LIVING = "living", "Living room"
        BEDROOM = "bedroom", "Bedroom"
        KITCHEN = "kitchen", "Kitchen and dining"
        SAUNA = "sauna", "Sauna"
        OUTSIDE = "outside", "Surroundings"

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, related_name="photos")
    image = models.FileField(upload_to=cottage_photo_path)
    kind = models.CharField(max_length=10, choices=Kind.choices, default=Kind.EXTERIOR)
    caption = models.CharField(max_length=200, blank=True)
    position = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "pk"]

    def __str__(self) -> str:
        return f"{self.cottage.name}: {self.get_kind_display()} #{self.position + 1}"


@receiver(post_delete, sender=CottagePhoto)
def _remove_photo_file(sender, instance: CottagePhoto, **kwargs):
    """The file goes with the row, also when a whole cottage is deleted, but only once the
    deletion is committed: a rolled-back delete keeps its file."""
    if instance.image:
        storage, name = instance.image.storage, instance.image.name
        transaction.on_commit(lambda: storage.delete(name))



def signup_photo_path(photo: "SignupPhoto", filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "jpg"
    return f"signups/{photo.signup_id}/{secrets.token_hex(8)}.{ext}"


class SignupPhoto(models.Model):
    """A photo sent with the sign-up form; copied to the cottage when its listing is made."""

    signup = models.ForeignKey(OwnerSignup, on_delete=models.CASCADE, related_name="photos")
    image = models.FileField(upload_to=signup_photo_path)
    position = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["position", "pk"]

    def __str__(self) -> str:
        return f"{self.signup.name}: photo {self.position + 1}"


post_delete.connect(_remove_photo_file, sender=SignupPhoto)

class Booking(models.Model):
    """One stay, from any channel. Commission is only charged on Rantio's channels."""

    class Channel(models.TextChoices):
        AIRBNB = "airbnb", "Airbnb"
        BOOKING = "booking", "Booking.com"
        VRBO = "vrbo", "Vrbo"
        EXPEDIA = "expedia", "Expedia"
        AGODA = "agoda", "Agoda"
        GOOGLE = "google", "Google Vacation Rentals"
        HOLIDU = "holidu", "Holidu"
        HOMETOGO = "hometogo", "HomeToGo"
        DIRECT = "direct", "Rantio direct"
        NETTIMOKKI = "nettimokki", "Nettimökki"
        OTHER = "other", "Another listing site"
        OWNER = "owner", "Owner's own booking"

    # Sites the owner already used before Rantio: we sync their calendar but never charge.
    UNCHARGED_CHANNELS = {Channel.NETTIMOKKI, Channel.OTHER, Channel.OWNER}

    cottage = models.ForeignKey(Cottage, on_delete=models.PROTECT, related_name="bookings")
    channel = models.CharField(max_length=12, choices=Channel.choices)
    external_id = models.CharField(max_length=80, blank=True)
    check_in = models.DateField()
    check_out = models.DateField()
    guests = models.PositiveSmallIntegerField(default=1)
    owner_payout = models.DecimalField(
        max_digits=10, decimal_places=2,
        help_text="What the platform pays the owner for the stay, after platform fees, excluding cleaning.",
    )
    cancelled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    @property
    def currency(self) -> str:
        """Payouts and commission are in the cottage's currency."""
        return self.cottage.currency

    class Meta:
        ordering = ["-check_in"]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(check_out__gt=models.F("check_in")), name="booking_check_out_after_check_in"
            ),
            models.UniqueConstraint(
                fields=["channel", "external_id"],
                condition=~models.Q(external_id=""),
                name="booking_unique_external_id_per_channel",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.cottage.name} {self.check_in}–{self.check_out} ({self.get_channel_display()})"

    @property
    def nights(self) -> int:
        return (self.check_out - self.check_in).days

    @property
    def is_chargeable(self) -> bool:
        return not self.cancelled and self.channel not in self.UNCHARGED_CHANNELS

    @property
    def commission(self) -> Decimal:
        if not self.is_chargeable:
            return Decimal("0.00")
        rate = self.cottage.owner.commission_rate / Decimal(100)
        return (self.owner_payout * rate).quantize(CENT, rounding=ROUND_HALF_UP)

    @property
    def commission_vat(self) -> Decimal:
        return vat_on(self.commission)

    @property
    def commission_total(self) -> Decimal:
        return self.commission + self.commission_vat


class CalendarFeed(models.Model):
    """A booking site's calendar link (iCal) that Rantio reads, so its bookings close the dates everywhere."""

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, related_name="feeds")
    channel = models.CharField(max_length=12, choices=Booking.Channel.choices)
    url = models.URLField(max_length=1000)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=300, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["cottage", "channel"]
        constraints = [
            # One calendar per booking site; the owner's other listings (channel "other") can have several.
            models.UniqueConstraint(
                fields=["cottage", "channel"], condition=~models.Q(channel="other"), name="feed_one_per_channel"
            )
        ]

    def __str__(self) -> str:
        return f"{self.cottage.name}: {self.label} calendar"

    @property
    def label(self) -> str:
        """The site's name: for another listing site, the one its link names."""
        link = getattr(self, "link", None) if self.channel == Booking.Channel.OTHER else None
        return link.name if link else self.get_channel_display()

    @property
    def site(self) -> str:
        """The site's id for icons: the channel, or the other listing's site."""
        link = getattr(self, "link", None) if self.channel == Booking.Channel.OTHER else None
        return (link.site or "other") if link else self.channel


class ListingLink(models.Model):
    """A listing the owner already has on another site (Nettimökki, Lomarengas, Mökkivuokra…).
    It shows with the cottage; with the site's calendar link (iCal), its bookings close the dates
    everywhere Rantio lists the cottage."""

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, related_name="links")
    site = models.CharField(max_length=20, blank=True, help_text="A known site's id, or empty for another site.")
    url = models.URLField(max_length=500)
    feed = models.OneToOneField(
        CalendarFeed, on_delete=models.SET_NULL, null=True, blank=True, related_name="link",
        help_text="The site's calendar, when the owner added its link.",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "pk"]
        constraints = [models.UniqueConstraint(fields=["cottage", "url"], name="link_once_per_cottage")]

    def __str__(self) -> str:
        return f"{self.cottage.name}: {self.name}"

    @property
    def name(self) -> str:
        from .listing_links import site_name

        return site_name(self.site, self.url)


class NightPrice(models.Model):
    """A price the owner set for one night; it wins over smart pricing and the usual price."""

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, related_name="night_prices")
    date = models.DateField()
    price = models.DecimalField(max_digits=9, decimal_places=2, validators=[MinValueValidator(Decimal("1"))])
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["cottage", "date"], name="one_price_per_night")]
        ordering = ["cottage", "date"]

    def __str__(self):
        return f"{self.cottage} {self.date}: {self.price}"


class CalendarBlock(models.Model):
    """Dates that aren't free without being a booking here: closed by the owner, or taken
    on a booking site whose calendar we read. `end` is the first free day again."""

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, related_name="blocks")
    feed = models.ForeignKey(CalendarFeed, on_delete=models.CASCADE, null=True, blank=True, related_name="blocks")
    uid = models.CharField(max_length=255, blank=True, help_text="The event's id in the site's calendar.")
    start = models.DateField()
    end = models.DateField()
    note = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["start"]
        constraints = [
            models.CheckConstraint(condition=models.Q(end__gt=models.F("start")), name="block_end_after_start"),
            models.UniqueConstraint(fields=["feed", "uid"], condition=models.Q(feed__isnull=False), name="block_unique_uid_per_feed"),
        ]

    def __str__(self) -> str:
        source = self.feed.get_channel_display() if self.feed else "Owner"
        return f"{self.cottage.name} {self.start}–{self.end} ({source})"

    @property
    def is_owners(self) -> bool:
        return self.feed_id is None


class LoginCode(models.Model):
    """A six-digit code emailed to an owner; signing in needs no password."""

    LIFETIME_MINUTES = 15
    MAX_ATTEMPTS = 5

    owner = models.ForeignKey(Owner, on_delete=models.CASCADE, related_name="login_codes")
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["owner", "-created_at"])]

    def __str__(self) -> str:
        return f"Login code for {self.owner} at {self.created_at:%Y-%m-%d %H:%M}"



class EmailCheck(models.Model):
    """A six-digit code that proves a sign-up's email address is the owner's (owners/email_check.py)."""

    LIFETIME_MINUTES = 30
    MAX_ATTEMPTS = 5

    email = models.EmailField(db_index=True)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"Email check for {self.email} at {self.created_at:%Y-%m-%d %H:%M}"

class RequestStatus(models.TextChoices):
    PENDING = "pending", "Waiting for the owner"
    ACCEPTED = "accepted", "Accepted"
    DECLINED = "declined", "Declined"


class AppDevice(models.Model):
    """An owner signed in on the Rantio phone app: its sign-in key (stored hashed) and push address."""

    LIFETIME_DAYS = 180  # unused this long, the phone has to sign in again

    owner = models.ForeignKey(Owner, on_delete=models.CASCADE, related_name="app_devices")
    token_hash = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=80, blank=True, help_text="The phone's model, as the app reports it.")
    platform = models.CharField(max_length=10, blank=True)
    push_token = models.CharField(max_length=200, blank=True, help_text="Expo push token; empty if notifications are off.")
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-last_used_at"]

    def __str__(self) -> str:
        return f"{self.owner} · {self.name or self.platform or 'phone'}"


class Conversation(models.Model):
    """One guest talking with one cottage's owner.

    Enquiries from rantio.fi (channel "direct") are answered here and the guest reads
    the answer through a private link. Threads from Airbnb, Booking.com and the other
    sites will arrive through the channel manager; until it is connected they exist
    only as demo data and a reply is kept here, not sent to the site.
    """

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, null=True, blank=True, related_name="conversations")
    listing_slug = models.SlugField(max_length=60, blank=True, help_text="Which rantio.fi page the guest wrote from.")
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations")
    channel = models.CharField(max_length=12, choices=Booking.Channel.choices, default=Booking.Channel.DIRECT)
    guest_name = models.CharField(max_length=120)
    guest_email = models.EmailField(blank=True)
    guest_language = models.CharField(max_length=2, choices=Language.choices, default=Language.ENGLISH)
    check_in = models.DateField(null=True, blank=True)
    check_out = models.DateField(null=True, blank=True)
    guests = models.PositiveSmallIntegerField(null=True, blank=True)
    token = models.CharField(max_length=48, unique=True, help_text="The guest's private link to this conversation.")
    request_status = models.CharField(
        max_length=10, choices=RequestStatus.choices, blank=True, default="",
        help_text="Set when the guest asked to book through the owner's booking link.",
    )
    guest_phone = models.CharField(max_length=40, blank=True)
    children = models.PositiveSmallIntegerField(default=0)
    archived = models.BooleanField(default=False)
    owner_read_at = models.DateTimeField(null=True, blank=True)
    guest_read_at = models.DateTimeField(null=True, blank=True)
    guest_push_token = models.CharField(
        max_length=200, blank=True, help_text="Expo push token of the guest's phone, if they use the app and allowed notifications."
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True)
    review_asked_at = models.DateTimeField(null=True, blank=True, help_text="When the guest was asked to rate the stay.")

    class Meta:
        ordering = ["-last_message_at"]

    def __str__(self) -> str:
        return f"{self.guest_name} – {self.cottage.name if self.cottage else self.listing_slug}"

    @property
    def owner(self):
        return self.cottage.owner if self.cottage else None

    @property
    def replies_here(self) -> bool:
        """True when the guest reads replies on rantio.fi, not on a booking site."""
        return self.channel == Booking.Channel.DIRECT


class Message(models.Model):
    class Sender(models.TextChoices):
        GUEST = "guest", "Guest"
        HOST = "host", "Host"

    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=5, choices=Sender.choices)
    body = models.TextField(max_length=4000)
    created_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["created_at", "pk"]

    def __str__(self) -> str:
        return f"{self.get_sender_display()}: {self.body[:40]}"


class ExchangeRate(models.Model):
    """The European Central Bank's reference rate for the day: units of a currency per 1 EUR."""

    currency = models.CharField(max_length=3, primary_key=True)
    per_eur = models.DecimalField(max_digits=12, decimal_places=4)
    rate_date = models.DateField(help_text="The day the ECB published the rate.")
    fetched_at = models.DateTimeField()

    class Meta:
        ordering = ["currency"]

    def __str__(self) -> str:
        return f"1 EUR = {self.per_eur} {self.currency} ({self.rate_date})"


class HeroSlide(models.Model):
    """A photo or a short video at the top of the rantio.fi homepage, in the order set in the admin."""

    class Kind(models.TextChoices):
        IMAGE = "image", "Photo"
        VIDEO = "video", "Video"

    class Focus(models.TextChoices):
        CENTER = "center", "Centre"
        LEFT = "left center", "Left"
        RIGHT = "right center", "Right"
        TOP = "center top", "Top"
        BOTTOM = "center bottom", "Bottom"

    title = models.CharField(max_length=120, help_text="For you in the admin, e.g. 'Saimaa at sunset'.")
    kind = models.CharField(
        max_length=5, choices=Kind.choices, default=Kind.IMAGE,
        help_text="Set from the file you add: a video makes it a video slide.",
    )
    # Limits and previews are in the upload box (templates/admin/owners/heroslide/upload.html).
    image = models.FileField(
        upload_to="hero/", blank=True,
        help_text="",
    )
    image_url = models.URLField(
        "Photo address", max_length=500, blank=True,
        help_text="A photo on the web instead of an upload (the site's original lake photo is one).",
    )
    video = models.FileField(
        upload_to="hero/", blank=True,
        help_text="",
    )
    alt = models.CharField(
        "Description", max_length=200, blank=True,
        help_text="What the picture shows, for people using screen readers, e.g. 'Red cottages by a calm lake'.",
    )
    focus = models.CharField(
        max_length=16, choices=Focus.choices, default=Focus.CENTER,
        help_text="Which part stays in view when the screen crops the picture (phones crop the sides).",
    )
    seconds = models.PositiveSmallIntegerField(
        default=7, validators=[MinValueValidator(3)],
        help_text="How long a photo stays before the next slide. A video plays to its end.",
    )
    video_seconds = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True, editable=False)
    active = models.BooleanField(default=True, help_text="Shown on the homepage.")
    order = models.PositiveIntegerField(default=0, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]
        verbose_name = "homepage slide"

    def __str__(self) -> str:
        return self.title


class InboundEmail(models.Model):
    """A booking email forwarded to Rantio (Nettimökki has no calendar sync), and what was read from it."""

    class Status(models.TextChoices):
        BOOKED = "booked", "Booking added"
        CANCELLED = "cancelled", "Booking cancelled"
        CONFLICT = "conflict", "Added — overlaps another booking"
        REVIEW = "review", "Needs a look"
        DUPLICATE = "duplicate", "Already read"
        IGNORED = "ignored", "Ignored"

    message_id = models.CharField(max_length=300, blank=True, db_index=True)
    received_at = models.DateTimeField(default=timezone.now)
    from_address = models.CharField(max_length=300, blank=True)
    to_address = models.CharField(max_length=500, blank=True)
    subject = models.CharField(max_length=300, blank=True)
    body = models.TextField(blank=True, help_text="The email as plain text.")
    raw = models.TextField(blank=True, help_text="The whole email as received, for reading it again.")
    cottage = models.ForeignKey(Cottage, on_delete=models.SET_NULL, null=True, blank=True, related_name="inbound_emails")
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name="inbound_emails")
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.REVIEW, db_index=True)
    note = models.CharField(max_length=300, blank=True, help_text="Why it needs a look, or what was found.")

    class Meta:
        ordering = ["-received_at"]

    def __str__(self) -> str:
        return self.subject or f"Email {self.pk}"


class Invoice(models.Model):
    """One owner's monthly bill: commission on stays from Rantio's channels and yearly fees, with VAT,
    in the owner's currency (the one most of their cottages are in)."""

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        SENT = "sent", "Sent"
        PAID = "paid", "Paid"
        VOID = "void", "Cancelled"

    owner = models.ForeignKey(Owner, on_delete=models.PROTECT, related_name="invoices")
    month = models.DateField(help_text="First day of the month the invoice covers (stays by check-in day).")
    number = models.CharField(max_length=20, unique=True)
    status = models.CharField(max_length=5, choices=Status.choices, default=Status.DRAFT, db_index=True)
    currency = models.CharField(max_length=3, default="EUR")
    lines = models.JSONField(default=list)
    subtotal = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    vat = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    rates_date = models.CharField(max_length=10, blank=True, help_text="ECB rate date used for non-euro stays.")
    stripe_invoice_id = models.CharField(max_length=40, blank=True)
    stripe_url = models.URLField(blank=True, help_text="The invoice page Stripe sends the owner.")
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-month", "owner__name"]
        constraints = [models.UniqueConstraint(fields=["owner", "month"], name="invoice_one_per_owner_month")]

    def __str__(self) -> str:
        return f"{self.number} · {self.owner} · {self.month:%m/%Y}"


class Review(models.Model):
    """A guest's rating of a stay booked through Rantio's booking link.

    Only a guest whose request the owner accepted, and whose stay has ended, can write one:
    it is opened with the conversation's private link, so every review comes from a real stay.
    """

    conversation = models.OneToOneField(Conversation, on_delete=models.CASCADE, related_name="review")
    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, related_name="reviews")
    rating = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(5)])
    cleanliness = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    location = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    value = models.PositiveSmallIntegerField(null=True, blank=True, validators=[MinValueValidator(1), MaxValueValidator(5)])
    comment = models.TextField(max_length=2000, blank=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.ENGLISH)
    owner_reply = models.TextField(max_length=1000, blank=True)
    replied_at = models.DateTimeField(null=True, blank=True)
    hidden = models.BooleanField(default=False, help_text="Hidden by Rantio (e.g. abusive or not about the stay).")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.rating}★ {self.cottage.name} – {self.conversation.guest_name}"


class ExternalRating(models.Model):
    """The cottage's score on another site (Airbnb, Booking.com…), as the owner gives it, with a link
    to the listing so guests can check it. Only the score is shown, never the site's reviews."""

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, related_name="external_ratings")
    site = models.CharField(max_length=20)
    score = models.DecimalField(max_digits=3, decimal_places=1)
    scale = models.PositiveSmallIntegerField(default=5, help_text="Booking.com scores out of 10, the others out of 5.")
    count = models.PositiveIntegerField()
    url = models.URLField(max_length=500)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["site"]
        constraints = [models.UniqueConstraint(fields=["cottage", "site"], name="one_rating_per_site")]

    def __str__(self) -> str:
        return f"{self.cottage.name}: {self.score}/{self.scale} on {self.site}"


class MonitorDevice(models.Model):
    """A Mökki monitor box. Made with a serial, a claim code (on the box's sticker, for the host to
    connect it in the app) and a secret (flashed into the firmware, sent with every reading).
    Only hashes of the code and the secret are kept."""

    serial = models.CharField(max_length=16, unique=True)
    claim_code_hash = models.CharField(max_length=64)
    secret_hash = models.CharField(max_length=64)
    owner = models.ForeignKey(Owner, on_delete=models.SET_NULL, null=True, blank=True, related_name="monitors")
    cottage = models.ForeignKey(Cottage, on_delete=models.SET_NULL, null=True, blank=True, related_name="monitors")
    name = models.CharField(max_length=60, blank=True)
    frost_limit = models.DecimalField(max_digits=4, decimal_places=1, default=Decimal("5.0"), help_text="°C inside; colder alerts.")
    arrival_temp = models.DecimalField(max_digits=4, decimal_places=1, default=Decimal("18.0"), help_text="°C guests should find on arrival.")
    sauna_hours = models.PositiveSmallIntegerField(default=4, help_text="A hot sauna for longer than this alerts.")
    firmware = models.CharField(max_length=30, blank=True)
    last_seen_at = models.DateTimeField(null=True, blank=True)
    last = models.JSONField(default=dict, blank=True, help_text="The latest reading, for a quick look.")
    claimed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["serial"]
        verbose_name = "Mökki monitor"

    def __str__(self) -> str:
        return self.serial


class MonitorReading(models.Model):
    """What the box measured at one moment. Anything it lacks a sensor for stays empty."""

    device = models.ForeignKey(MonitorDevice, on_delete=models.CASCADE, related_name="readings")
    at = models.DateTimeField()
    temp_inside = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    temp_sauna = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    humidity = models.PositiveSmallIntegerField(null=True, blank=True)
    leak = models.BooleanField(null=True, blank=True)
    door_open = models.BooleanField(null=True, blank=True)
    mains = models.BooleanField(null=True, blank=True, help_text="Mains power present; false: on battery.")
    battery = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Percent.")
    signal = models.SmallIntegerField(null=True, blank=True, help_text="Mobile signal, dBm (RSRP).")

    class Meta:
        ordering = ["-at"]
        indexes = [models.Index(fields=["device", "-at"])]


class MonitorAlert(models.Model):
    """Something the host was told about. Open while ended_at is empty."""

    class Kind(models.TextChoices):
        FROST = "frost", "Frost risk"
        LEAK = "leak", "Water leak"
        POWER = "power", "Power cut"
        SAUNA = "sauna", "Sauna left on"
        DOOR = "door", "Door opened while empty"
        BATTERY = "battery", "Battery low"
        OFFLINE = "offline", "Not heard from"
        ARRIVAL = "arrival", "Cold before guests arrive"

    device = models.ForeignKey(MonitorDevice, on_delete=models.CASCADE, related_name="alerts")
    kind = models.CharField(max_length=10, choices=Kind.choices)
    started_at = models.DateTimeField(default=timezone.now)
    ended_at = models.DateTimeField(null=True, blank=True)
    value = models.CharField(max_length=60, blank=True, help_text="The reading that set it off, e.g. 3.5 °C; for arrival, the stay.")

    class Meta:
        ordering = ["-started_at"]

    def __str__(self) -> str:
        return f"{self.device} {self.kind} {self.started_at:%Y-%m-%d %H:%M}"

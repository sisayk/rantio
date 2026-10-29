import calendar
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

# Plan decisions (Business and Implementation Plan, 28 Oct 2026):
# - €99 yearly fee per cottage, invoiced when each listing year starts;
#   pilot owners' first year is free.
# - Commission is a share of the owner's payout for the stay (after platform
#   fees, cleaning fees excluded); Nettimökki bookings are never charged.
# - Both carry Finnish VAT.
STANDARD_COMMISSION_RATE = Decimal("12.00")
PILOT_COMMISSION_RATE = Decimal("10.00")
YEARLY_FEE = Decimal("99.00")
VAT_RATE = Decimal("25.50")
LISTING_TERM_MONTHS = 12

CENT = Decimal("0.01")


def add_months(day: date, months: int) -> date:
    total = day.month - 1 + months
    year, month = day.year + total // 12, total % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


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
# Stugora's own yearly fee is set and invoiced in euros.
COUNTRY_CURRENCY = {"FI": "EUR", "EE": "EUR", "LV": "EUR", "LT": "EUR", "SE": "SEK", "NO": "NOK", "DK": "DKK", "IS": "ISK"}
CURRENCIES = ("EUR", "SEK", "NOK", "DKK", "ISK")


class Region(models.TextChoices):
    """Finnish regions only; other countries leave region blank."""

    SAIMAA = "saimaa", "Saimaa lake region"
    LAKELAND = "lakeland", "Other Lakeland"
    LAPLAND = "lapland", "Lapland"
    HELSINKI = "helsinki", "Helsinki region"
    COAST = "coast", "Coast and archipelago"
    OTHER = "other", "Elsewhere in Finland"


class OwnerSignup(models.Model):
    """An owner who filled in the stugora.fi sign-up form."""

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
    region = models.CharField(max_length=20, choices=Region.choices, blank=True)
    cottage_count = models.PositiveSmallIntegerField(default=1, validators=[MinValueValidator(1)])
    nettimokki_url = models.URLField(blank=True)
    message = models.TextField(blank=True, max_length=2000)
    privacy_consent = models.BooleanField(default=False)
    source = models.CharField(max_length=80, blank=True, help_text="utm_source or referral")

    status = models.CharField(max_length=12, choices=Status.choices, default=Status.NEW)
    internal_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.name} <{self.email}>"

    @property
    def location_display(self) -> str:
        if self.region:
            return f"{self.get_region_display()}, {self.get_country_display()}"
        return self.get_country_display()


class Owner(models.Model):
    """A cottage owner who has signed the service agreement."""

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owner", null=True, blank=True
    )
    signup = models.OneToOneField(OwnerSignup, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)
    phone = models.CharField(max_length=40, blank=True)
    language = models.CharField(max_length=2, choices=Language.choices, default=Language.FINNISH)

    is_pilot = models.BooleanField(default=False)
    commission_rate = models.DecimalField(
        max_digits=5, decimal_places=2, default=STANDARD_COMMISSION_RATE,
        help_text="Percent of the owner's payout, before VAT.",
    )
    vat_registered = models.BooleanField(
        default=False, help_text="Owner can reclaim VAT (business owners only)."
    )
    agreement_signed_on = models.DateField(null=True, blank=True)
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

    owner = models.ForeignKey(Owner, on_delete=models.CASCADE, related_name="cottages")
    name = models.CharField(max_length=120)
    country = models.CharField(max_length=2, choices=Country.choices, default=Country.FINLAND)
    region = models.CharField(max_length=20, choices=Region.choices, blank=True)
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
    listing_slug = models.SlugField(
        max_length=60, blank=True, db_index=True,
        help_text="The cottage's address on stugora.fi, e.g. lakeside-villa for /fi/cottages/lakeside-villa.",
    )
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.INTAKE)
    listing_started_on = models.DateField(
        null=True, blank=True, help_text="First day of listing year 1; each year renews with the yearly fee."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["owner__name", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.owner})"

    @property
    def currency(self) -> str:
        """Prices and payouts are in the cottage country's currency (Swedish cottages in SEK)."""
        return COUNTRY_CURRENCY.get(self.country, "EUR")

    def listing_year_on(self, day: date) -> int | None:
        """1 for the first 12 months after listing_started_on, 2 for the next, and so on."""
        if not self.listing_started_on or day < self.listing_started_on:
            return None
        year = 1
        while add_months(self.listing_started_on, LISTING_TERM_MONTHS * year) <= day:
            year += 1
        return year

    def listing_year_starts_on(self, year: int) -> date:
        return add_months(self.listing_started_on, LISTING_TERM_MONTHS * (year - 1))

    def yearly_fee(self, year: int) -> Decimal:
        if year == 1 and self.owner.is_pilot:
            return Decimal("0.00")
        return YEARLY_FEE

    def yearly_fee_vat(self, year: int) -> Decimal:
        return vat_on(self.yearly_fee(year))


class Booking(models.Model):
    """One stay, from any channel. Commission is only charged on Stugora's channels."""

    class Channel(models.TextChoices):
        AIRBNB = "airbnb", "Airbnb"
        BOOKING = "booking", "Booking.com"
        VRBO = "vrbo", "Vrbo"
        EXPEDIA = "expedia", "Expedia"
        GOOGLE = "google", "Google Vacation Rentals"
        HOLIDU = "holidu", "Holidu"
        HOMETOGO = "hometogo", "HomeToGo"
        DIRECT = "direct", "Stugora direct"
        NETTIMOKKI = "nettimokki", "Nettimökki"
        OWNER = "owner", "Owner's own booking"

    # Sites the owner already used before Stugora: we sync their calendar but never charge.
    UNCHARGED_CHANNELS = {Channel.NETTIMOKKI, Channel.OWNER}

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


class Conversation(models.Model):
    """One guest talking with one cottage's owner.

    Enquiries from stugora.fi (channel "direct") are answered here and the guest reads
    the answer through a private link. Threads from Airbnb, Booking.com and the other
    sites will arrive through the channel manager; until it is connected they exist
    only as demo data and a reply is kept here, not sent to the site.
    """

    cottage = models.ForeignKey(Cottage, on_delete=models.CASCADE, null=True, blank=True, related_name="conversations")
    listing_slug = models.SlugField(max_length=60, blank=True, help_text="Which stugora.fi page the guest wrote from.")
    booking = models.ForeignKey(Booking, on_delete=models.SET_NULL, null=True, blank=True, related_name="conversations")
    channel = models.CharField(max_length=12, choices=Booking.Channel.choices, default=Booking.Channel.DIRECT)
    guest_name = models.CharField(max_length=120)
    guest_email = models.EmailField(blank=True)
    guest_language = models.CharField(max_length=2, choices=Language.choices, default=Language.ENGLISH)
    check_in = models.DateField(null=True, blank=True)
    check_out = models.DateField(null=True, blank=True)
    guests = models.PositiveSmallIntegerField(null=True, blank=True)
    token = models.CharField(max_length=48, unique=True, help_text="The guest's private link to this conversation.")
    archived = models.BooleanField(default=False)
    owner_read_at = models.DateTimeField(null=True, blank=True)
    guest_read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_message_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-last_message_at"]

    def __str__(self) -> str:
        return f"{self.guest_name} – {self.cottage.name if self.cottage else self.listing_slug}"

    @property
    def owner(self):
        return self.cottage.owner if self.cottage else None

    @property
    def replies_here(self) -> bool:
        """True when the guest reads replies on stugora.fi, not on a booking site."""
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

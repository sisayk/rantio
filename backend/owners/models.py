import calendar
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

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
    FINNISH = "fi", "Suomi"
    SWEDISH = "sv", "Svenska"
    ENGLISH = "en", "English"


class Country(models.TextChoices):
    FINLAND = "FI", "Finland"
    SWEDEN = "SE", "Sweden"
    NORWAY = "NO", "Norway"
    DENMARK = "DK", "Denmark"
    ICELAND = "IS", "Iceland"
    ESTONIA = "EE", "Estonia"
    LATVIA = "LV", "Latvia"
    LITHUANIA = "LT", "Lithuania"


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
        max_digits=8, decimal_places=2, help_text="EUR the owner wants to net per night."
    )
    cleaning_fee = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal("0.00"))
    min_nights = models.PositiveSmallIntegerField(default=2)
    house_rules = models.TextField(blank=True)
    description_fi = models.TextField(blank=True)
    description_en = models.TextField(blank=True)
    nettimokki_url = models.URLField(blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.INTAKE)
    listing_started_on = models.DateField(
        null=True, blank=True, help_text="First day of listing year 1; each year renews with the yearly fee."
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["owner__name", "name"]

    def __str__(self) -> str:
        return f"{self.name} ({self.owner})"

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
        GOOGLE = "google", "Google Vacation Rentals"
        DIRECT = "direct", "Stugora direct"
        NETTIMOKKI = "nettimokki", "Nettimökki"

    UNCHARGED_CHANNELS = {Channel.NETTIMOKKI}

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

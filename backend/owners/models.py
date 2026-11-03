import calendar
import secrets
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver
from django.utils import timezone

from .regions import REGION_CHOICES, REGIONS

# Plan decisions (Business and Implementation Plan, 28 Oct 2026):
# - €99 yearly fee per cottage (or the set amount in the cottage's own currency,
#   YEARLY_FEES), invoiced when each listing year starts; pilot owners' first year is free.
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
    airbnb_cohost_payout = models.BooleanField(
        default=True,
        help_text="Rantio is co-host on the owner's Airbnb listings and Airbnb pays the commission to Rantio "
        "directly, so Airbnb stays are left off the monthly invoice.",
    )
    stripe_customer_id = models.CharField(max_length=40, blank=True, editable=False)
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
    address = models.CharField(max_length=200, blank=True, help_text="Street address. Never shown to guests before a booking.")
    latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    show_exact_location = models.BooleanField(
        default=False, help_text="Guests see the exact pin before booking; otherwise an area about 1 km across."
    )
    nearby = models.JSONField(default=list, blank=True, help_text="[{\"kind\": \"lake\", \"name\": \"…\", \"distance_km\": 0.2}]")
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
        null=True, blank=True, help_text="First day of listing year 1; each year renews with the yearly fee."
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


class Booking(models.Model):
    """One stay, from any channel. Commission is only charged on Rantio's channels."""

    class Channel(models.TextChoices):
        AIRBNB = "airbnb", "Airbnb"
        BOOKING = "booking", "Booking.com"
        VRBO = "vrbo", "Vrbo"
        EXPEDIA = "expedia", "Expedia"
        GOOGLE = "google", "Google Vacation Rentals"
        HOLIDU = "holidu", "Holidu"
        HOMETOGO = "hometogo", "HomeToGo"
        DIRECT = "direct", "Rantio direct"
        NETTIMOKKI = "nettimokki", "Nettimökki"
        OWNER = "owner", "Owner's own booking"

    # Sites the owner already used before Rantio: we sync their calendar but never charge.
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
        constraints = [models.UniqueConstraint(fields=["cottage", "channel"], name="feed_one_per_channel")]

    def __str__(self) -> str:
        return f"{self.cottage.name}: {self.get_channel_display()} calendar"


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
    kind = models.CharField(max_length=5, choices=Kind.choices, default=Kind.IMAGE)
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

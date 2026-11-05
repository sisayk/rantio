"""Owner listing API: Hosting → Listings and the listing editor.

  GET    /api/owner/cottages/                          every cottage with status, completeness, channels, stays
  POST   /api/owner/cottages/                          {"name"} a new draft
  GET    /api/owner/cottages/<id>/                     everything the owner can edit, private fields included
  PATCH  /api/owner/cottages/<id>/                     change any of it; descriptions merge per language, and a
                                                       language the owner writes is translated into the rest (translate.py)
  DELETE /api/owner/cottages/<id>/                     {"confirm": name} only with no bookings or messages
  POST   /api/owner/cottages/<id>/status/              {"action": publish|pause|relist|archive|restore}
  POST   /api/owner/cottages/<id>/translate/           {"source"?} Claude fills the languages the owner hasn't written
  POST   /api/owner/cottages/<id>/duplicate/           a draft copy with the same details and photos
  GET    /api/owner/cottages/<id>/preview/             the listing as guests would see it (no private fields)
  POST   /api/owner/cottages/<id>/photos/              add a photo (multipart: "file", optional "kind", "caption")
  PATCH  /api/owner/cottages/<id>/photos/<pid>/        room or caption
  POST   /api/owner/cottages/<id>/photos/<pid>/replace/  a new file for the same place in the gallery
  DELETE /api/owner/cottages/<id>/photos/<pid>/        remove a photo and, once that is committed, its file
  POST   /api/owner/cottages/<id>/photos/order/        {"ids": [...]} new order; the first is the cover
  GET    /api/owner/cottages/<id>/prices/?from=&days=  each night's price and why (owners/pricing.py)
  POST   /api/owner/cottages/<id>/prices/              {"start", "end", "price"} set nights' price; price null: back to automatic

Every view looks the cottage up among the signed-in owner's own (404 for anyone else's).
Changes here are Rantio's own listing. Airbnb, Booking.com, Vrbo and Nettimökki keep their
own listings: the team copies changes there until a channel manager is connected, and a
calendar link (iCal) only carries dates, never texts, photos or prices.
"""

from datetime import date, time, timedelta
from decimal import Decimal

from django.core.files.base import ContentFile
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import parsers, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import calendar, pricing, translate
from .calendar import FEED_CHANNELS
from .listing_links import links_for, sync_nettimokki
from .media_checks import IMAGE_MAX, image_type
from .models import Booking, CalendarFeed, Conversation, Cottage, CottageChange, CottagePhoto, Language, NightPrice
from .portal import IsOwner
from .regions import REGION_CHOICES, valid_region

MAX_PHOTOS = 40
SUGGESTED_PHOTOS = 5
LANGS = set(Language.values)

# What a cottage can have. The first set are the guest site's filter keys
# (frontend/src/lib/catalog.ts FEATURE_GROUPS); the rest are editor-only
# (frontend/src/lib/amenities.ts). Keep the lists the same.
WATER = {"lake", "sea", "river", "pond"}
SAUNAS = {"electricSauna", "smokeSauna", "woodSauna"}
FILTER_KEYS = WATER | SAUNAS | {
    "instantBook", "freeCancellation",
    "privateShore", "sharedShore", "shoreAccess", "waterAccess",
    "dishwasher", "fridge", "cooking", "microwave", "freezer", "stove", "oven", "coffeeMaker", "grillHut",
    "nearSki", "internet", "dryingCabinet", "tumbleDryer", "jetty", "loft", "hotTub", "jacuzzi",
    "washingMachine", "highChair", "shower", "evCharging", "fireplace", "tv", "pool", "outdoorJacuzzi",
    "babyBed", "noElectricity", "solarPower", "carriedWater", "heatPump", "indoorWc", "outdoorWc",
    "boat", "canoe", "pets",
    "wheelchair",
}
EDITOR_KEYS = {
    "airConditioning", "bedLinen", "towels", "parking", "fishingGear", "firepit", "barbecue", "firewood",
    "toys", "stairGates", "playground", "terrace", "balcony", "garden", "outdoorDining", "privateParking",
    "stepFree", "accessibleBathroom", "accessibleParking", "smokeAlarm", "coAlarm", "fireExtinguisher", "firstAid",
}
FEATURE_KEYS = FILTER_KEYS | EDITOR_KEYS
NEARBY_KINDS = {"lake", "beach", "ski", "hiking", "grocery", "restaurant", "transport", "evCharging", "airport", "station", "other"}

# A site's calendar is read every 15 minutes; two hours without a good read needs a look.
STALE_AFTER = timedelta(hours=2)

PRIVATE_FIELDS = {"address", "arrival_instructions", "departure_instructions", "access_details"}


def money(value: Decimal | None) -> str | None:
    return None if value is None else f"{value:.2f}"


def hhmm(value: time | None) -> str | None:
    return value.strftime("%H:%M") if value else None


def photo_row(p: CottagePhoto) -> dict:
    return {"id": p.pk, "url": p.image.url, "kind": p.kind, "caption": p.caption}


def descriptions_of(c: Cottage) -> dict:
    texts = {k: v for k, v in (c.descriptions or {}).items() if k in LANGS and v}
    # Older rows and the admin still write the two original fields.
    if c.description_en.strip() and not texts.get("en"):
        texts["en"] = c.description_en
    if c.description_fi.strip() and not texts.get("fi"):
        texts["fi"] = c.description_fi
    return texts


# ---------- completeness ----------

def checklist(c: Cottage, photo_count: int, feed_count: int) -> list[dict]:
    """What the listing has and lacks. Only `essential` items stop it being published."""
    items = [
        ("cover", photo_count >= 1, True),
        ("description", bool(descriptions_of(c)), True),
        ("location", bool(c.municipality.strip()), True),
        ("price", c.price_per_night > 0, True),
        ("photos", photo_count >= SUGGESTED_PHOTOS, False),
        ("pin", c.latitude is not None and c.longitude is not None, False),
        ("amenities", len(c.amenities or []) >= 3, False),
        ("rules", bool(c.check_in_from and c.check_out_by), False),
        ("arrival", bool(c.arrival_instructions.strip()), False),
        ("availability", feed_count > 0, False),
    ]
    return [{"key": k, "done": done, "essential": essential} for k, done, essential in items]


def completeness(items: list[dict]) -> int:
    return round(100 * sum(i["done"] for i in items) / len(items))


def missing_essentials(items: list[dict]) -> list[str]:
    return [i["key"] for i in items if i["essential"] and not i["done"]]


# ---------- channels ----------

def channel_rows(c: Cottage, now) -> list[dict]:
    """Each site's calendar connection. This is calendar sync only: texts, photos and prices
    on those sites are kept separately."""
    feeds = {f.channel: f for f in c.feeds.all()}
    rows = []
    for channel in FEED_CHANNELS:
        f = feeds.get(channel)
        if not f:
            state = "not_connected"
        elif f.last_error:
            state = "failed"
        elif not f.last_synced_at:
            state = "pending"
        elif now - f.last_synced_at > STALE_AFTER:
            state = "attention"
        else:
            state = "connected"
        rows.append({
            "channel": channel,
            "state": state,
            "last_synced_at": f.last_synced_at.isoformat() if f and f.last_synced_at else None,
            "error": f.last_error if f else "",
            "url": f.url if f else "",
            "feed_id": f.pk if f else None,
        })
    rows.append({
        "channel": Booking.Channel.NETTIMOKKI,
        # Nettimökki has no calendar link: its booking emails are forwarded to Rantio.
        "state": "email" if c.nettimokki_url else "not_connected",
        "last_synced_at": None, "error": "", "url": c.nettimokki_url, "feed_id": None,
    })
    return rows


def stays(c: Cottage, today: date) -> dict:
    upcoming = [b for b in c.bookings.all() if not b.cancelled and b.check_out > today]
    upcoming.sort(key=lambda b: b.check_in)
    horizon = today + timedelta(days=30)
    booked = sum(max((min(b.check_out, horizon) - max(b.check_in, today)).days, 0) for b in upcoming)
    nxt = next((b for b in upcoming if b.check_in >= today), None)
    out = next((b for b in upcoming if b.check_in < today), None)  # staying now
    return {
        "upcoming_count": len(upcoming),
        "next_check_in": nxt.check_in.isoformat() if nxt else None,
        "next_check_out": (out or nxt).check_out.isoformat() if (out or nxt) else None,
        "occupancy_30": round(booked / 30, 2),
        "upcoming": [
            {"id": b.pk, "channel": b.channel, "check_in": b.check_in.isoformat(), "check_out": b.check_out.isoformat(), "guests": b.guests}
            for b in upcoming[:5]
        ],
    }


def cottage_summary(c: Cottage, today: date, now) -> dict:
    photos = list(c.photos.all())
    feeds = list(c.feeds.all())
    items = checklist(c, len(photos), len(feeds))
    channels = channel_rows(c, now)
    return {
        "id": c.pk,
        "name": c.name,
        "property_type": c.property_type,
        "country": c.country,
        "region": c.region,
        "municipality": c.municipality,
        "status": c.status,
        "max_guests": c.max_guests,
        "bedrooms": c.bedrooms,
        "bathrooms": c.bathrooms,
        "beds": c.beds,
        "price_per_night": money(c.price_per_night),
        "currency": c.currency,
        "cover": photos[0].image.url if photos else None,
        "photo_count": len(photos),
        "amenity_count": len(c.amenities or []),
        "has_description": bool(descriptions_of(c)),
        "completeness": completeness(items),
        "missing": missing_essentials(items),
        "channels": channels,
        "attention": any(ch["state"] in ("failed", "attention") for ch in channels),
        "updated_at": c.updated_at.isoformat(),
        **stays(c, today),
    }


def cottage_detail(c: Cottage) -> dict:
    today, now = timezone.localdate(), timezone.now()
    return {
        **cottage_summary(c, today, now),
        "checklist": checklist(c, c.photos.count(), c.feeds.count()),
        "floor_area": c.floor_area,
        "floors": c.floors,
        "host_languages": list(c.host_languages or []),
        "descriptions": descriptions_of(c),
        "descriptions_auto": {k: v for k, v in (c.descriptions_auto or {}).items() if k in descriptions_of(c)},
        "translation": {"enabled": translate.enabled(), **translate.state(c)},
        "address": c.address,
        "latitude": None if c.latitude is None else float(c.latitude),
        "longitude": None if c.longitude is None else float(c.longitude),
        "show_exact_location": c.show_exact_location,
        "property_id": c.property_id,
        "licence_number": c.licence_number,
        "nearby": list(c.nearby or []),
        "amenities": list(c.amenities or []),
        "amenity_notes": dict(c.amenity_notes or {}),
        "min_nights": c.min_nights,
        "max_nights": c.max_nights,
        "cleaning_fee": money(c.cleaning_fee),
        "weekend_price": money(c.weekend_price),
        "extra_guest_fee": money(c.extra_guest_fee),
        "extra_guest_from": c.extra_guest_from,
        "pet_fee": money(c.pet_fee),
        "weekly_discount": c.weekly_discount,
        "monthly_discount": c.monthly_discount,
        "security_deposit": money(c.security_deposit),
        "smart_pricing": c.smart_pricing,
        "smart_min_price": money(c.smart_min_price),
        "smart_max_price": money(c.smart_max_price),
        "seasonal_prices": list(c.seasonal_prices or []),
        "taxes_note": c.taxes_note,
        "check_in_from": hhmm(c.check_in_from),
        "check_in_until": hhmm(c.check_in_until),
        "check_out_by": hhmm(c.check_out_by),
        "self_check_in": c.self_check_in,
        "min_age": c.min_age,
        "pets_allowed": c.pets_allowed,
        "smoking_allowed": c.smoking_allowed,
        "events_allowed": c.events_allowed,
        "quiet_hours": c.quiet_hours,
        "house_rules": c.house_rules,
        "waste_instructions": c.waste_instructions,
        "sauna_instructions": c.sauna_instructions,
        "fireplace_instructions": c.fireplace_instructions,
        "arrival_instructions": c.arrival_instructions,
        "departure_instructions": c.departure_instructions,
        "access_details": c.access_details,
        "nettimokki_url": c.nettimokki_url,
        "links": links_for(c),
        "booking_link_open": c.booking_requests_open,
        "forwarding_address": c.forwarding_address,
        "photos": [photo_row(p) for p in c.photos.all()],
        "history": [
            {"at": h.at.isoformat(), "by": h.by, "action": h.action, "fields": h.fields}
            for h in c.changes.all()[:20]
        ],
    }


def approximate(value: Decimal | None) -> float | None:
    """About 1 km: two decimals of a degree, the way booking sites hide the exact spot."""
    return None if value is None else round(float(value), 2)


def cottage_preview(c: Cottage) -> dict:
    """The listing as a guest would see it. Nothing private: no address, door codes or arrival notes."""
    today = timezone.localdate()
    exact = c.show_exact_location
    d = cottage_detail(c)
    public = {k: v for k, v in d.items() if k not in PRIVATE_FIELDS and k not in {"history", "forwarding_address", "channels", "checklist", "missing", "completeness", "upcoming", "attention"}}
    public["latitude"] = d["latitude"] if exact else approximate(c.latitude)
    public["longitude"] = d["longitude"] if exact else approximate(c.longitude)
    public["busy"] = [
        {"start": s.isoformat(), "end": e.isoformat()}
        for s, e in calendar.busy_ranges(c, today, today + timedelta(days=180))
    ]
    return public


# ---------- editing ----------

class NoteSerializer(serializers.Serializer):
    note = serializers.CharField(max_length=200, allow_blank=True, required=False, trim_whitespace=True, default="")
    fee = serializers.DecimalField(max_digits=9, decimal_places=2, min_value=Decimal("0"), required=False, allow_null=True)


class SeasonSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=60, trim_whitespace=True)
    start = serializers.RegexField(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
    end = serializers.RegexField(r"^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$")
    price = serializers.DecimalField(max_digits=9, decimal_places=2, min_value=Decimal("0"))


class NearbySerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=sorted(NEARBY_KINDS))
    name = serializers.CharField(max_length=120, trim_whitespace=True)
    distance_km = serializers.DecimalField(max_digits=6, decimal_places=1, min_value=Decimal("0"), required=False, allow_null=True)


def text(max_length: int, **kw):
    return serializers.CharField(max_length=max_length, allow_blank=True, required=False, trim_whitespace=True, **kw)


def amount(**kw):
    return serializers.DecimalField(max_digits=9, decimal_places=2, min_value=Decimal("0"), required=False, **kw)


class CottageSerializer(serializers.ModelSerializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True, min_length=1)
    property_type = serializers.ChoiceField(choices=Cottage.PropertyType.choices, required=False)
    country = serializers.ChoiceField(choices=Cottage._meta.get_field("country").choices, required=False)
    # One of the country's official regions (regions.py); blank when not chosen yet.
    region = serializers.ChoiceField(choices=[("", "")] + list(REGION_CHOICES), required=False, allow_blank=True)
    municipality = text(80)
    address = text(200)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6, min_value=Decimal("-90"), max_value=Decimal("90"), required=False, allow_null=True)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6, min_value=Decimal("-180"), max_value=Decimal("180"), required=False, allow_null=True)
    max_guests = serializers.IntegerField(min_value=1, max_value=50, required=False)
    bedrooms = serializers.IntegerField(min_value=0, max_value=30, required=False)
    bathrooms = serializers.IntegerField(min_value=0, max_value=20, required=False)
    beds = serializers.IntegerField(min_value=0, max_value=60, required=False)
    floor_area = serializers.IntegerField(min_value=1, max_value=5000, required=False, allow_null=True)
    floors = serializers.IntegerField(min_value=1, max_value=10, required=False)
    host_languages = serializers.ListField(child=serializers.ChoiceField(choices=Language.values), max_length=len(Language.values), required=False)
    descriptions = serializers.DictField(child=serializers.CharField(max_length=5000, allow_blank=True, trim_whitespace=True), required=False)
    nearby = NearbySerializer(many=True, required=False)
    amenities = serializers.ListField(child=serializers.CharField(max_length=40), max_length=120, required=False)
    amenity_notes = serializers.DictField(child=NoteSerializer(), required=False)
    min_nights = serializers.IntegerField(min_value=1, max_value=60, required=False)
    max_nights = serializers.IntegerField(min_value=1, max_value=365, required=False, allow_null=True)
    price_per_night = amount()
    weekend_price = amount(allow_null=True)
    cleaning_fee = amount()
    extra_guest_fee = amount()
    extra_guest_from = serializers.IntegerField(min_value=1, max_value=50, required=False, allow_null=True)
    pet_fee = amount()
    weekly_discount = serializers.IntegerField(min_value=0, max_value=80, required=False)
    monthly_discount = serializers.IntegerField(min_value=0, max_value=80, required=False)
    security_deposit = amount()
    smart_min_price = amount(allow_null=True)
    smart_max_price = amount(allow_null=True)
    seasonal_prices = SeasonSerializer(many=True, required=False)
    taxes_note = text(300)
    check_in_from = serializers.TimeField(required=False, allow_null=True)
    check_in_until = serializers.TimeField(required=False, allow_null=True)
    check_out_by = serializers.TimeField(required=False, allow_null=True)
    min_age = serializers.IntegerField(min_value=18, max_value=30, required=False, allow_null=True)
    quiet_hours = text(60)
    house_rules = text(4000)
    waste_instructions = text(2000)
    sauna_instructions = text(2000)
    fireplace_instructions = text(2000)
    arrival_instructions = text(4000)
    departure_instructions = text(4000)
    access_details = text(1000)
    nettimokki_url = serializers.URLField(max_length=200, allow_blank=True, required=False)

    class Meta:
        model = Cottage
        fields = [
            "name", "property_type", "country", "region", "municipality", "address", "latitude", "longitude",
            "show_exact_location", "property_id", "licence_number", "max_guests", "bedrooms", "bathrooms", "beds", "floor_area", "floors", "host_languages", "descriptions",
            "nearby", "amenities", "amenity_notes", "min_nights", "max_nights", "price_per_night", "weekend_price",
            "cleaning_fee", "extra_guest_fee", "extra_guest_from", "pet_fee", "weekly_discount", "monthly_discount",
            "security_deposit", "smart_pricing", "smart_min_price", "smart_max_price", "seasonal_prices", "taxes_note", "check_in_from", "check_in_until", "check_out_by",
            "self_check_in", "min_age", "pets_allowed", "smoking_allowed", "events_allowed", "quiet_hours", "house_rules",
            "waste_instructions", "sauna_instructions", "fireplace_instructions", "arrival_instructions",
            "departure_instructions", "access_details", "nettimokki_url",
        ]

    def validate_amenities(self, value: list[str]) -> list[str]:
        unknown = sorted(set(value) - FEATURE_KEYS)
        if unknown:
            raise serializers.ValidationError(f"Unknown amenities: {', '.join(unknown)}")
        return list(dict.fromkeys(value))  # no repeats, order kept

    def validate_descriptions(self, value: dict) -> dict:
        unknown = sorted(set(value) - LANGS)
        if unknown:
            raise serializers.ValidationError(f"Unknown languages: {', '.join(unknown)}")
        return value

    def validate_host_languages(self, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))

    def validate(self, attrs):
        # The region belongs to the country; a new country drops a region it doesn't have.
        country = attrs.get("country", self.instance.country if self.instance else "FI")
        if "region" in attrs:
            if attrs["region"] and not valid_region(country, attrs["region"]):
                raise serializers.ValidationError({"region": "Choose one of the country's regions."})
        elif "country" in attrs and self.instance and self.instance.region and not valid_region(country, self.instance.region):
            attrs["region"] = ""
        lat, lng = attrs.get("latitude", ...), attrs.get("longitude", ...)
        if (lat is None) != (lng is None) and ... not in (lat, lng):
            raise serializers.ValidationError({"latitude": "Set both or neither."})
        mn = attrs.get("min_nights", self.instance.min_nights if self.instance else 1)
        mx = attrs.get("max_nights", self.instance.max_nights if self.instance else None)
        if mx is not None and mx < mn:
            raise serializers.ValidationError({"max_nights": "The longest stay can't be shorter than the shortest."})
        low = attrs.get("smart_min_price", self.instance.smart_min_price if self.instance else None)
        high = attrs.get("smart_max_price", self.instance.smart_max_price if self.instance else None)
        if low is not None and high is not None and high < low:
            raise serializers.ValidationError({"smart_max_price": "The highest price can't be below the lowest."})
        for season in attrs.get("seasonal_prices", []):
            if season["start"] == season["end"]:
                raise serializers.ValidationError({"seasonal_prices": "A season needs a different start and end."})
        return attrs

    def update(self, instance: Cottage, validated_data):
        self.translation_job = None
        if "descriptions" in validated_data:
            # Merge: only the languages sent change; an empty text removes that language.
            texts = descriptions_of(instance)
            auto = {k: v for k, v in (instance.descriptions_auto or {}).items() if k in texts}
            written, removed = [], []
            for lang, body in validated_data.pop("descriptions").items():
                if body == texts.get(lang, ""):
                    continue  # sent back as it was, a translation included: nothing changes
                was_auto = auto.pop(lang, None) is not None  # an edited translation is the owner's from now on
                if body:
                    texts[lang] = body
                    if not was_auto:
                        written.append(lang)
                else:
                    texts.pop(lang, None)
                    if not was_auto:
                        removed.append(lang)
            own = translate.owner_languages(texts, auto)
            if not own:
                # Nothing of the owner's left to translate from: the translations go too.
                texts = {k: v for k, v in texts.items() if k not in auto}
                auto = {}
            instance.descriptions, instance.descriptions_auto = texts, auto
            instance.description_en = texts.get("en", "")
            instance.description_fi = texts.get("fi", "")
            # The owner wrote or rewrote a language: the rest follow it. Editing a translation changes only that one.
            source = translate.preferred(written) or (translate.preferred(own) if removed and auto else None)
            if source:
                self.translation_job = translate.plan(instance, source)
        amenities = validated_data.get("amenities")
        if "pets_allowed" in validated_data:
            keys = list(amenities if amenities is not None else instance.amenities or [])
            keys = [k for k in keys if k != "pets"] + (["pets"] if validated_data["pets_allowed"] else [])
            validated_data["amenities"] = amenities = keys
        if amenities is not None:
            keys = set(amenities)
            # The older yes/no fields follow the list, so admin filters stay right.
            validated_data["has_sauna"] = bool(keys & SAUNAS)
            validated_data["has_lake_or_sea_access"] = bool(keys & WATER)
            if "pets_allowed" not in validated_data:
                validated_data["pets_allowed"] = "pets" in keys
        notes = validated_data.pop("amenity_notes", None)
        if notes is not None or amenities is not None:
            keys = set(amenities if amenities is not None else instance.amenities or [])
            current = notes if notes is not None else (instance.amenity_notes or {})
            cleaned = {}
            for key, n in current.items():
                fee = n.get("fee")
                note = (n.get("note") or "").strip()
                if key in keys and (note or fee is not None):
                    cleaned[key] = {"note": note, "fee": None if fee in (None, "") else f"{Decimal(fee):.2f}"}
            instance.amenity_notes = cleaned
        for name in ("nearby", "seasonal_prices"):
            if name in validated_data:
                rows = []
                for row in validated_data.pop(name):
                    rows.append({k: (str(v) if isinstance(v, Decimal) else v) for k, v in row.items()})
                setattr(instance, name, rows)
        instance.updated_at = timezone.now()
        cottage = super().update(instance, validated_data)
        if validated_data.get("nettimokki_url"):
            sync_nettimokki(cottage)
        return cottage


def log(cottage: Cottage, request, action: str, fields: list[str] | None = None) -> None:
    CottageChange.objects.create(cottage=cottage, by=request.user.owner.name, action=action, fields=fields or [])


def touch(cottage: Cottage) -> None:
    Cottage.objects.filter(pk=cottage.pk).update(updated_at=timezone.now())


def detail_queryset():
    return Cottage.objects.select_related("owner").prefetch_related("photos", "feeds", "bookings", "changes", "links__feed")


def own(request, pk) -> Cottage:
    return get_object_or_404(detail_queryset(), pk=pk, owner=request.user.owner)


class CreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True, min_length=1)


class OwnerCottagesView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        today, now = timezone.localdate(), timezone.now()
        cottages = detail_queryset().filter(owner=request.user.owner).order_by("name")
        return Response({"cottages": [cottage_summary(c, today, now) for c in cottages]})

    def post(self, request):
        data = CreateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        owner = request.user.owner
        signup = owner.signup
        cottage = Cottage.objects.create(
            owner=owner, name=data.validated_data["name"], max_guests=2, price_per_night=Decimal("0.00"),
            country=signup.country if signup else Cottage._meta.get_field("country").default,
            region=signup.region if signup else "",
            host_languages=[owner.language], status=Cottage.Status.INTAKE,
        )
        log(cottage, request, "create")
        return Response(cottage_detail(own(request, cottage.pk)), status=status.HTTP_201_CREATED)


class OwnerCottageView(APIView):
    permission_classes = [IsOwner]

    def get(self, request, pk):
        return Response(cottage_detail(own(request, pk)))

    def patch(self, request, pk):
        cottage = own(request, pk)
        data = CottageSerializer(cottage, data=request.data, partial=True)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            data.save()
            log(cottage, request, "edit", sorted(data.validated_data))
            if data.translation_job:
                job = data.translation_job
                transaction.on_commit(lambda: translate.start(cottage.pk, job))
        return Response(cottage_detail(own(request, pk)))

    def delete(self, request, pk):
        cottage = own(request, pk)
        if (request.data.get("confirm") or "").strip() != cottage.name:
            return Response({"reason": "confirm"}, status=status.HTTP_400_BAD_REQUEST)
        # Stays are financial records and conversations are the guests'; both stay. Archive instead.
        if Booking.objects.filter(cottage=cottage).exists():
            return Response({"reason": "has_bookings"}, status=status.HTTP_409_CONFLICT)
        if Conversation.objects.filter(cottage=cottage).exists():
            return Response({"reason": "has_messages"}, status=status.HTTP_409_CONFLICT)
        with transaction.atomic():
            cottage.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class TranslateSerializer(serializers.Serializer):
    source = serializers.ChoiceField(choices=sorted(LANGS), required=False)


class OwnerTranslateView(APIView):
    """Fill every language the owner hasn't written with Claude's translation, again if need be:
    for listings written before translating was automatic, and after a translation failed."""

    permission_classes = [IsOwner]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai-draft"

    def post(self, request, pk):
        if not translate.enabled():
            return Response({"detail": "ai_not_configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        data = TranslateSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        with transaction.atomic():
            cottage = get_object_or_404(Cottage.objects.select_for_update(), pk=pk, owner=request.user.owner)
            texts = descriptions_of(cottage)
            auto = {k: v for k, v in (cottage.descriptions_auto or {}).items() if k in texts}
            own_langs = translate.owner_languages(texts, auto)
            source = data.validated_data.get("source")
            source = source if source in own_langs else translate.preferred(own_langs)
            if not source:
                return Response({"detail": "no_description"}, status=status.HTTP_400_BAD_REQUEST)
            cottage.descriptions, cottage.descriptions_auto = texts, auto
            job = translate.plan(cottage, source)
            cottage.save(update_fields=["descriptions", "descriptions_auto", "translating"])
            if job:
                transaction.on_commit(lambda: translate.start(cottage.pk, job))
        return Response(cottage_detail(own(request, pk)))


class StatusSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["publish", "pause", "relist", "archive", "restore"])


S = Cottage.Status
# Which statuses each action starts from, and where it goes.
TRANSITIONS = {
    "publish": ({S.INTAKE, S.LISTING}, S.LIVE),
    "relist": ({S.PAUSED}, S.LIVE),
    "pause": ({S.LIVE, S.LISTING}, S.PAUSED),
    "archive": ({S.INTAKE, S.LISTING, S.LIVE, S.PAUSED}, S.ARCHIVED),
    "restore": ({S.ARCHIVED}, S.INTAKE),
}


def future_stays(cottage: Cottage) -> int:
    return Booking.objects.filter(cottage=cottage, cancelled=False, check_out__gt=timezone.localdate()).count()


class OwnerStatusView(APIView):
    """Rantio's own listing only. The booking sites keep their own listing status;
    pausing here closes the booking link but never cancels a stay."""

    permission_classes = [IsOwner]

    def post(self, request, pk):
        cottage = own(request, pk)
        data = StatusSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        action = data.validated_data["action"]
        sources, target = TRANSITIONS[action]
        if cottage.status not in sources:
            return Response({"reason": "not_allowed", "status": cottage.status}, status=status.HTTP_409_CONFLICT)
        if target == S.LIVE:
            missing = missing_essentials(checklist(cottage, cottage.photos.count(), cottage.feeds.count()))
            if missing:
                return Response({"reason": "incomplete", "missing": missing}, status=status.HTTP_400_BAD_REQUEST)
        if action == "archive":
            n = future_stays(cottage)
            if n:
                return Response({"reason": "future_bookings", "count": n}, status=status.HTTP_409_CONFLICT)
        with transaction.atomic():
            cottage.status = target
            if target == S.LIVE and not cottage.listing_started_on:
                cottage.listing_started_on = timezone.localdate()
            cottage.updated_at = timezone.now()
            cottage.save(update_fields=["status", "listing_started_on", "updated_at"])
            log(cottage, request, action)
        return Response(cottage_detail(own(request, pk)))


COPY_SKIP = {"id", "owner", "name", "status", "listing_started_on", "listing_slug", "inbound_code", "calendar_token",
             "booking_link_token", "created_at", "updated_at", "nettimokki_url", "address", "access_details"}


class OwnerDuplicateView(APIView):
    """A new draft with the same details and copies of the photos; no bookings, calendars,
    links or private details come along."""

    permission_classes = [IsOwner]

    def post(self, request, pk):
        source = own(request, pk)
        with transaction.atomic():
            copy = Cottage(owner=source.owner, name=f"{source.name} (2)"[:120], status=S.INTAKE)
            for field in Cottage._meta.concrete_fields:
                if field.name not in COPY_SKIP:
                    setattr(copy, field.attname, getattr(source, field.attname))
            copy.save()
            for p in source.photos.all():
                with p.image.open("rb") as f:
                    content = ContentFile(f.read(), name=p.image.name.rsplit("/", 1)[-1])
                CottagePhoto.objects.create(cottage=copy, image=content, kind=p.kind, caption=p.caption, position=p.position)
            log(copy, request, "duplicate")
        return Response(cottage_detail(own(request, copy.pk)), status=status.HTTP_201_CREATED)


class OwnerPreviewView(APIView):
    permission_classes = [IsOwner]

    def get(self, request, pk):
        return Response(cottage_preview(own(request, pk)))


# ---------- photos ----------

class PhotoSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=CottagePhoto.Kind.choices, required=False)
    caption = serializers.CharField(max_length=200, allow_blank=True, required=False, trim_whitespace=True)


def checked_upload(request):
    """The uploaded file and its real type, or an error response."""
    upload = request.FILES.get("file")
    if not upload:
        return None, None, Response({"file": ["missing"]}, status=status.HTTP_400_BAD_REQUEST)
    if upload.size > IMAGE_MAX:
        return None, None, Response({"file": ["too_big"]}, status=status.HTTP_400_BAD_REQUEST)
    kind = image_type(upload.read(16))
    upload.seek(0)
    if not kind:
        return None, None, Response({"file": ["not_image"]}, status=status.HTTP_400_BAD_REQUEST)
    upload.name = f"photo.{'jpg' if kind == 'jpeg' else kind}"
    return upload, kind, None


class OwnerPhotosView(APIView):
    permission_classes = [IsOwner]
    parser_classes = [parsers.MultiPartParser]

    def post(self, request, pk):
        cottage = own(request, pk)
        upload, _, error = checked_upload(request)
        if error:
            return error
        meta = PhotoSerializer(data={k: v for k, v in request.data.items() if k in ("kind", "caption")})
        meta.is_valid(raise_exception=True)
        with transaction.atomic():
            count = CottagePhoto.objects.select_for_update().filter(cottage=cottage).count()
            if count >= MAX_PHOTOS:
                return Response({"file": ["too_many"]}, status=status.HTTP_400_BAD_REQUEST)
            photo = CottagePhoto.objects.create(
                cottage=cottage, image=upload, position=count,
                kind=meta.validated_data.get("kind", CottagePhoto.Kind.EXTERIOR),
                caption=meta.validated_data.get("caption", ""),
            )
            touch(cottage)
            log(cottage, request, "photo_add")
        return Response(photo_row(photo), status=status.HTTP_201_CREATED)


class OwnerPhotoView(APIView):
    permission_classes = [IsOwner]

    def photo(self, request, pk, photo_pk) -> CottagePhoto:
        return get_object_or_404(CottagePhoto, pk=photo_pk, cottage_id=pk, cottage__owner=request.user.owner)

    def patch(self, request, pk, photo_pk):
        photo = self.photo(request, pk, photo_pk)
        data = PhotoSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        for key, value in data.validated_data.items():
            setattr(photo, key, value)
        photo.save(update_fields=list(data.validated_data) or None)
        touch(photo.cottage)
        return Response(photo_row(photo))

    def delete(self, request, pk, photo_pk):
        photo = self.photo(request, pk, photo_pk)
        with transaction.atomic():
            photo.delete()  # the file goes once this is committed (models._remove_photo_file)
            # Close the gap so positions stay 0, 1, 2 …
            for i, p in enumerate(CottagePhoto.objects.filter(cottage_id=pk)):
                if p.position != i:
                    CottagePhoto.objects.filter(pk=p.pk).update(position=i)
            touch(photo.cottage)
            log(photo.cottage, request, "photo_remove")
        return Response(status=status.HTTP_204_NO_CONTENT)


class OwnerPhotoReplaceView(APIView):
    """A new file in the same place, room and caption. The old file is removed only after
    the new one is saved and the change committed."""

    permission_classes = [IsOwner]
    parser_classes = [parsers.MultiPartParser]

    def post(self, request, pk, photo_pk):
        photo = get_object_or_404(CottagePhoto, pk=photo_pk, cottage_id=pk, cottage__owner=request.user.owner)
        upload, _, error = checked_upload(request)
        if error:
            return error
        old_storage, old_name = photo.image.storage, photo.image.name
        with transaction.atomic():
            photo.image = upload
            photo.save(update_fields=["image"])
            touch(photo.cottage)
            log(photo.cottage, request, "photo_replace")
            transaction.on_commit(lambda: old_storage.delete(old_name))
        return Response(photo_row(photo))


class OrderSerializer(serializers.Serializer):
    ids = serializers.ListField(child=serializers.IntegerField(), max_length=MAX_PHOTOS)


class OwnerPhotoOrderView(APIView):
    permission_classes = [IsOwner]

    def post(self, request, pk):
        cottage = own(request, pk)
        data = OrderSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        ids = data.validated_data["ids"]
        current = set(cottage.photos.values_list("pk", flat=True))
        if set(ids) != current or len(ids) != len(current):
            return Response({"ids": ["Send every photo of the cottage once."]}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            for i, photo_pk in enumerate(ids):
                CottagePhoto.objects.filter(pk=photo_pk).update(position=i)
            touch(cottage)
            log(cottage, request, "photo_order")
        return Response({"photos": [photo_row(p) for p in CottagePhoto.objects.filter(cottage=cottage)]})


# ---------- nightly prices ----------

MAX_PRICE_DAYS = 400


class PricesSerializer(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()
    price = serializers.DecimalField(max_digits=9, decimal_places=2, min_value=Decimal("1"), allow_null=True)

    def validate(self, attrs):
        if attrs["end"] <= attrs["start"]:
            raise serializers.ValidationError({"end": "The last night must be after the first."})
        if (attrs["end"] - attrs["start"]).days > MAX_PRICE_DAYS:
            raise serializers.ValidationError({"end": "Set at most a year at a time."})
        if attrs["start"] < timezone.localdate():
            raise serializers.ValidationError({"start": "Past nights can't be priced."})
        return attrs


def price_rows(cottage: Cottage, start: date, days: int) -> dict:
    low, high = pricing.limits(cottage)
    return {
        "currency": cottage.currency,
        "price_per_night": money(cottage.price_per_night),
        "smart_pricing": cottage.smart_pricing,
        "smart_min_price": money(pricing.round_price(low, cottage.currency)),
        "smart_max_price": money(pricing.round_price(high, cottage.currency)),
        "nights": [n.as_dict() for n in pricing.nights(cottage, start, start + timedelta(days=days))],
    }


class OwnerPricesView(APIView):
    """Each night's price, and the owner setting a price for some nights (or clearing it)."""

    permission_classes = [IsOwner]

    def get(self, request, pk):
        cottage = own(request, pk)
        try:
            start = date.fromisoformat(request.query_params.get("from", ""))
        except ValueError:
            start = timezone.localdate()
        try:
            days = min(MAX_PRICE_DAYS, max(1, int(request.query_params.get("days", 60))))
        except ValueError:
            days = 60
        return Response(price_rows(cottage, start, days))

    def post(self, request, pk):
        cottage = own(request, pk)
        data = PricesSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        nights = [v["start"] + timedelta(days=i) for i in range((v["end"] - v["start"]).days)]
        with transaction.atomic():
            NightPrice.objects.filter(cottage=cottage, date__in=nights).delete()
            if v["price"] is not None:
                NightPrice.objects.bulk_create([NightPrice(cottage=cottage, date=d, price=v["price"]) for d in nights])
            log(cottage, request, "edit", ["night_prices"])
            touch(cottage)
        return Response(price_rows(cottage, v["start"], len(nights)))

"""Demo owner with cottages and a year of bookings, for trying the owner dashboard locally.

    python manage.py seed_demo            # create it (or say it exists)
    python manage.py seed_demo --reset    # delete and create again
    python manage.py seed_demo --only-if-empty   # what dev.sh runs: skip if any owner exists

Sign in at http://localhost:3100/hallinta/kirjaudu with demo@stugora.fi; in development
the code is shown on the page (and printed in the terminal).
"""

import random
import secrets
from datetime import date, timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from owners.models import Booking, Conversation, Cottage, Country, Message, Owner, Region

DEMO_EMAIL = "demo@stugora.fi"

COTTAGES = [
    # name, municipality, region, guests, bedrooms, price, months listed (None = still setting up), stugora.fi page
    ("Järvihuvila", "Savonlinna", Region.SAIMAA, 6, 3, 180, 9, "lakeside-villa"),
    ("Rantasauna", "Lohja", Region.HELSINKI, 4, 2, 120, 5, "lohja-lake-cabin"),
    ("Metsämökki", "Kuusamo", Region.OTHER, 5, 2, 140, None, ""),
]
# Where demo guests book from, roughly like a lake cottage's first Stugora year.
CHANNELS = [
    (Booking.Channel.AIRBNB, 34), (Booking.Channel.BOOKING, 24), (Booking.Channel.NETTIMOKKI, 22),
    (Booking.Channel.VRBO, 10), (Booking.Channel.EXPEDIA, 5), (Booking.Channel.HOLIDU, 3), (Booking.Channel.OWNER, 2),
]
# Summer and the Christmas-to-March season fill up; November is quiet.
BUSY = {1: 0.5, 2: 0.6, 3: 0.55, 4: 0.3, 5: 0.35, 6: 0.75, 7: 0.9, 8: 0.7, 9: 0.4, 10: 0.3, 11: 0.15, 12: 0.55}


def months_ago(today: date, n: int) -> date:
    month = today.month - n
    year = today.year + (month - 1) // 12
    return date(year, (month - 1) % 12 + 1, 1)


class Command(BaseCommand):
    help = "Create a demo owner with cottages and bookings for the owner dashboard."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete the demo owner first.")
        parser.add_argument("--only-if-empty", action="store_true", help="Do nothing if any owner exists.")

    @transaction.atomic
    def handle(self, *args, reset=False, only_if_empty=False, **options):
        if only_if_empty and Owner.objects.exists():
            return
        existing = Owner.objects.filter(email=DEMO_EMAIL).first()
        if existing and not reset:
            self.stdout.write(f"Demo owner already exists: {DEMO_EMAIL} (use --reset to recreate)")
            return
        if existing:
            Booking.objects.filter(cottage__owner=existing).delete()
            user = existing.user
            existing.delete()
            if user:
                user.delete()

        today = timezone.localdate()
        rng = random.Random(2026)
        owner = Owner.objects.create(
            name="Maija Demo", email=DEMO_EMAIL, language="fi", is_pilot=True, agreement_signed_on=months_ago(today, 9)
        )
        count = 0
        for name, town, region, guests, bedrooms, price, listed, slug in COTTAGES:
            cottage = Cottage.objects.create(
                owner=owner, name=name, municipality=town, country=Country.FINLAND, region=region,
                max_guests=guests, bedrooms=bedrooms, beds=guests, price_per_night=Decimal(price),
                status=Cottage.Status.LIVE if listed else Cottage.Status.LISTING,
                listing_started_on=months_ago(today, listed) if listed else None, listing_slug=slug,
            )
            if listed:
                count += self.book(cottage, guests, price, today, rng)
        talks = self.talk(owner, timezone.now())
        self.stdout.write(self.style.SUCCESS(f"Demo owner {DEMO_EMAIL} with {count} bookings and {talks} conversations."))

    def talk(self, owner: Owner, now) -> int:
        """A few guest conversations: one from each kind of place guests write from."""
        villa, sauna = owner.cottages.get(name="Järvihuvila"), owner.cottages.get(name="Rantasauna")
        today = timezone.localdate()
        staying = villa.bookings.filter(check_in__lte=today, check_out__gt=today).first()
        coming = sauna.bookings.filter(check_in__gt=today, cancelled=False).order_by("check_in").first()
        h = lambda hours: now - timedelta(hours=hours)  # noqa: E731
        threads = [
            # (cottage, booking, channel, guest, language, email, messages: (sender, hours ago, text), owner has read)
            (villa, staying, Booking.Channel.BOOKING, "Lukas Becker", "en", "", [
                ("guest", 30, "Hello! We arrive around 18:00. Is there a key box, or will someone meet us?"),
                ("host", 29, "Welcome Lukas! The key is in the box by the door, code 4521. The sauna wood is in the shed behind the cottage."),
                ("guest", 2, "Thank you, everything is perfect. One question: may we use the rowing boat in the evening?"),
            ], False),
            (sauna, coming, Booking.Channel.AIRBNB, "Emma Lindqvist", "sv", "", [
                ("guest", 50, "Hi! Is the sauna wood-heated, and do we need to bring our own towels?"),
                ("host", 48, "Hi Emma, yes, it's a wood-heated sauna by the lake. Towels and bed linen are included."),
                ("guest", 47, "Wonderful, thanks!"),
            ], True),
            (villa, None, Booking.Channel.DIRECT, "Anna Korhonen", "fi", "anna.korhonen@example.com", [
                ("guest", 5, "Hei! Onko Järvihuvila vapaana helmikuun hiihtolomaviikolla? Meitä olisi 2 aikuista ja 3 lasta."),
            ], False),
        ]
        booking_sites = {"airbnb", "booking", "vrbo", "expedia", "holidu", "hometogo"}
        for cottage, booking, channel, guest, lang, email, msgs, read in threads:
            if booking and booking.channel in booking_sites:
                channel = booking.channel  # the thread lives on the site the stay was booked on
            c = Conversation.objects.create(
                cottage=cottage, booking=booking, channel=channel, guest_name=guest, guest_language=lang,
                guest_email=email, listing_slug=cottage.listing_slug, token=secrets.token_urlsafe(24),
                check_in=booking.check_in if booking else None, check_out=booking.check_out if booking else None,
                guests=booking.guests if booking else 5, last_message_at=h(msgs[-1][1]),
                owner_read_at=now if read else h(msgs[-2][1]) if len(msgs) > 1 else None, guest_read_at=now,
            )
            for sender, hours, text in msgs:
                Message.objects.create(conversation=c, sender=sender, body=text, created_at=h(hours))
        return len(threads)

    def book(self, cottage: Cottage, max_guests: int, price: int, today: date, rng: random.Random) -> int:
        """Back-to-back stays from the listing start to three months ahead, plus one stay right now."""
        day, end, n = cottage.listing_started_on, today + timedelta(days=90), 0
        channels, weights = zip(*CHANNELS)
        stays = []
        while day < end:
            if rng.random() < BUSY[day.month]:
                nights = rng.choice([2, 2, 3, 3, 4, 5, 7])
                stays.append((day, day + timedelta(days=nights)))
                day += timedelta(days=nights + rng.choice([0, 1, 2, 3]))
            else:
                day += timedelta(days=rng.choice([2, 3, 4, 5]))
        # The first cottage has guests in it today, so the dashboard shows "Staying now".
        if cottage.name == COTTAGES[0][0]:
            stays = [s for s in stays if s[1] <= today - timedelta(days=1) or s[0] >= today + timedelta(days=3)]
            stays.append((today - timedelta(days=1), today + timedelta(days=3)))
        for check_in, check_out in sorted(stays):
            channel = rng.choices(channels, weights)[0]
            nights = (check_out - check_in).days
            payout = (Decimal(price * nights) * Decimal(rng.uniform(0.84, 0.97))).quantize(Decimal("1.00"))
            n += 1
            Booking.objects.create(
                cottage=cottage, channel=channel,
                external_id="" if channel in Booking.UNCHARGED_CHANNELS else f"DEMO-{cottage.pk}-{n}",
                check_in=check_in, check_out=check_out, guests=rng.randint(2, max_guests),
                owner_payout=payout, cancelled=check_in < today and rng.random() < 0.05,
            )
        return n

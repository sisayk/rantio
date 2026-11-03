from datetime import date
from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from .models import Booking, Cottage, Owner, OwnerSignup

VALID = {
    "name": "Matti Virtanen",
    "email": "Matti@Example.fi",
    "phone": "+358401234567",
    "language": "fi",
    "region": "etela-savo",
    "place": " Savonlinna ",
    "cottage_count": 1,
    "nettimokki_url": "https://www.nettimokki.com/mokki/12345",
    "privacy_consent": True,
}


class SignupApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("owner-signup")

    def test_creates_signup_and_normalises_email(self):
        response = self.client.post(self.url, VALID, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        signup = OwnerSignup.objects.get()
        self.assertEqual(signup.email, "matti@example.fi")
        self.assertEqual(signup.status, OwnerSignup.Status.NEW)

    def test_owner_in_another_country_picks_its_region(self):
        data = {**VALID, "country": "SE", "region": "dalarna", "place": "", "nettimokki_url": ""}
        response = self.client.post(self.url, data, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        signup = OwnerSignup.objects.get()
        self.assertEqual(signup.location_display, "Dalarna, Sweden")

    def test_region_must_belong_to_the_country(self):
        for data in ({**VALID, "country": "NO"}, {**VALID, "region": ""}, {**VALID, "region": "saimaa"}):
            response = self.client.post(self.url, data, format="json")
            self.assertEqual(response.status_code, 400, data)
            self.assertIn("region", response.data)

    def test_country_defaults_to_finland(self):
        self.client.post(self.url, VALID, format="json")
        self.assertEqual(OwnerSignup.objects.get().location_display, "Savonlinna, South Savo, Finland")

    def test_requires_privacy_consent(self):
        response = self.client.post(self.url, {**VALID, "privacy_consent": False}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("privacy_consent", response.data)

    def test_rejects_non_nettimokki_link(self):
        response = self.client.post(self.url, {**VALID, "nettimokki_url": "https://evil.example/nettimokki.com"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("nettimokki_url", response.data)

    def test_nettimokki_link_is_optional(self):
        response = self.client.post(self.url, {**VALID, "nettimokki_url": ""}, format="json")
        self.assertEqual(response.status_code, 201)

    def test_honeypot_blocks_bots(self):
        response = self.client.post(self.url, {**VALID, "website": "http://spam"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(OwnerSignup.objects.count(), 0)

    @override_settings(SIGNUP_NOTIFY_EMAILS=["sisay@rantio.fi"])
    def test_notifies_team(self):
        self.client.post(self.url, VALID, format="json")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Savonlinna, South Savo, Finland", mail.outbox[0].subject)

    def test_accepts_every_site_language(self):
        # The codes in frontend/src/i18n/locales.ts; the form sends the page's language.
        for code in ["en", "fi", "sv", "nb", "nn", "da", "is", "et", "lv", "lt"]:
            cache.clear()
            response = self.client.post(self.url, {**VALID, "email": f"{code}@example.com", "language": code}, format="json")
            self.assertEqual(response.status_code, 201, (code, response.data))
        self.assertEqual(OwnerSignup.objects.get(email="lt@example.com").get_language_display(), "Lietuvių")

    def test_rejects_unknown_language(self):
        response = self.client.post(self.url, {**VALID, "language": "de"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("language", response.data)

    @override_settings(SIGNUP_NOTIFY_EMAILS=["sisay@rantio.fi"])
    def test_team_email_says_which_language_to_answer_in(self):
        self.client.post(self.url, {**VALID, "language": "et"}, format="json")
        self.assertIn("writes in: Eesti", mail.outbox[0].body)

    def test_signup_list_is_not_public(self):
        self.assertEqual(self.client.get(self.url).status_code, 405)


class CommissionTests(TestCase):
    def setUp(self):
        self.owner = Owner.objects.create(name="Liisa", email="liisa@example.fi", agreement_signed_on=date(2026, 10, 31))
        self.cottage = Cottage.objects.create(
            owner=self.owner, name="Rantasauna", region="etela-savo", max_guests=6, price_per_night=Decimal("150")
        )

    def book(self, channel, payout="2550.00", **extra):
        return Booking.objects.create(
            cottage=self.cottage, channel=channel, check_in=date(2027, 7, 1), check_out=date(2027, 7, 21),
            owner_payout=Decimal(payout), **extra,
        )

    def test_plan_example_twenty_nights(self):
        booking = self.book(Booking.Channel.AIRBNB)
        self.assertEqual(booking.nights, 20)
        self.assertEqual(booking.commission, Decimal("306.00"))
        self.assertEqual(booking.commission_vat, Decimal("78.03"))
        self.assertEqual(booking.commission_total, Decimal("384.03"))

    def test_nettimokki_never_charged(self):
        self.assertEqual(self.book(Booking.Channel.NETTIMOKKI).commission, Decimal("0.00"))

    def test_cancelled_not_charged(self):
        self.assertEqual(self.book(Booking.Channel.BOOKING, cancelled=True).commission_total, Decimal("0.00"))

    def test_pilot_owner_gets_ten_percent(self):
        pilot = Owner.objects.create(name="Pilot", email="pilot@example.fi", is_pilot=True)
        self.assertEqual(pilot.commission_rate, Decimal("10.00"))

    def test_yearly_fee_with_vat(self):
        self.assertEqual(self.cottage.yearly_fee(1), Decimal("99.00"))
        self.assertEqual(self.cottage.yearly_fee_vat(1), Decimal("25.25"))

    def test_pilot_first_year_free_then_paid(self):
        pilot = Owner.objects.create(name="Pilot", email="pilot@example.fi", is_pilot=True)
        cottage = Cottage.objects.create(owner=pilot, name="Kelo", region="lapland", max_guests=4, price_per_night=Decimal("180"))
        self.assertEqual(cottage.yearly_fee(1), Decimal("0.00"))
        self.assertEqual(cottage.yearly_fee(2), Decimal("99.00"))

    def test_listing_years(self):
        self.cottage.listing_started_on = date(2026, 10, 31)
        self.assertIsNone(self.cottage.listing_year_on(date(2026, 10, 30)))
        self.assertEqual(self.cottage.listing_year_on(date(2027, 10, 30)), 1)
        self.assertEqual(self.cottage.listing_year_on(date(2027, 10, 31)), 2)
        self.assertEqual(self.cottage.listing_year_starts_on(2), date(2027, 10, 31))

    def test_listing_year_clamps_month_end(self):
        self.cottage.listing_started_on = date(2028, 2, 29)
        self.assertEqual(self.cottage.listing_year_starts_on(2), date(2029, 2, 28))

    def test_same_external_booking_cannot_be_imported_twice(self):
        self.book(Booking.Channel.AIRBNB, external_id="HM123")
        with self.assertRaises(IntegrityError):
            self.book(Booking.Channel.AIRBNB, external_id="HM123")

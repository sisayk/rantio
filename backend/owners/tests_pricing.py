from datetime import date, timedelta
from decimal import Decimal

from django.test import TestCase

from . import login as owner_login
from . import pricing
from .models import Booking, CalendarBlock, Cottage, NightPrice, Owner
from .tests_calendar import make_cottage

TODAY = date(2027, 4, 12)  # a Monday, outside every holiday (Easter 2027 is 28 March)


def by_date(rows):
    return {n.date: n for n in rows}


class UsualPriceTests(TestCase):
    def setUp(self):
        self.c = make_cottage(country="FI")

    def test_base_weekend_and_seasons_including_one_over_new_year(self):
        self.c.weekend_price = Decimal("190")
        self.c.seasonal_prices = [
            {"name": "Midsummer", "start": "06-18", "end": "06-27", "price": "260"},
            {"name": "Ski", "start": "12-15", "end": "01-10", "price": "210"},
        ]
        self.assertEqual(pricing.usual_price(self.c, date(2027, 5, 4)), (Decimal("150.00"), []))  # Tuesday
        self.assertEqual(pricing.usual_price(self.c, date(2027, 5, 7)), (Decimal("190"), ["weekend"]))  # Friday
        self.assertEqual(pricing.usual_price(self.c, date(2027, 6, 20))[0], Decimal("260"))
        self.assertEqual(pricing.usual_price(self.c, date(2027, 1, 5))[0], Decimal("210"))  # wraps the new year
        self.assertEqual(pricing.usual_price(self.c, date(2027, 12, 31))[0], Decimal("210"))

    def test_rounding_by_currency(self):
        self.assertEqual(pricing.round_price(Decimal("152.6"), "EUR"), Decimal("153.00"))
        self.assertEqual(pricing.round_price(Decimal("1544"), "SEK"), Decimal("1540.00"))
        self.assertEqual(pricing.round_price(Decimal("31260"), "ISK"), Decimal("31300.00"))

    def test_holidays(self):
        self.assertEqual(pricing.easter(2027), date(2027, 3, 28))
        self.assertEqual(pricing.holiday(date(2027, 6, 25), "FI")[0], "midsummer")  # Midsummer Eve 2027
        self.assertIsNone(pricing.holiday(date(2027, 6, 23), "FI"))
        self.assertEqual(pricing.holiday(date(2027, 6, 23), "LV")[0], "midsummer")  # Jāņi
        self.assertEqual(pricing.holiday(date(2027, 12, 24), "SE")[0], "christmas")
        self.assertEqual(pricing.holiday(date(2027, 3, 26), "NO")[0], "easter")  # Good Friday
        self.assertEqual(pricing.holiday(date(2027, 10, 20), "DK")[0], "autumn_holiday")


class NightTests(TestCase):
    def setUp(self):
        self.c = make_cottage(country="FI")

    def nights(self, days=30, start=TODAY):
        return by_date(pricing.nights(self.c, start, start + timedelta(days=days), today=TODAY))

    def test_without_smart_pricing_the_usual_price_applies_but_a_suggestion_is_shown(self):
        n = self.nights()
        self.assertEqual(n[TODAY].price, Decimal("150.00"))
        self.assertFalse(n[TODAY].override)
        self.assertLess(n[TODAY].suggested, Decimal("150.00"))  # free tonight: smart pricing would lower it

    def test_smart_pricing_lowers_last_minute_and_gap_nights_and_lifts_weekends(self):
        self.c.smart_pricing = True
        self.c.save()
        # Booked 19–21 and 22–29 April: the night of the 21st is a 1-night gap with a 2-night minimum.
        Booking.objects.create(cottage=self.c, channel="airbnb", check_in=date(2027, 4, 19), check_out=date(2027, 4, 21), owner_payout=0)
        CalendarBlock.objects.create(cottage=self.c, start=date(2027, 4, 22), end=date(2027, 4, 29))
        n = self.nights()
        self.assertEqual(n[TODAY].price, Decimal("128.00"))  # 150 × 0.85, still free 0 days ahead
        self.assertIn("last_minute", n[TODAY].reasons)
        self.assertEqual(n[date(2027, 4, 16)].price, Decimal("159.00"))  # Friday, 4 days ahead: 150 × 1.15 × 0.92
        self.assertIn("gap", n[date(2027, 4, 21)].reasons)
        self.assertEqual(n[date(2027, 4, 21)].price, Decimal("128.00"))
        self.assertFalse(n[date(2027, 4, 24)].free)

    def test_smart_pricing_stays_within_the_owners_limits(self):
        self.c.smart_pricing = True
        self.c.smart_min_price = Decimal("140")
        self.c.smart_max_price = Decimal("170")
        self.c.save()
        n = self.nights(start=date(2027, 12, 20), days=10)
        self.assertEqual(n[date(2027, 12, 24)].price, Decimal("170.00"))  # Christmas Friday would be 216
        self.assertIn("max", n[date(2027, 12, 24)].reasons)
        low = self.nights()[TODAY]
        self.assertEqual(low.price, Decimal("140.00"))
        self.assertIn("min", low.reasons)

    def test_busy_neighbours_lift_the_price(self):
        self.c.smart_pricing = True
        self.c.save()
        night = date(2027, 5, 12)  # a Wednesday a month ahead
        for i in range(4):
            o = Owner.objects.create(name=f"N{i}", email=f"n{i}@example.fi")
            other = Cottage.objects.create(owner=o, name=f"N{i}", country="FI", max_guests=4, price_per_night=Decimal("100"))
            if i < 4:
                Booking.objects.create(cottage=other, channel="airbnb", check_in=night, check_out=night + timedelta(days=1), owner_payout=0)
        n = self.nights(start=night, days=1)
        self.assertIn("demand_high", n[night].reasons)
        self.assertEqual(n[night].price, Decimal("180.00"))

    def test_an_owners_price_for_a_night_wins(self):
        self.c.smart_pricing = True
        self.c.save()
        NightPrice.objects.create(cottage=self.c, date=TODAY, price=Decimal("99"))
        n = self.nights(days=2)
        self.assertEqual((n[TODAY].price, n[TODAY].override, n[TODAY].reasons), (Decimal("99.00"), True, ["override"]))
        self.assertFalse(n[TODAY + timedelta(days=1)].override)

    def test_quote_adds_nights_discount_and_cleaning(self):
        self.c.weekly_discount = 10
        self.c.save()
        start = date.today() + timedelta(days=60)
        NightPrice.objects.create(cottage=self.c, date=start, price=Decimal("200"))
        q = pricing.quote(self.c, start, start + timedelta(days=7))
        prices = [Decimal(n["price"]) for n in q["nights"]]
        self.assertEqual(prices[0], Decimal("200.00"))
        subtotal = sum(prices)
        self.assertEqual(Decimal(q["subtotal"]), subtotal)
        self.assertEqual(q["discount_percent"], 10)
        self.assertEqual(Decimal(q["total"]), subtotal - (subtotal / 10).quantize(Decimal("0.01")) + Decimal("60.00"))


class PricesApiTests(TestCase):
    def setUp(self):
        self.c = make_cottage()
        self.other = make_cottage(email="other@example.fi")
        self.client.force_login(owner_login.user_for(self.c.owner))
        self.url = f"/api/owner/cottages/{self.c.pk}/prices/"
        self.start = date.today() + timedelta(days=30)

    def test_set_and_clear_prices_for_nights(self):
        res = self.client.post(self.url, {"start": self.start.isoformat(), "end": (self.start + timedelta(days=3)).isoformat(), "price": "175"},
                               content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([n["price"] for n in res.json()["nights"]], ["175.00"] * 3)
        self.assertEqual(NightPrice.objects.filter(cottage=self.c).count(), 3)
        res = self.client.post(self.url, {"start": self.start.isoformat(), "end": (self.start + timedelta(days=1)).isoformat(), "price": None},
                               content_type="application/json")
        self.assertFalse(res.json()["nights"][0]["override"])
        self.assertEqual(NightPrice.objects.filter(cottage=self.c).count(), 2)
        got = self.client.get(f"{self.url}?from={self.start.isoformat()}&days=3").json()
        self.assertEqual([n["override"] for n in got["nights"]], [False, True, True])

    def test_rejects_past_nights_and_others_cottages(self):
        past = date.today() - timedelta(days=2)
        res = self.client.post(self.url, {"start": past.isoformat(), "end": date.today().isoformat(), "price": "100"}, content_type="application/json")
        self.assertEqual(res.status_code, 400)
        res = self.client.get(f"/api/owner/cottages/{self.other.pk}/prices/")
        self.assertEqual(res.status_code, 404)

    def test_smart_pricing_settings_through_the_listing(self):
        res = self.client.patch(f"/api/owner/cottages/{self.c.pk}/", {"smart_pricing": True, "smart_min_price": "120", "smart_max_price": "300"},
                                content_type="application/json")
        self.assertEqual(res.status_code, 200)
        self.c.refresh_from_db()
        self.assertTrue(self.c.smart_pricing)
        self.assertEqual(res.json()["smart_min_price"], "120.00")
        bad = self.client.patch(f"/api/owner/cottages/{self.c.pk}/", {"smart_max_price": "100"}, content_type="application/json")
        self.assertEqual(bad.status_code, 400)

    def test_calendar_carries_each_nights_price(self):
        NightPrice.objects.create(cottage=self.c, date=date.today() + timedelta(days=1), price=Decimal("111"))
        data = self.client.get("/api/owner/calendar/").json()
        nights = data["prices"][str(self.c.pk)]["nights"]
        tomorrow = next(n for n in nights if n["date"] == (date.today() + timedelta(days=1)).isoformat())
        self.assertEqual((tomorrow["price"], tomorrow["override"]), ("111.00", True))

    def test_booking_link_quote(self):
        self.client.logout()
        NightPrice.objects.create(cottage=self.c, date=self.start, price=Decimal("300"))
        url = f"/api/book/{self.c.booking_link_token}/quote/?check_in={self.start}&check_out={self.start + timedelta(days=2)}"
        q = self.client.get(url).json()
        self.assertEqual(q["nights"][0]["price"], "300.00")
        self.assertEqual(q["total"], f"{Decimal('300') + Decimal(q['nights'][1]['price']) + Decimal('60'):.2f}")
        self.assertEqual(self.client.get(f"/api/book/{self.c.booking_link_token}/quote/?check_in=x").status_code, 400)

from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings

from . import beds24
from .tests_calendar import make_cottage


class FakeBeds24:
    """Answers like Beds24's API V2 would, and remembers what was sent."""

    def __init__(self):
        self.sent = []

    def __call__(self, method, path, *, body=None, params=None, headers=None):
        self.sent.append((method, path, body, params, headers))
        if path == "/authentication/token":
            return {"token": "t1", "expiresIn": 86400}
        if (method, path) == ("POST", "/properties"):
            return [{"success": True, "new": {"id": 501}}]
        if (method, path) == ("GET", "/properties"):
            return {"success": True, "data": [{"id": 501, "roomTypes": [{"id": 9001, "name": "x"}]}]}
        if path == "/inventory/rooms/calendar":
            return [{"success": True}]
        raise AssertionError(path)


@override_settings(BEDS24_REFRESH_TOKEN="r1", BEDS24_API="https://beds24.example/api/v2", BEDS24_PROPERTY_TYPE="")
class Beds24Tests(TestCase):
    def setUp(self):
        cache.clear()
        self.c = make_cottage()
        self.c.price_per_night = Decimal("120.00")
        self.c.weekend_price = Decimal("150.00")
        self.c.min_nights = 2
        self.c.save()

    def test_a_cottage_and_its_prices_are_sent(self):
        fake = FakeBeds24()
        with mock.patch.object(beds24, "_request", fake):
            line = beds24.sync(self.c)
        self.c.refresh_from_db()
        self.assertEqual((self.c.beds24_property_id, self.c.beds24_room_id, self.c.beds24_error), (501, 9001, ""))
        self.assertIn("property 501, room 9001", line)
        # The token travels in its header, the refresh token only to get it.
        post = next(s for s in fake.sent if s[:2] == ("POST", "/properties"))
        self.assertEqual(post[4], {"token": "t1"})
        sent = post[2][0]
        self.assertEqual((sent["name"], sent["currency"], sent["roomTypes"][0]["maxPeople"]), (self.c.name, "EUR", self.c.max_guests))
        self.assertNotIn("id", sent)
        self.assertEqual((sent["propertyType"], sent["roomTypes"][0]["roomType"], sent["country"]), ("cottage", "holidayHome", "FI"))
        prices = next(s for s in fake.sent if s[1] == "/inventory/rooms/calendar")[2][0]
        self.assertEqual(prices["roomId"], 9001)
        self.assertEqual({r["price1"] for r in prices["calendar"]} >= {120.0, 150.0}, True)
        # A second send updates the same property instead of making another.
        fake2 = FakeBeds24()
        with mock.patch.object(beds24, "_request", fake2):
            beds24.sync(self.c)
        again = next(s for s in fake2.sent if s[:2] == ("POST", "/properties"))[2][0]
        self.assertEqual((again["id"], again["roomTypes"][0]["id"]), (501, 9001))

    def test_prices_come_as_runs_of_equal_nights(self):
        monday = date(2027, 1, 4)
        runs = beds24.price_ranges(self.c, days=14, today=monday)
        self.assertEqual(runs[0], {"from": "2027-01-04", "to": "2027-01-07", "price1": 120.0, "minStay": 2})
        self.assertEqual(runs[1], {"from": "2027-01-08", "to": "2027-01-09", "price1": 150.0, "minStay": 2})
        self.assertEqual(sum((date.fromisoformat(r["to"]) - date.fromisoformat(r["from"])).days + 1 for r in runs), 14)

    def test_a_refusal_is_kept_on_the_cottage(self):
        def refuse(method, path, **kw):
            if path == "/authentication/token":
                return {"token": "t1", "expiresIn": 86400}
            return [{"success": False, "errors": [{"field": "country", "message": "invalid"}]}]

        with mock.patch.object(beds24, "_request", refuse), self.assertRaises(beds24.Beds24Error):
            beds24.sync(self.c)
        self.c.refresh_from_db()
        self.assertIn("country", self.c.beds24_error)

    @override_settings(BEDS24_REFRESH_TOKEN="")
    def test_without_a_connection_nothing_is_sent(self):
        self.assertFalse(beds24.enabled())
        with self.assertRaises(beds24.Beds24Error):
            beds24.token()

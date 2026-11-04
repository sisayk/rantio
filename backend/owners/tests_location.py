import json
from unittest import mock

from django.core.cache import cache
from django.test import TestCase

from . import geocode
from . import login as owner_login
from .tests_calendar import make_cottage


class FakeAnswer:
    def __init__(self, rows):
        self.body = json.dumps(rows).encode()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.body


class LocationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.c = make_cottage()
        self.client.force_login(owner_login.user_for(self.c.owner))
        self.url = f"/api/owner/cottages/{self.c.pk}/"

    def patch(self, **body):
        return self.client.patch(self.url, body, content_type="application/json")

    def test_region_is_saved_and_must_belong_to_the_country(self):
        self.assertEqual(self.patch(country="FI", region="uusimaa").status_code, 200)
        self.assertEqual(self.client.get(self.url).json()["region"], "uusimaa")
        self.assertEqual(self.patch(region="dalarna").status_code, 400)
        # A new country drops the old country's region; the pin and the rest stay.
        self.patch(latitude="60.2", longitude="24.9", address="Rantatie 1")
        res = self.patch(country="SE").json()
        self.assertEqual((res["country"], res["region"], res["latitude"], res["address"]), ("SE", "", 60.2, "Rantatie 1"))

    def test_pin_saved_only_as_sent(self):
        self.patch(region="uusimaa", municipality="Porvoo")
        detail = self.client.get(self.url).json()
        self.assertIsNone(detail["latitude"])  # a region or town never becomes the cottage's coordinates
        self.patch(latitude="60.391", longitude="25.66")
        detail = self.client.get(self.url).json()
        self.assertEqual((detail["latitude"], detail["longitude"]), (60.391, 25.66))

    def test_geocode_suggests_and_caches(self):
        rows = [{"lat": "60.3923", "lon": "25.6651", "display_name": "Porvoo, Uusimaa, Finland"}]
        with mock.patch.object(geocode.urllib.request, "urlopen", return_value=FakeAnswer(rows)) as call:
            q = "/api/owner/geocode/?address=Rantatie+1&municipality=Porvoo&country=FI"
            first = self.client.get(q).json()
            second = self.client.get(q).json()
        self.assertEqual(first, {"found": True, "lat": 60.3923, "lng": 25.6651, "label": "Porvoo, Uusimaa, Finland"})
        self.assertEqual(second, first)
        self.assertEqual(call.call_count, 1)
        self.assertIn("countrycodes=ax%2Cfi", call.call_args.args[0].full_url)
        self.assertIsNone(self.client.get(self.url).json()["latitude"])  # only a suggestion

    def test_geocode_nothing_found_or_down(self):
        with mock.patch.object(geocode.urllib.request, "urlopen", return_value=FakeAnswer([])):
            self.assertEqual(self.client.get("/api/owner/geocode/?address=Nowhere&country=SE").json(), {"found": False})
        with mock.patch.object(geocode.urllib.request, "urlopen", side_effect=OSError("down")):
            self.assertEqual(self.client.get("/api/owner/geocode/?address=Other&country=SE").json(), {"found": False})
        self.client.logout()
        self.assertEqual(self.client.get("/api/owner/geocode/?address=x&country=FI").status_code, 403)

from datetime import date, timedelta
from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings

from . import events

TODAY = date.today()
D = lambda n: (TODAY + timedelta(days=n)).isoformat()  # noqa: E731

LINKED = {"meta": {"count": 3}, "data": [
    {"id": "helsinki:1", "name": {"fi": "Joulumarkkinat", "en": "Christmas market"}, "start_time": f"{D(2)}T10:00:00Z",
     "end_time": f"{D(2)}T18:00:00Z", "short_description": {"en": "<p>Crafts and <b>glögi</b> on the square.</p>"},
     "info_url": {"en": "https://example.fi/market"}, "offers": [{"is_free": True}],
     "location": {"name": {"en": "Senate Square"}, "position": {"type": "Point", "coordinates": [24.9525, 60.1694]}},
     "keywords": [{"name": {"en": "markets"}}, {"name": {"en": "families"}}], "images": [{"url": "https://example.fi/m.jpg"}]},
    {"id": "helsinki:2", "name": {"en": "Jazz evening"}, "start_time": f"{D(3)}T17:00:00Z", "end_time": None,
     "info_url": {"en": "https://example.fi/jazz"}, "offers": [{"is_free": False, "price": {"en": "15 €"}}],
     "location": {"name": {"en": "Club"}, "position": {"coordinates": [24.93, 60.17]}}, "keywords": [{"name": {"en": "jazz"}}]},
    {"id": "helsinki:3", "name": {"en": "After the stay"}, "start_time": f"{D(20)}T17:00:00Z",
     "info_url": {"en": "https://example.fi/late"}, "location": {"position": {"coordinates": [24.93, 60.17]}}},
]}

TM = {"_embedded": {"events": [
    {"id": "Z1", "name": "HIFK – Tappara", "url": "https://www.ticketmaster.fi/event/1",
     "dates": {"start": {"localDate": D(4), "localTime": "18:30:00", "dateTime": f"{D(4)}T16:30:00Z"}, "status": {"code": "onsale"}},
     "priceRanges": [{"type": "standard", "currency": "EUR", "min": 22.0, "max": 59.0}],
     "classifications": [{"segment": {"name": "Sports"}, "genre": {"name": "Hockey"}}],
     "_embedded": {"venues": [{"name": "Nordis", "location": {"latitude": "60.188", "longitude": "24.92"}}]}},
    {"id": "Z2", "name": "Far away show", "url": "https://www.ticketmaster.fi/event/2",
     "dates": {"start": {"localDate": D(4)}}, "_embedded": {"venues": [{"location": {"latitude": "61.5", "longitude": "23.76"}}]}},
]}}


def answer(url, timeout=10):
    return TM if "ticketmaster" in url else LINKED


@override_settings(TICKETMASTER_API_KEY="tm-key")
class EventsTests(TestCase):
    def setUp(self):
        cache.clear()

    def get(self, **q):
        return self.client.get("/api/events/", {"lat": 60.17, "lng": 24.94, "lang": "en", **q})

    def test_events_during_the_stay_nearest_dates_first(self):
        with mock.patch.object(events, "_get", side_effect=answer) as call:
            res = self.get(**{"from": D(1), "to": D(5)})
            self.get(**{"from": D(1), "to": D(5)})
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual([e["name"] for e in body["events"]], ["Christmas market", "Jazz evening", "HIFK – Tappara"])
        self.assertEqual(call.call_count, 2)  # both sources once; the second ask came from the cache
        market, jazz, hockey = body["events"]
        self.assertEqual((market["price"]["free"], market["interests"]), (True, ["market", "family"]))
        self.assertEqual(market["description"], "Crafts and glögi on the square.")
        self.assertEqual((jazz["price"]["free"], jazz["price"]["text"]), (False, "15 €"))
        self.assertEqual((hockey["price"]["min"], hockey["price"]["max"], hockey["interests"]), (22.0, 59.0, ["sports"]))
        self.assertLess(market["km"], 2)
        self.assertEqual(body["sources"], ["Linked Events", "Ticketmaster"])

    def test_one_source_down(self):
        def broken(url, timeout=10):
            if "ticketmaster" in url:
                raise OSError("down")
            return LINKED
        with mock.patch.object(events, "_get", side_effect=broken):
            body = self.get(**{"from": D(1), "to": D(5)}).json()
        self.assertEqual(body["sources"], ["Linked Events"])
        self.assertEqual(len(body["events"]), 2)

    @override_settings(TICKETMASTER_API_KEY="")
    def test_outside_the_covered_areas(self):
        with mock.patch.object(events, "_get") as call:
            body = self.get(lat=66.5, lng=25.7, **{"from": D(1), "to": D(5)}).json()
        call.assert_not_called()
        self.assertEqual(body, {"events": [], "sources": [], "covered": False})

    def test_dates_are_checked(self):
        self.assertEqual(self.get(**{"from": D(5), "to": D(1)}).status_code, 400)
        self.assertEqual(self.get(**{"from": D(1), "to": D(90)}).status_code, 400)
        self.assertEqual(self.get(to=D(3)).status_code, 400)

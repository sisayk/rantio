from unittest import mock

from django.test import TestCase

from . import calendar
from . import login as owner_login
from .listing_links import detect_site
from .models import CalendarBlock, CalendarFeed, ListingLink
from .tests_calendar import AIRBNB_ICS, D, make_cottage, ymd

ICS = AIRBNB_ICS.format(a=ymd(D(10)), b=ymd(D(13)), c=ymd(D(20)), d=ymd(D(22)))


class ListingLinkTests(TestCase):
    def setUp(self):
        self.c = make_cottage()
        self.client.force_login(owner_login.user_for(self.c.owner))

    def add(self, url, calendar_url=""):
        body = {"url": url, **({"calendar_url": calendar_url} if calendar_url else {})}
        with mock.patch.object(calendar, "fetch", return_value=ICS):
            return self.client.post(f"/api/owner/cottages/{self.c.pk}/links/", body, content_type="application/json")

    def test_sites_are_recognised_from_the_address(self):
        self.assertEqual(detect_site("https://www.lomarengas.fi/en/cottages/kolari-15862"), "lomarengas")
        self.assertEqual(detect_site("https://mokkivuokra.fi/kohde/123"), "mokkivuokra")
        self.assertEqual(detect_site("https://www.airbnb.fi/rooms/42"), "airbnb")
        self.assertEqual(detect_site("https://saunatila.fi/tila/9"), "")

    def test_a_link_with_its_calendar_closes_those_dates(self):
        res = self.add("https://www.lomarengas.fi/en/cottages/x-1", "https://www.lomarengas.fi/ical/1.ics")
        self.assertEqual(res.status_code, 201, res.content)
        row = res.json()
        self.assertEqual((row["site"], row["name"], row["calendar_state"]), ("lomarengas", "Lomarengas", "connected"))
        self.assertFalse(calendar.is_free(self.c, D(10), D(12)))
        entry = next(e for e in calendar.entries([self.c], D(0), D(30)) if e.kind == "site")
        self.assertEqual((entry.channel, entry.label), ("lomarengas", "Lomarengas"))

    def test_two_other_sites_each_keep_their_own_calendar(self):
        self.add("https://saunatila.fi/tila/9", "https://saunatila.fi/cal/9.ics")
        res = self.add("https://example.org/mokki", "https://example.org/mokki.ics")
        self.assertEqual(res.json()["name"], "example.org")
        self.assertEqual(CalendarFeed.objects.filter(cottage=self.c, channel="other").count(), 2)

    def test_removing_a_link_removes_its_dates(self):
        link_id = self.add("https://saunatila.fi/tila/9", "https://saunatila.fi/cal/9.ics").json()["id"]
        self.assertTrue(CalendarBlock.objects.filter(cottage=self.c).exists())
        self.assertEqual(self.client.delete(f"/api/owner/links/{link_id}/").status_code, 204)
        self.assertFalse(CalendarBlock.objects.filter(cottage=self.c).exists())
        self.assertFalse(CalendarFeed.objects.filter(cottage=self.c).exists())

    def test_a_nettimokki_link_sets_the_cottage_address_for_its_emails(self):
        link_id = self.add("https://www.nettimokki.com/en/savonlinna/jarvihuvila/51966").json()["id"]
        self.c.refresh_from_db()
        self.assertEqual(self.c.nettimokki_url, "https://www.nettimokki.com/en/savonlinna/jarvihuvila/51966")
        self.client.delete(f"/api/owner/links/{link_id}/")
        self.c.refresh_from_db()
        self.assertEqual(self.c.nettimokki_url, "")

    def test_the_editors_nettimokki_field_shows_among_the_links(self):
        url = "https://www.nettimokki.com/en/savonlinna/jarvihuvila/51966"
        res = self.client.patch(f"/api/owner/cottages/{self.c.pk}/", {"nettimokki_url": url}, content_type="application/json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual([k["site"] for k in res.json()["links"]], ["nettimokki"])

    def test_the_same_link_twice_and_plain_http_are_refused(self):
        self.add("https://mokkivuokra.fi/kohde/1")
        self.assertEqual(self.add("https://mokkivuokra.fi/kohde/1").status_code, 400)
        self.assertEqual(self.add("http://mokkivuokra.fi/kohde/2").status_code, 400)

    def test_calendar_can_be_added_later_and_removed(self):
        link_id = self.add("https://mokkivuokra.fi/kohde/1").json()["id"]
        with mock.patch.object(calendar, "fetch", return_value=ICS):
            res = self.client.patch(f"/api/owner/links/{link_id}/", {"calendar_url": "https://mokkivuokra.fi/c.ics"},
                                    content_type="application/json")
        self.assertEqual(res.json()["calendar_state"], "connected")
        res = self.client.patch(f"/api/owner/links/{link_id}/", {"calendar_url": ""}, content_type="application/json")
        self.assertEqual(res.json()["calendar_state"], "none")
        self.assertTrue(calendar.is_free(self.c, D(10), D(12)))

    def test_only_the_owner_can_touch_a_link(self):
        link = ListingLink.objects.create(cottage=self.c, site="", url="https://example.org/x")
        other = make_cottage(email="other@example.fi")
        self.client.force_login(owner_login.user_for(other.owner))
        self.assertEqual(self.client.delete(f"/api/owner/links/{link.pk}/").status_code, 404)
        self.assertEqual(self.client.get(f"/api/owner/cottages/{self.c.pk}/links/").status_code, 404)

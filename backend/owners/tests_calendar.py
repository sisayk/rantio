from datetime import date, timedelta
from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from . import calendar
from . import login as owner_login
from .booking_requests import RequestError
from .models import Booking, CalendarBlock, CalendarFeed, Conversation, Cottage, Owner, RequestStatus

D = lambda n: timezone.localdate() + timedelta(days=n)  # noqa: E731

AIRBNB_ICS = """BEGIN:VCALENDAR\r
VERSION:2.0\r
PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN\r
BEGIN:VEVENT\r
DTSTAMP:20261030T080000Z\r
DTSTART;VALUE=DATE:{a}\r
DTEND;VALUE=DATE:{b}\r
SUMMARY:Reserved\r
UID:1418fb94e984-0b84c0f2d5f1a4f7\r
 3a0b0c0d@airbnb.com\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTAMP:20261030T080000Z\r
DTSTART;VALUE=DATE:{c}\r
DTEND;VALUE=DATE:{d}\r
SUMMARY:Airbnb (Not available)\r
UID:blocked-2@airbnb.com\r
END:VEVENT\r
BEGIN:VEVENT\r
DTSTART;VALUE=DATE:{c}\r
DTEND;VALUE=DATE:{d}\r
UID:stugora-booking-99@rantio.fi\r
SUMMARY:Not available\r
END:VEVENT\r
END:VCALENDAR\r
"""


def ymd(d: date) -> str:
    return d.strftime("%Y%m%d")


def make_cottage(**kw) -> Cottage:
    owner = Owner.objects.create(name="Aino Järvinen", email=kw.pop("email", "aino@example.fi"), language="fi")
    return Cottage.objects.create(
        owner=owner, name="Järvihuvila", municipality="Savonlinna", max_guests=6,
        price_per_night=Decimal("150.00"), cleaning_fee=Decimal("60.00"), min_nights=2, status=Cottage.Status.LIVE, **kw,
    )


class CalendarLogicTests(TestCase):
    def setUp(self):
        self.c = make_cottage()

    def test_bookings_and_owner_blocks_make_dates_busy_and_cancelled_ones_do_not(self):
        Booking.objects.create(cottage=self.c, channel="nettimokki", check_in=D(10), check_out=D(13), owner_payout=0)
        Booking.objects.create(cottage=self.c, channel="airbnb", check_in=D(20), check_out=D(22), owner_payout=0, cancelled=True)
        CalendarBlock.objects.create(cottage=self.c, start=D(13), end=D(15))
        self.assertFalse(calendar.is_free(self.c, D(12), D(14)))
        self.assertFalse(calendar.is_free(self.c, D(14), D(16)))
        self.assertTrue(calendar.is_free(self.c, D(15), D(18)))  # check-out day of the block is free
        self.assertTrue(calendar.is_free(self.c, D(20), D(22)))
        self.assertEqual(calendar.busy_ranges(self.c, D(0), D(60)), [(D(10), D(15))])  # touching stretches merge

    def test_double_bookings_are_found_but_a_site_never_clashes_with_itself(self):
        feed = CalendarFeed.objects.create(cottage=self.c, channel="airbnb", url="https://example.com/a.ics")
        Booking.objects.create(cottage=self.c, channel="airbnb", check_in=D(10), check_out=D(13), owner_payout=0)
        CalendarBlock.objects.create(cottage=self.c, feed=feed, uid="x", start=D(10), end=D(13))  # same stay, read back
        items = calendar.entries([self.c], D(0), D(60))
        self.assertEqual(calendar.conflicts(items), [])
        Booking.objects.create(cottage=self.c, channel="nettimokki", check_in=D(12), check_out=D(14), owner_payout=0)
        kinds = sorted(tuple(sorted((a.channel, b.channel))) for a, b in calendar.conflicts(calendar.entries([self.c], D(0), D(60))))
        self.assertEqual(kinds, [("airbnb", "nettimokki"), ("airbnb", "nettimokki")])


class IcalTests(TestCase):
    def setUp(self):
        self.c = make_cottage()

    def test_reads_airbnb_calendar_with_folded_lines_and_skips_our_own_echo(self):
        feed = CalendarFeed.objects.create(cottage=self.c, channel="airbnb", url="https://www.airbnb.com/calendar/ical/1.ics")
        text = AIRBNB_ICS.format(a=ymd(D(5)), b=ymd(D(8)), c=ymd(D(20)), d=ymd(D(21)))
        self.assertEqual(calendar.sync_feed(feed, get=lambda url: text), 2)
        blocks = list(CalendarBlock.objects.filter(feed=feed).order_by("start"))
        self.assertEqual([(b.start, b.end) for b in blocks], [(D(5), D(8)), (D(20), D(21))])
        self.assertEqual(blocks[0].uid, "1418fb94e984-0b84c0f2d5f1a4f73a0b0c0d@airbnb.com")
        feed.refresh_from_db()
        self.assertIsNotNone(feed.last_synced_at)
        # The guest cancels on Airbnb: the next read frees the dates.
        only_block = text.split("BEGIN:VEVENT")[0] + "BEGIN:VEVENT" + text.split("BEGIN:VEVENT")[2] + "END:VCALENDAR\r\n"
        calendar.sync_feed(feed, get=lambda url: only_block)
        self.assertEqual([(b.start, b.end) for b in CalendarBlock.objects.filter(feed=feed)], [(D(20), D(21))])

    def test_a_link_that_isnt_a_calendar_is_reported_not_guessed(self):
        feed = CalendarFeed.objects.create(cottage=self.c, channel="vrbo", url="https://example.com/x")
        with self.assertRaises(calendar.FeedError):
            calendar.sync_feed(feed, get=lambda url: "<html>Sign in</html>")
        with self.assertRaises(calendar.FeedError):
            calendar.fetch("http://insecure.example.com/cal.ics")
        feed.refresh_from_db()
        self.assertTrue(feed.last_error)

    def test_export_has_every_busy_date_but_leaves_a_site_its_own(self):
        feed = CalendarFeed.objects.create(cottage=self.c, channel="airbnb", url="https://example.com/a.ics")
        CalendarBlock.objects.create(cottage=self.c, feed=feed, uid="a1", start=D(5), end=D(8), note="Reserved")
        Booking.objects.create(cottage=self.c, channel="nettimokki", check_in=D(10), check_out=D(12), owner_payout=0)
        CalendarBlock.objects.create(cottage=self.c, start=D(30), end=D(31), note="Family week")
        res = self.client.get(f"/api/calendar/{self.c.calendar_token}.ics?site=booking")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res["Content-Type"].startswith("text/calendar"))
        events = calendar.parse_ics(res.content.decode())
        self.assertEqual([(e.start, e.end) for e in events], [(D(5), D(8)), (D(10), D(12)), (D(30), D(31))])
        body = res.content.decode()
        self.assertNotIn("Family week", body)  # notes and guests never leave Rantio
        self.assertNotIn("Reserved", body)
        for_airbnb = calendar.parse_ics(self.client.get(f"/api/calendar/{self.c.calendar_token}.ics?site=airbnb").content.decode())
        self.assertEqual([(e.start, e.end) for e in for_airbnb], [(D(10), D(12)), (D(30), D(31))])
        self.assertEqual(self.client.get("/api/calendar/nope.ics").status_code, 404)


@override_settings(SITE_URL="https://rantio.fi")
class BookingRequestTests(TestCase):
    def setUp(self):
        cache.clear()
        self.c = make_cottage()
        self.url = f"/api/book/{self.c.booking_link_token}/"

    def ask(self, **kw):
        data = {"name": "Kadri Tamm", "email": "Kadri@Example.ee", "lang": "et", "check_in": D(30).isoformat(),
                "check_out": D(33).isoformat(), "adults": 2, "children": 1, "body": "Kas saab tulla koeraga?"} | kw
        return self.client.post(self.url, data, content_type="application/json")

    def test_guest_sees_busy_dates_but_not_why(self):
        Booking.objects.create(cottage=self.c, channel="airbnb", check_in=D(10), check_out=D(12), owner_payout=0, guests=2)
        data = self.client.get(self.url).json()
        self.assertEqual(data["busy"], [[D(10).isoformat(), D(12).isoformat()]])
        self.assertEqual(data["host"], "Aino")
        self.assertEqual((data["price_per_night"], data["currency"], data["min_nights"]), ("150.00", "EUR", 2))
        self.assertNotIn("airbnb", str(data).lower())
        self.assertEqual(self.client.get("/api/book/wrong/").status_code, 404)

    def test_request_is_a_conversation_and_emails_guest_and_owner_in_their_languages(self):
        res = self.ask()
        self.assertEqual(res.status_code, 201, res.json())
        c = Conversation.objects.get(token=res.json()["token"])
        self.assertEqual((c.request_status, c.guests, c.children, c.guest_email), ("pending", 2, 1, "kadri@example.ee"))
        self.assertEqual(c.messages.get().body, "Kas saab tulla koeraga?")
        subjects = {m.to[0]: m.subject for m in mail.outbox}
        self.assertIn("broneerimissoov", subjects["kadri@example.ee"].lower())
        self.assertIn("Varauspyyntö", subjects["aino@example.fi"])
        self.assertIn(f"/fi/hosting/calendar?request={c.pk}", mail.outbox[1].body)
        self.assertTrue(calendar.is_free(self.c, D(30), D(33)))  # a request doesn't close dates

    def test_requests_are_checked(self):
        Booking.objects.create(cottage=self.c, channel="airbnb", check_in=D(31), check_out=D(32), owner_payout=0)
        self.assertEqual(self.ask().json(), {"detail": "taken"})
        self.assertEqual(self.ask(check_in=D(40).isoformat(), check_out=D(41).isoformat()).json(), {"detail": "min_nights"})
        self.assertEqual(self.ask(check_in=D(40).isoformat(), check_out=D(43).isoformat(), adults=6).json(), {"detail": "guests"})
        self.assertEqual(self.ask(check_in=D(-3).isoformat(), check_out=D(1).isoformat()).json(), {"detail": "dates"})
        self.assertEqual(self.ask(website="spam").status_code, 400)
        self.c.booking_requests_open = False
        self.c.save()
        self.assertEqual(self.ask(check_in=D(40).isoformat(), check_out=D(43).isoformat()).json(), {"detail": "closed"})
        self.assertEqual(Conversation.objects.count(), 0)


@override_settings(SITE_URL="https://rantio.fi", BOOKING_ALERTS=True)
class OwnerCalendarApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.c = make_cottage()
        self.owner = self.c.owner
        self.client.force_login(owner_login.user_for(self.owner))
        other = make_cottage(email="someone@example.fi")
        self.other_block = CalendarBlock.objects.create(cottage=other, start=D(1), end=D(3))

    def request(self) -> Conversation:
        res = self.client.post(f"/api/book/{self.c.booking_link_token}/", {
            "name": "Erik Lund", "email": "erik@example.se", "lang": "sv", "check_in": D(30).isoformat(),
            "check_out": D(33).isoformat(), "adults": 2, "body": "Hej!",
        }, content_type="application/json")
        return Conversation.objects.get(token=res.json()["token"])

    def test_calendar_shows_own_cottages_only_with_links_and_requests(self):
        CalendarBlock.objects.create(cottage=self.c, start=D(5), end=D(7), note="Remont")
        conv = self.request()
        data = self.client.get(f"/api/owner/calendar/?from={D(0).isoformat()}&months=3").json()
        self.assertEqual([c["id"] for c in data["cottages"]], [self.c.pk])
        cottage = data["cottages"][0]
        self.assertEqual(cottage["booking_link"], f"https://rantio.fi/book/{self.c.booking_link_token}")
        self.assertEqual(cottage["export"]["airbnb"], f"https://rantio.fi/api/calendar/{self.c.calendar_token}.ics?site=airbnb")
        self.assertEqual({e["kind"] for e in data["entries"]}, {"block", "request"})
        self.assertEqual(data["requests"][0]["id"], conv.pk)
        self.assertEqual(data["requests"][0]["estimate"], "510.00")  # 3 × 150 + 60 cleaning
        self.assertTrue(data["requests"][0]["free"])

    def test_close_and_reopen_dates_but_never_someone_elses_or_a_sites(self):
        res = self.client.post("/api/owner/calendar/blocks/", {"cottage": self.c.pk, "start": D(5).isoformat(),
                               "end": D(8).isoformat(), "note": "Oma loma"}, content_type="application/json")
        self.assertEqual(res.status_code, 201)
        self.assertFalse(calendar.is_free(self.c, D(6), D(7)))
        self.assertEqual(self.client.delete(f"/api/owner/calendar/blocks/{res.json()['id']}/").status_code, 204)
        self.assertTrue(calendar.is_free(self.c, D(6), D(7)))
        self.assertEqual(self.client.delete(f"/api/owner/calendar/blocks/{self.other_block.pk}/").status_code, 404)
        feed = CalendarFeed.objects.create(cottage=self.c, channel="airbnb", url="https://example.com/a.ics")
        site_block = CalendarBlock.objects.create(cottage=self.c, feed=feed, uid="u", start=D(9), end=D(10))
        self.assertEqual(self.client.delete(f"/api/owner/calendar/blocks/{site_block.pk}/").status_code, 404)
        bad = self.client.post("/api/owner/calendar/blocks/", {"cottage": self.c.pk, "start": D(5).isoformat(),
                               "end": D(5).isoformat()}, content_type="application/json")
        self.assertEqual(bad.status_code, 400)

    def test_accepting_books_the_stay_uncharged_closes_dates_and_tells_the_guest(self):
        conv = self.request()
        mail.outbox.clear()
        res = self.client.post(f"/api/owner/conversations/{conv.pk}/accept/", {"payout": "510.00"}, content_type="application/json")
        self.assertEqual(res.status_code, 200, res.json())
        self.assertEqual(res.json()["request_status"], "accepted")
        b = Booking.objects.get(cottage=self.c)
        self.assertEqual((b.channel, b.owner_payout, b.guests, b.is_chargeable), ("owner", Decimal("510.00"), 2, False))
        self.assertFalse(calendar.is_free(self.c, D(30), D(33)))
        self.assertEqual([m.to for m in mail.outbox], [["erik@example.se"]])  # no "new booking" alert to the owner
        self.assertIn("Bekräftat", mail.outbox[0].subject)
        again = self.client.post(f"/api/owner/conversations/{conv.pk}/accept/", {"payout": "510.00"}, content_type="application/json")
        self.assertEqual(again.json(), {"detail": "not_pending"})

    def test_cant_accept_dates_taken_since_and_declining_tells_the_guest(self):
        conv = self.request()
        Booking.objects.create(cottage=self.c, channel="airbnb", check_in=D(32), check_out=D(35), owner_payout=0)
        res = self.client.post(f"/api/owner/conversations/{conv.pk}/accept/", {"payout": "0"}, content_type="application/json")
        self.assertEqual(res.json(), {"detail": "taken"})
        mail.outbox.clear()
        self.assertEqual(self.client.post(f"/api/owner/conversations/{conv.pk}/decline/").status_code, 200)
        conv.refresh_from_db()
        self.assertEqual(conv.request_status, RequestStatus.DECLINED)
        self.assertIn("inte lediga", mail.outbox[0].subject)

    def test_booking_link_can_be_closed_and_renewed(self):
        old = self.c.booking_link_token
        res = self.client.patch(f"/api/owner/cottages/{self.c.pk}/booking-link/", {"open": False}, content_type="application/json")
        self.assertFalse(res.json()["booking_requests_open"])
        self.assertFalse(self.client.get(f"/api/book/{old}/").json()["open"])
        res = self.client.post(f"/api/owner/cottages/{self.c.pk}/booking-link/")
        self.assertNotIn(old, res.json()["booking_link"])
        self.assertEqual(self.client.get(f"/api/book/{old}/").status_code, 404)

    def test_adding_a_site_calendar_reads_it_and_keeps_a_bad_link_with_the_reason(self):
        res = self.client.post("/api/owner/calendar/feeds/", {"cottage": self.c.pk, "channel": "airbnb",
                               "url": "https://127.0.0.1:1/never.ics"}, content_type="application/json")
        self.assertEqual(res.status_code, 201)
        self.assertTrue(res.json()["last_error"])
        self.assertEqual(self.client.post("/api/owner/calendar/feeds/", {"cottage": self.c.pk, "channel": "airbnb",
                         "url": "http://example.com/a.ics"}, content_type="application/json").status_code, 400)
        self.assertEqual(self.client.delete(f"/api/owner/calendar/feeds/{res.json()['id']}/").status_code, 204)

    def test_signed_out_gets_nothing(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/owner/calendar/").status_code, 403)


class FeedAddressTests(TestCase):
    """Calendar links can't reach the server's own network."""

    def test_internal_addresses_are_refused(self):
        from .calendar import FeedError, check_address
        for url in ["https://127.0.0.1/x.ics", "https://localhost/x.ics", "https://10.0.0.5/x.ics",
                    "https://169.254.169.254/latest", "https://[::1]/x", "https://example.com:8443/x.ics", "http://example.com/x"]:
            with self.subTest(url=url), self.assertRaises(FeedError):
                check_address(url)

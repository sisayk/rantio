"""Regression tests for the security audit of November 2026: one test per fixed finding."""

from datetime import date
from decimal import Decimal

from django.contrib.auth.models import Permission, User
from django.core.cache import cache
from django.test import TestCase, override_settings

from . import app as app_keys
from . import invoicing
from . import login as owner_login
from .listing_links import detect_site
from .models import Booking, CalendarFeed, Cottage, Invoice, Owner
from .reviews import host_row
from .tests_calendar import make_cottage


class AdminTests(TestCase):
    def test_actions_need_the_change_permission(self):
        """Staff who may only look at invoices can't send them (and charge cards) with an action."""
        c = make_cottage()
        inv = Invoice.objects.create(owner=c.owner, month=date(2026, 11, 1), number="STG-2026-0001", status=Invoice.Status.SENT,
                                     lines=[], subtotal=0, vat=0, total=0)
        viewer = User.objects.create_user("viewer", password="x", is_staff=True)
        viewer.user_permissions.add(Permission.objects.get(codename="view_invoice"))
        self.client.force_login(viewer)
        self.client.post("/admin/owners/invoice/", {"action": "mark_paid", "_selected_action": [inv.pk]})
        inv.refresh_from_db()
        self.assertEqual(inv.status, Invoice.Status.SENT)

    def test_an_owners_user_link_cant_be_edited(self):
        from django.contrib import admin

        self.assertIn("user", admin.site._registry[Owner].readonly_fields)

    def test_braces_in_a_cottage_name_dont_break_the_invoice_page(self):
        c = make_cottage()
        inv = Invoice.objects.create(owner=c.owner, month=date(2026, 11, 1), number="STG-2026-0002",
                                     lines=[{"kind": "commission", "description": "12 % · Villa {x}", "amount": "1.00"}],
                                     subtotal=1, vat=0, total=1)
        self.client.force_login(User.objects.create_superuser("root", "r@example.com", "x"))
        res = self.client.get(f"/admin/owners/invoice/{inv.pk}/change/")
        self.assertContains(res, "Villa {x}")


class PublicDataTests(TestCase):
    def test_the_host_is_shown_by_the_name_they_chose(self):
        c = make_cottage()
        c.owner.name, c.owner.legal_first_name = "Aino Järvi", "Aino-Maria Kristiina"
        c.owner.save()
        self.assertEqual(host_row(c)["name"], "Aino")

    def test_a_look_alike_address_isnt_the_site(self):
        self.assertEqual(detect_site("https://www.airbnb.fi/rooms/1"), "airbnb")
        self.assertEqual(detect_site("https://www.airbnb.co.uk/rooms/1"), "airbnb")
        self.assertEqual(detect_site("https://fi.nettimokki.com/x"), "nettimokki")
        self.assertEqual(detect_site("https://airbnb.xyz/rooms/1"), "")
        self.assertEqual(detect_site("https://vrbo.top/1"), "")
        self.assertEqual(detect_site("https://airbnb.com.evil.example/1"), "")


class HandoffTests(TestCase):
    def test_a_handoff_link_doesnt_switch_a_signed_in_browser_to_another_account(self):
        victim = owner_login.new_account("victim@example.com")
        attacker = owner_login.new_account("attacker@example.com")
        owner_login.user_for(attacker)
        self.client.force_login(owner_login.user_for(victim))
        token = app_keys.issue_web_token(Owner.objects.get(pk=attacker.pk))
        self.client.get("/api/auth/handoff/", {"t": token, "next": "/en/hosting"})
        self.assertEqual(self.client.get("/api/owner/me/").json()["email"], "victim@example.com")


@override_settings(DEV_LOGIN_CODES=False, APP_REVIEW_EMAIL="review@rantio.fi", APP_REVIEW_CODE="246810")
class ReviewerCodeTests(TestCase):
    def test_wrong_codes_from_many_addresses_pause_the_code(self):
        from . import account

        cache.clear()
        for i in range(account.REVIEW_TRIES_ALL):
            self.assertIsNone(account.review_sign_in("review@rantio.fi", "000000", ip=f"10.0.{i // 250}.{i % 250}"))
        self.assertIsNone(account.review_sign_in("review@rantio.fi", "246810", ip="192.0.2.1"))


class ListingTests(TestCase):
    def setUp(self):
        self.cottage = make_cottage()
        self.client.force_login(owner_login.user_for(self.cottage.owner))

    def test_a_copy_doesnt_take_the_originals_channel_manager_room(self):
        Cottage.objects.filter(pk=self.cottage.pk).update(beds24_property_id=11, beds24_room_id=22, beds24_error="x")
        res = self.client.post(f"/api/owner/cottages/{self.cottage.pk}/duplicate/")
        self.assertEqual(res.status_code, 201, res.content)
        copy = Cottage.objects.exclude(pk=self.cottage.pk).get()
        self.assertEqual((copy.beds24_property_id, copy.beds24_room_id, copy.beds24_error), (None, None, ""))

    def test_a_cottage_that_was_live_is_archived_not_deleted(self):
        Cottage.objects.filter(pk=self.cottage.pk).update(listing_started_on=date(2026, 1, 1))
        res = self.client.delete(f"/api/owner/cottages/{self.cottage.pk}/", {"confirm": self.cottage.name},
                                 content_type="application/json")
        self.assertEqual((res.status_code, res.json()), (409, {"reason": "was_live"}))

    def test_cottages_per_owner_are_capped(self):
        from . import listings

        with self.settings():
            old, listings.MAX_COTTAGES = listings.MAX_COTTAGES, 1
            try:
                res = self.client.post(f"/api/owner/cottages/{self.cottage.pk}/duplicate/")
                self.assertEqual((res.status_code, res.json()), (409, {"reason": "too_many"}))
                self.assertEqual(self.client.post("/api/owner/cottages/", {"name": "New"}, content_type="application/json").status_code, 409)
            finally:
                listings.MAX_COTTAGES = old


class DeletedAccountTests(TestCase):
    def test_closing_an_account_wipes_what_was_private_and_ends_its_links(self):
        c = make_cottage()
        o = c.owner
        o.legal_first_name, o.legal_last_name, o.payout_iban, o.city = "Aino", "Järvi", "FI2112345600000785", "Lahti"
        o.date_of_birth, o.emergency_phone = date(1980, 1, 2), "+358401234567"
        o.save()
        Cottage.objects.filter(pk=c.pk).update(address="Rantatie 1", access_details="Door 1234", arrival_instructions="Key box")
        CalendarFeed.objects.create(cottage=c, channel="airbnb", url="https://www.airbnb.fi/calendar/ical/1.ics")
        c.refresh_from_db()
        old_calendar, old_booking = c.calendar_token, c.booking_link_token
        self.client.force_login(owner_login.user_for(o))
        self.assertEqual(self.client.delete("/api/owner/me/").json(), {"deleted": "closed"})
        o.refresh_from_db()
        c.refresh_from_db()
        self.assertEqual((o.legal_first_name, o.legal_last_name, o.payout_iban, o.city, o.date_of_birth, o.emergency_phone),
                         ("", "", "", "", None, ""))
        self.assertEqual((c.address, c.access_details, c.arrival_instructions), ("", "", ""))
        self.assertFalse(c.feeds.exists())
        self.assertNotIn(old_calendar, (c.calendar_token,))
        self.assertEqual(self.client.get(f"/api/calendar/{old_calendar}.ics").status_code, 404)
        self.assertEqual(self.client.get(f"/api/book/{old_booking}/").status_code, 404)

    def test_a_closed_account_is_still_invoiced_for_the_stays_it_had(self):
        c = make_cottage()
        Cottage.objects.filter(pk=c.pk).update(listing_started_on=date(2026, 1, 1))
        Booking.objects.create(cottage=c, channel="booking", check_in=date(2026, 11, 5), check_out=date(2026, 11, 8),
                               owner_payout=Decimal("500.00"))
        self.client.force_login(owner_login.user_for(c.owner))
        self.client.delete("/api/owner/me/")
        invoices = invoicing.build_all(date(2026, 11, 1))
        self.assertEqual([i.owner_id for i in invoices], [c.owner_id])
        self.assertIn("commission", [x["kind"] for x in invoices[0].lines])


# ---------------------------------------------------------------------------------------------
# Part 2: one bad input must not stop a job, and money isn't taken twice.

from unittest import mock  # noqa: E402

from django.utils import timezone  # noqa: E402

from . import beds24, booking_emails, booking_requests, calendar, stripe_api  # noqa: E402
from .models import CalendarBlock, Conversation, RequestStatus  # noqa: E402
from .tests_calendar import D  # noqa: E402

ICS = "BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:a@x\r\nDTSTART;VALUE=DATE:{a}\r\nDTEND;VALUE=DATE:{b}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"


class FeedTests(TestCase):
    def setUp(self):
        cache.clear()
        self.c = make_cottage()
        self.feed = CalendarFeed.objects.create(cottage=self.c, channel="airbnb", url="https://www.airbnb.fi/calendar/ical/1.ics")

    def good(self):
        return ICS.format(a=D(10).strftime("%Y%m%d"), b=D(12).strftime("%Y%m%d"))

    def test_a_date_that_isnt_one_is_skipped(self):
        self.assertIsNone(calendar._date("20261340"))
        self.assertEqual(calendar.sync_feed(self.feed, get=lambda url: ICS.format(a="20261340", b="20261342")), 0)

    def test_one_broken_calendar_doesnt_stop_the_others(self):
        other = CalendarFeed.objects.create(cottage=self.c, channel="booking", url="https://admin.booking.com/ical/2.ics")

        def get(url):
            if "airbnb" in url:
                raise RuntimeError("surprise")
            return self.good()

        self.assertEqual(calendar.sync_all(get=get), (1, 1))
        self.assertTrue(CalendarBlock.objects.filter(feed=other).exists())

    def test_the_calendar_read_longest_ago_goes_first(self):
        other = CalendarFeed.objects.create(cottage=self.c, channel="booking", url="https://admin.booking.com/ical/2.ics")
        CalendarFeed.objects.filter(pk=self.feed.pk).update(last_synced_at=timezone.now())
        seen = []
        calendar.sync_all(get=lambda url: seen.append(url) or self.good())
        self.assertEqual(seen[0], other.url)

    def test_a_suddenly_empty_calendar_keeps_its_dates_until_it_says_so_twice(self):
        calendar.sync_feed(self.feed, get=lambda url: self.good())
        empty = "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n"
        calendar.sync_feed(self.feed, get=lambda url: empty)
        self.assertEqual(CalendarBlock.objects.filter(feed=self.feed).count(), 1)
        calendar.sync_feed(self.feed, get=lambda url: empty)
        self.assertEqual(CalendarBlock.objects.filter(feed=self.feed).count(), 0)

    def test_a_site_sending_a_byte_at_a_time_is_given_up_on(self):
        class Slow:
            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def read1(self, n):
                return b"x"

        clock = iter(range(0, 10_000, 10))
        with mock.patch.object(calendar, "check_address"), mock.patch.object(calendar._opener, "open", return_value=Slow()), \
                mock.patch.object(calendar.time, "monotonic", side_effect=lambda: next(clock)):
            with self.assertRaises(calendar.FeedError):
                calendar.fetch("https://slow.example/cal.ics")


class BookingEmailTests(TestCase):
    def test_an_unknown_charset_or_a_nul_byte_is_still_stored(self):
        raw = (b"From: a@example.com\r\nTo: bookings@rantio.fi\r\nSubject: Varaus\x00\r\nMessage-ID: <1@x>\r\n"
               b'Content-Type: text/plain; charset="nope-8"\r\n\r\nHei \x00 maailma\r\n')
        email = booking_emails.ingest(raw)
        self.assertNotIn("\x00", email.body + email.subject + email.raw)
        self.assertIn("maailma", email.body)

    def test_only_a_handful_of_recipients_are_looked_at_for_the_cottage_code(self):
        c = make_cottage()
        guesses = ", ".join(f"bookings+{i:08x}@rantio.fi" for i in range(50))
        raw = f"From: x@example.com\r\nTo: {guesses}, {c.forwarding_address}\r\nSubject: s\r\n\r\nbody\r\n"
        self.assertIsNone(booking_emails.find_cottage(booking_emails.to_message(raw), "body")[0])
        raw = f"From: x@example.com\r\nTo: {c.forwarding_address}\r\nSubject: s\r\n\r\nbody\r\n"
        self.assertEqual(booking_emails.find_cottage(booking_emails.to_message(raw), "body")[0], c)


class Beds24Tests(TestCase):
    def test_one_odd_booking_row_is_skipped_and_the_rest_come_in(self):
        cache.clear()
        c = make_cottage()
        Cottage.objects.filter(pk=c.pk).update(beds24_property_id=1, beds24_room_id=7)
        rows = [
            {"roomId": 7, "arrival": D(5).isoformat(), "departure": D(8).isoformat(), "numAdult": "two"},  # no id, bad number
            {"id": 2, "roomId": 7, "arrival": D(10).isoformat(), "departure": D(12).isoformat(), "numAdult": 2, "price": 300},
        ]
        with mock.patch.object(beds24, "_pages", return_value=rows):
            counts = beds24.pull_bookings()
        self.assertEqual((counts["new"], counts["skipped"]), (1, 1))

    def test_closed_dates_still_go_out_when_bookings_cant_be_read(self):
        c = make_cottage()
        Cottage.objects.filter(pk=c.pk).update(beds24_property_id=1, beds24_room_id=7)
        with mock.patch.object(beds24, "pull_bookings", side_effect=RuntimeError("down")), \
                mock.patch.object(beds24, "push_closed_dates", return_value=(1, 0)) as push:
            lines = beds24.sync_calendars()
        self.assertTrue(push.called)
        self.assertIn("failed", lines[0])


class StripeTests(TestCase):
    def setUp(self):
        self.c = make_cottage()
        self.inv = Invoice.objects.create(owner=self.c.owner, month=date(2026, 11, 1), number="STG-2026-0007",
                                          lines=[{"kind": "commission", "description": "x", "amount": "10.00"}],
                                          subtotal=Decimal("10.00"), vat=Decimal("2.55"), total=Decimal("12.55"))

    @override_settings(STRIPE_SECRET_KEY="sk_test_x")
    def test_no_answer_from_stripe_is_a_stripe_error(self):
        with mock.patch("urllib.request.urlopen", side_effect=TimeoutError("timed out")):
            with self.assertRaises(stripe_api.StripeError):
                stripe_api._post("/invoices", {})
            with self.assertRaises(stripe_api.StripeError):
                stripe_api.get("/invoices/in_1")

    @override_settings(STRIPE_SECRET_KEY="sk_test_x")
    def test_an_interrupted_send_is_finished_not_charged_again(self):
        posts = []

        def post(path, data=None, idempotency_key=None):
            posts.append(path)
            if path == "/customers":
                return {"id": "cus_1"}
            if path == "/invoices":
                return {"id": "in_1"}
            if path.endswith("/finalize"):
                raise stripe_api.StripeError("no answer")  # Stripe did it, the answer was lost
            return {"id": "x"}

        with mock.patch.object(stripe_api, "_post", side_effect=post), self.assertRaises(stripe_api.StripeError):
            stripe_api.send(self.inv)
        self.inv.refresh_from_db()
        self.assertEqual((self.inv.stripe_invoice_id, self.inv.status), ("in_1", "draft"))
        posts.clear()
        open_invoice = {"id": "in_1", "status": "open", "collection_method": "send_invoice", "hosted_invoice_url": "https://pay/1"}
        with mock.patch.object(stripe_api, "_post", side_effect=post), mock.patch.object(stripe_api, "get", return_value=open_invoice):
            stripe_api.send(self.inv)
        self.assertEqual(posts, [])  # nothing new was made in Stripe
        self.inv.refresh_from_db()
        self.assertEqual((self.inv.status, self.inv.stripe_url), ("sent", "https://pay/1"))


class RequestRaceTests(TestCase):
    def test_a_request_declined_a_moment_ago_cant_also_be_accepted(self):
        c = make_cottage()
        conv = Conversation.objects.create(
            cottage=c, channel="owner", guest_name="Erik Lund", guest_email="erik@example.se", guest_language="sv",
            check_in=D(30), check_out=D(33), guests=2, token="t" * 20, request_status=RequestStatus.PENDING,
        )
        stale = Conversation.objects.get(pk=conv.pk)  # what the other request read before the decline
        booking_requests.decline(conv)
        with self.assertRaises(booking_requests.RequestError):
            booking_requests.accept(stale, Decimal("300.00"))
        self.assertFalse(Booking.objects.filter(cottage=c).exists())


class InvoiceRuleTests(TestCase):
    def test_an_archived_cottage_has_no_yearly_fee(self):
        c = make_cottage(listing_started_on=date(2026, 8, 15), trial_months=3)
        self.assertEqual([x["kind"] for x in invoicing.build(c.owner, date(2026, 11, 1)).lines], ["yearly_fee"])
        Invoice.objects.all().delete()
        Cottage.objects.filter(pk=c.pk).update(status=Cottage.Status.ARCHIVED)
        self.assertIsNone(invoicing.build(Owner.objects.get(pk=c.owner_id), date(2026, 11, 1)))

    def test_invoice_numbers_count_past_9999(self):
        c = make_cottage()
        for n in ("STG-2026-9999", "STG-2026-10000"):
            Invoice.objects.create(owner=c.owner, month=date(2026, int(n[-1]) + 1, 1), number=n, lines=[], subtotal=0, vat=0, total=0)
        self.assertEqual(invoicing._next_number(2026), "STG-2026-10001")

    def test_one_owners_trouble_doesnt_stop_the_others_invoices(self):
        a = make_cottage(listing_started_on=date(2026, 8, 15), trial_months=3)
        b = make_cottage(email="b@example.fi", listing_started_on=date(2026, 8, 15), trial_months=3)
        real = invoicing.build

        def build(owner, month, rates=None):
            if owner.pk == a.owner_id:
                raise RuntimeError("bad data")
            return real(owner, month, rates)

        with mock.patch.object(invoicing, "build", side_effect=build):
            self.assertEqual([i.owner_id for i in invoicing.build_all(date(2026, 11, 1))], [b.owner_id])


class BadInputTests(TestCase):
    def test_dates_far_outside_any_calendar_are_refused_not_an_error_page(self):
        c = make_cottage()
        for a, b in (("0001-01-01", "0001-01-03"), ("9999-12-25", "9999-12-28")):
            res = self.client.get(f"/api/book/{c.booking_link_token}/quote/?check_in={a}&check_out={b}")
            self.assertEqual(res.status_code, 400)
        self.client.force_login(owner_login.user_for(c.owner))
        for when in ("9999-12-01", "0001-01-01"):
            self.assertEqual(self.client.get(f"/api/owner/calendar/?from={when}").status_code, 200)
            self.assertEqual(self.client.get(f"/api/owner/cottages/{c.pk}/prices/?from={when}").status_code, 200)

    def test_a_monitor_reading_with_an_impossible_time_is_dropped(self):
        from . import monitor

        self.assertIsNone(monitor._clean({"at": "2026-13-45T00:00:00"}, timezone.now()))

    def test_the_code_endpoint_says_so_when_mail_is_down(self):
        cache.clear()
        with mock.patch("owners.email_check.send_mail", side_effect=OSError("down")):
            res = self.client.post("/api/signups/email-code/", {"email": "new@example.fi"}, content_type="application/json")
        self.assertEqual((res.status_code, res.json()), (503, {"detail": "email_failed"}))

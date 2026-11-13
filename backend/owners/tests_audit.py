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

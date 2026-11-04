import re
from datetime import date, timedelta
from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import Booking, Cottage, LoginCode, Owner
from .statements import summary


def make_owner(email="owner@example.com", **kw) -> Owner:
    return Owner.objects.create(name="Aino Järvinen", email=email, **kw)


@override_settings(DEV_LOGIN_CODES=False)
class LoginTests(TestCase):
    def setUp(self):
        cache.clear()  # throttle counters
        self.owner = make_owner()

    def request_code(self, email="owner@example.com", lang="fi"):
        return self.client.post("/api/auth/request-code/", {"email": email, "lang": lang}, content_type="application/json")

    def code_from_mail(self) -> str:
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def verify(self, code, email="owner@example.com"):
        return self.client.post("/api/auth/verify-code/", {"email": email, "code": code}, content_type="application/json")

    def test_someone_new_signs_in_with_an_emailed_code_and_gets_an_account(self):
        res = self.request_code("Newcomer@example.com")
        self.assertEqual(res.json(), {"sent": True})
        self.assertEqual(len(mail.outbox), 1)
        code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        self.assertEqual(self.verify("000000" if code != "000000" else "111111", "newcomer@example.com").status_code, 400)
        self.assertFalse(Owner.objects.filter(email__iexact="newcomer@example.com").exists())
        res = self.verify(code, "newcomer@example.com")
        self.assertEqual(res.status_code, 200, res.content)
        account = Owner.objects.get(email__iexact="newcomer@example.com")
        self.assertFalse(account.is_host)
        me = self.client.get("/api/owner/me/").json()
        self.assertEqual((me["email"], me["is_host"]), ("newcomer@example.com", False))
        # Hosting stays closed until they list a cottage.
        self.assertEqual(self.client.get("/api/owner/summary/").status_code, 403)
        self.assertEqual(self.client.get("/api/owner/cottages/").status_code, 403)

    def test_code_is_emailed_in_owner_language_and_email_is_case_insensitive(self):
        self.assertEqual(self.request_code("Owner@Example.com").json(), {"sent": True})
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("kirjautumiskoodisi", mail.outbox[0].subject)
        self.request_code(lang="en")
        self.assertIn("sign-in code", mail.outbox[1].subject)
        self.request_code(lang="sv")
        self.assertIn("inloggningskod", mail.outbox[2].subject)

    def test_correct_code_signs_in_once(self):
        self.request_code()
        code = self.code_from_mail()
        self.assertEqual(self.client.get("/api/owner/me/").status_code, 403)
        self.assertEqual(self.verify(code).status_code, 200)
        me = self.client.get("/api/owner/me/")
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "owner@example.com")
        self.assertIn("csrftoken", me.cookies)
        self.client.logout()
        self.assertEqual(self.verify(code).status_code, 400)  # used already

    def test_wrong_code_and_lockout_after_five_tries(self):
        self.request_code()
        code = self.code_from_mail()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(LoginCode.MAX_ATTEMPTS):
            self.assertEqual(self.verify(wrong).status_code, 400)
        self.assertEqual(self.verify(code).status_code, 400)

    def test_too_many_tries_in_a_day_lock_sign_in(self):
        """Guessing spread over many codes (and many IPs) still stops at TRIES_PER_DAY."""
        from . import login as owner_login

        for _ in range(owner_login.TRIES_PER_DAY // LoginCode.MAX_ATTEMPTS):
            code = owner_login.issue_code(self.owner, "fi")
            wrong = "000000" if code != "000000" else "111111"
            for _ in range(LoginCode.MAX_ATTEMPTS):
                self.assertFalse(owner_login.check_code(self.owner, wrong))
            LoginCode.objects.update(created_at=timezone.now() - timedelta(hours=2))  # past the hourly limit
        self.assertTrue(owner_login.locked(self.owner))
        self.assertFalse(owner_login.can_send(self.owner))
        code = owner_login.issue_code(self.owner, "fi")
        self.assertFalse(owner_login.check_code(self.owner, code))  # even the right code
        # A day later it works again.
        LoginCode.objects.update(created_at=timezone.now() - timedelta(hours=25))
        code = owner_login.issue_code(self.owner, "fi")
        self.assertTrue(owner_login.check_code(self.owner, code))

    def test_expired_code_fails(self):
        self.request_code()
        code = self.code_from_mail()
        LoginCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(self.verify(code).status_code, 400)

    def test_new_code_replaces_old(self):
        self.request_code()
        first = self.code_from_mail()
        self.request_code()
        second = self.code_from_mail()
        if first != second:
            self.assertEqual(self.verify(first).status_code, 400)
        self.assertEqual(self.verify(second).status_code, 200)

    def test_at_most_five_codes_an_hour(self):
        for _ in range(7):
            self.request_code()
        self.assertEqual(len(mail.outbox), 5)

    @override_settings(DEV_LOGIN_CODES=True)
    def test_dev_mode_returns_code(self):
        res = self.request_code()
        self.assertEqual(res.json()["dev_code"], self.code_from_mail())

    def test_logout_needs_csrf_token(self):
        self.request_code()
        self.verify(self.code_from_mail())
        client = self.client_class(enforce_csrf_checks=True)
        client.cookies = self.client.cookies
        token = client.get("/api/owner/me/").cookies["csrftoken"].value
        self.assertEqual(client.post("/api/auth/logout/").status_code, 403)
        self.assertEqual(client.post("/api/auth/logout/", HTTP_X_CSRFTOKEN=token).status_code, 200)
        self.assertEqual(client.get("/api/owner/me/").status_code, 403)

    def test_staff_without_owner_cannot_read_owner_api(self):
        from django.contrib.auth import get_user_model

        staff = get_user_model().objects.create_user("staff", is_staff=True)
        self.client.force_login(staff)
        self.assertEqual(self.client.get("/api/owner/summary/").status_code, 403)


class SummaryTests(TestCase):
    def setUp(self):
        self.owner = make_owner(is_pilot=True)  # 10 %, first listing year free
        self.cottage = Cottage.objects.create(
            owner=self.owner, name="Järvihuvila", max_guests=6, price_per_night=Decimal("150"),
            status=Cottage.Status.LIVE, listing_started_on=date(2026, 3, 1), trial_months=0,
        )
        add = lambda channel, d, nights, payout, **kw: Booking.objects.create(  # noqa: E731
            cottage=self.cottage, channel=channel, check_in=d, check_out=d + timedelta(days=nights),
            owner_payout=Decimal(payout), **kw,
        )
        add("airbnb", date(2026, 7, 1), 4, "600.00")
        add("booking", date(2026, 7, 10), 2, "300.00")
        add("nettimokki", date(2026, 8, 1), 3, "450.00")
        add("vrbo", date(2026, 8, 20), 2, "280.00", cancelled=True)
        add("airbnb", date(2027, 3, 5), 2, "320.00")

    def test_totals_months_and_channels(self):
        s = summary(self.owner, 2026, date(2026, 7, 11))
        t = s["totals"]
        self.assertEqual(t["bookings"], 3)
        self.assertEqual(t["cancelled"], 1)
        self.assertEqual(t["nights"], 9)
        self.assertEqual(t["payout"], "1350.00")
        self.assertEqual(t["payout_stugora"], "900.00")
        self.assertEqual(t["payout_own"], "450.00")
        self.assertEqual(t["commission"], "90.00")  # 10 % of 900; Nettimökki free
        self.assertEqual(t["commission_vat"], "22.95")
        self.assertEqual(t["fees"], "0.00")  # pilot's first listing year
        self.assertEqual(t["net"], "1237.05")
        july = s["months"][6]
        self.assertEqual((july["stugora"], july["own"], july["nights"]), ("900.00", "0.00", 6))
        self.assertEqual(s["months"][7]["own"], "450.00")
        self.assertEqual([c["channel"] for c in s["channels"]], ["airbnb", "nettimokki", "booking"])
        self.assertTrue(s["upcoming"][0]["staying_now"])  # 10-12 July stay on 11 July

    def test_second_listing_year_fee_counts_in_its_year(self):
        s = summary(self.owner, 2027, date(2027, 3, 1))
        self.assertEqual(s["fees"][0]["fee"], "99.00")
        self.assertEqual(s["fees"][0]["starts_on"], "2027-03-01")
        self.assertEqual(s["totals"]["fees_vat"], "25.25")
        self.assertEqual(s["totals"]["commission"], "32.00")
        # 320 - (32 + 8.16) - (99 + 25.25)
        self.assertEqual(s["totals"]["net"], "155.59")

    def test_owner_only_sees_own_bookings(self):
        other = make_owner("other@example.com")
        c = Cottage.objects.create(owner=other, name="Other", max_guests=2, price_per_night=Decimal("90"))
        Booking.objects.create(cottage=c, channel="airbnb", check_in=date(2026, 7, 2),
                               check_out=date(2026, 7, 4), owner_payout=Decimal("999.00"))
        self.client.force_login(self._user_for(self.owner))
        rows = self.client.get("/api/owner/bookings/?year=2026").json()["results"]
        self.assertEqual(len(rows), 4)
        self.assertNotIn("Other", {r["cottage"] for r in rows})
        res = self.client.get("/api/owner/summary/?year=2026").json()
        self.assertEqual(res["totals"]["payout"], "1350.00")

    def test_bad_year_falls_back_to_this_year(self):
        self.client.force_login(self._user_for(self.owner))
        res = self.client.get("/api/owner/summary/?year=abc")
        self.assertEqual(res.json()["year"], timezone.localdate().year)

    @staticmethod
    def _user_for(owner):
        from .login import user_for

        return user_for(owner)

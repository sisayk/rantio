from django.core.cache import cache
from django.test import TestCase, override_settings

from . import login as owner_login
from .models import Cottage, Owner
from .tests_calendar import make_cottage


@override_settings(DEV_LOGIN_CODES=False, SIGNUP_NOTIFY_EMAILS=["team@rantio.fi"])
class DeleteAccountTests(TestCase):
    def test_someone_without_cottages_is_removed(self):
        o = owner_login.new_account("new@example.com")
        self.client.force_login(owner_login.user_for(o))
        res = self.client.delete("/api/owner/me/")
        self.assertEqual(res.json(), {"deleted": "deleted"})
        self.assertFalse(Owner.objects.filter(pk=o.pk).exists())
        self.assertEqual(self.client.get("/api/owner/me/").status_code, 403)

    def test_a_hosts_records_stay_but_the_account_is_closed(self):
        c = make_cottage()
        o = c.owner
        self.client.force_login(owner_login.user_for(o))
        self.assertEqual(self.client.delete("/api/owner/me/").json(), {"deleted": "closed"})
        o.refresh_from_db()
        c.refresh_from_db()
        self.assertEqual((o.name, o.phone, o.user_id, o.is_host), ("Deleted account", "", None, False))
        self.assertTrue(o.email.endswith("@deleted.invalid"))
        self.assertEqual(c.status, Cottage.Status.ARCHIVED)
        self.assertIsNone(owner_login.find_owner("aino@example.fi"))


@override_settings(DEV_LOGIN_CODES=False, APP_REVIEW_EMAIL="review@rantio.fi", APP_REVIEW_CODE="246810")
class AppReviewTests(TestCase):
    def setUp(self):
        cache.clear()

    def verify(self, code):
        return self.client.post("/api/auth/verify-code/", {"email": "review@rantio.fi", "code": code, "app": True},
                                content_type="application/json")

    def test_the_reviewer_signs_in_with_the_fixed_code_as_a_host(self):
        self.assertEqual(self.client.post("/api/auth/request-code/", {"email": "review@rantio.fi"}, content_type="application/json").json(), {"sent": True})
        res = self.verify("246810")
        self.assertEqual(res.status_code, 200, res.content)
        o = Owner.objects.get(email="review@rantio.fi")
        self.assertTrue(o.is_host)
        self.assertEqual(o.cottages.count(), 1)

    def test_wrong_codes_stop_after_twenty(self):
        for _ in range(20):
            self.assertEqual(self.verify("000000").status_code, 400)
        self.assertEqual(self.verify("246810").status_code, 400)

import shutil
import tempfile
from unittest import mock

from django.test import TestCase, override_settings

from . import login as owner_login
from . import stripe_api
from .tests_calendar import make_cottage
from .tests_trial import FakeStripe, png

MEDIA = tempfile.mkdtemp()


class ProfileStripe(FakeStripe):
    def get(self, path, params=None):
        if path.startswith("/payment_methods/"):
            return {"type": "card", "card": {"brand": "visa", "last4": "4242", "exp_month": 12, "exp_year": 2030}}
        return super().get(path, params)


@override_settings(MEDIA_ROOT=MEDIA, STRIPE_SECRET_KEY="sk_test_x", DEV_LOGIN_CODES=False)
class ProfileTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        self.c = make_cottage()
        self.o = self.c.owner
        self.client.force_login(owner_login.user_for(self.o))

    def test_name_phone_and_photo(self):
        res = self.client.patch("/api/owner/me/", {"name": "Aino J.", "phone": "040 123 4567"}, content_type="application/json")
        self.assertEqual((res.json()["name"], res.json()["phone"]), ("Aino J.", "040 123 4567"))
        self.assertEqual(self.client.patch("/api/owner/me/", {"phone": "abc"}, content_type="application/json").json(), {"phone": ["invalid"]})
        self.assertEqual(self.client.patch("/api/owner/me/", {"name": " "}, content_type="application/json").status_code, 400)
        up = self.client.post("/api/owner/me/photo/", {"file": png()})
        self.assertEqual(up.status_code, 201, up.content)
        self.assertTrue(self.client.get("/api/owner/me/").json()["photo"].endswith(".png"))
        self.assertIsNone(self.client.delete("/api/owner/me/photo/").json()["photo"])

    def test_not_an_image_is_refused(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        res = self.client.post("/api/owner/me/photo/", {"file": SimpleUploadedFile("x.png", b"<svg></svg>", "image/png")})
        self.assertEqual(res.json(), {"file": ["not_image"]})

    def test_a_new_payment_method_is_saved_on_stripes_page(self):
        fake = ProfileStripe()
        with mock.patch.object(stripe_api, "post", fake.post), mock.patch.object(stripe_api, "get", fake.get):
            self.assertEqual(self.client.get("/api/owner/payment-method/").json(), {"available": True, "method": None})
            res = self.client.post("/api/owner/payment-method/", {"app": True}, content_type="application/json")
            self.assertEqual(res.json()["url"], "https://checkout.stripe.com/c/pay/cs_1")
            session = dict(fake.posts)["/checkout/sessions"]
            self.assertEqual(session["mode"], "setup")
            self.assertIn("/hosting/payment-saved?app=1", session["success_url"])
            method = self.client.get("/api/owner/payment-method/").json()["method"]
        self.assertEqual((method["brand"], method["last4"]), ("visa", "4242"))
        self.o.refresh_from_db()
        self.assertEqual((self.o.stripe_payment_method, self.o.stripe_checkout_id), ("pm_card", ""))

    @override_settings(STRIPE_SECRET_KEY="")
    def test_without_stripe_there_is_nothing_to_change(self):
        self.assertEqual(self.client.get("/api/owner/payment-method/").json(), {"available": False, "method": None})


@override_settings(MEDIA_ROOT=MEDIA, STRIPE_SECRET_KEY="", DEV_LOGIN_CODES=False)
class DetailsTests(TestCase):
    def setUp(self):
        self.o = make_cottage().owner
        self.client.force_login(owner_login.user_for(self.o))

    def patch(self, **details):
        return self.client.patch("/api/owner/me/", {"details": details}, content_type="application/json")

    def test_a_company_with_its_address_and_bank_account(self):
        res = self.patch(account_type="company", company_name="Elda-Auto Tmi", business_id="2312334-5", vat_id="fi 23123344",
                         address_line="Mökkitie 1", postal_code="57100", city="Savonlinna", address_country="fi",
                         payout_holder="Elda-Auto Tmi", payout_iban="FI21 1234 5600 0007 85")
        self.assertEqual(res.status_code, 200, res.content)
        d = res.json()["details"]
        self.assertEqual((d["account_type"], d["vat_id"], d["address_country"]), ("company", "FI23123344", "FI"))
        self.assertEqual(d["payout_iban"], "FI•• •••• 0785")  # only the end goes back
        self.o.refresh_from_db()
        self.assertEqual(self.o.payout_iban, "FI2112345600000785")
        # Sending the masked number back keeps the stored one.
        self.assertEqual(self.patch(payout_iban=d["payout_iban"]).status_code, 200)
        self.o.refresh_from_db()
        self.assertEqual(self.o.payout_iban, "FI2112345600000785")

    def test_wrong_numbers_are_refused(self):
        self.assertEqual(self.patch(payout_iban="FI21 1234 5600 0007 86").json(), {"details": {"payout_iban": ["invalid"]}})
        self.assertEqual(self.patch(business_id="2312334-4").json(), {"details": {"business_id": ["invalid"]}})
        self.assertEqual(self.patch(account_type="robot").json(), {"details": {"account_type": ["invalid"]}})


@override_settings(MEDIA_ROOT=MEDIA, STRIPE_SECRET_KEY="", DEV_LOGIN_CODES=False)
class HostRequirementTests(TestCase):
    def setUp(self):
        self.o = make_cottage().owner
        self.client.force_login(owner_login.user_for(self.o))

    def patch(self, **details):
        return self.client.patch("/api/owner/me/", {"details": details}, content_type="application/json")

    def test_what_the_booking_sites_need_from_a_private_host(self):
        missing = self.client.get("/api/owner/me/").json()["details"]["missing"]
        self.assertEqual(missing, ["legal_name", "date_of_birth", "tax_id", "address", "phone", "payout", "emergency"])
        res = self.patch(legal_first_name="Aino", legal_last_name="Järvinen", date_of_birth="13.10.1952", tax_country="FI",
                         tax_id="131052-308T", address_line="Mökkitie 1", postal_code="57100", city="Savonlinna",
                         address_country="FI", payout_iban="FI2112345600000785", emergency_name="Pekka", emergency_phone="0401234567")
        self.assertEqual(res.status_code, 200, res.content)
        d = res.json()["details"]
        self.assertEqual(d["tax_id"], "•••••308T")
        self.assertEqual(d["missing"], ["phone"])
        self.o.refresh_from_db()
        self.assertNotIn("131052", self.o.tax_id_sealed)  # stored encrypted
        from . import vault
        self.assertEqual(vault.unseal(self.o.tax_id_sealed), "131052-308T")

    def test_a_company_needs_its_owners_and_representative(self):
        res = self.patch(account_type="company", company_name="Elda-Auto Tmi", business_type="tmi", business_id="2312334-5",
                         legal_rep_name="Sisay Kelka", legal_rep_role="Owner",
                         beneficial_owners=[{"name": "Sisay Kelka", "date_of_birth": "1980-01-01", "country": "fi", "share": 100}])
        d = res.json()["details"]
        self.assertEqual(d["beneficial_owners"][0]["country"], "FI")
        self.assertNotIn("beneficial_owners", d["missing"])
        self.assertNotIn("date_of_birth", d["missing"])

    def test_wrong_details_are_refused(self):
        self.assertEqual(self.patch(tax_country="FI", tax_id="131052-308A").json()["details"], {"tax_id": ["invalid"]})
        self.assertEqual(self.patch(date_of_birth="2015-01-01").json()["details"], {"date_of_birth": ["invalid"]})
        self.assertEqual(self.patch(beneficial_owners=[{"name": "X", "share": 150}]).json()["details"], {"beneficial_owners": ["invalid"]})

    def test_dates_are_written_day_first_and_come_from_the_identity_code(self):
        self.assertEqual(self.patch(date_of_birth="02-07-1983").json()["details"]["date_of_birth"], "1983-07-02")
        self.assertEqual(self.patch(date_of_birth="2.7.1983").json()["details"]["date_of_birth"], "1983-07-02")
        self.assertEqual(self.patch(date_of_birth="31-02-1983").json()["details"], {"date_of_birth": ["invalid"]})
        self.patch(date_of_birth="")
        d = self.patch(tax_country="FI", tax_id="131052-308T").json()["details"]
        self.assertEqual(d["date_of_birth"], "1952-10-13")
        self.assertEqual(self.patch(date_of_birth="01-01-1960", tax_id="131052-308T").json()["details"], {"date_of_birth": ["mismatch"]})

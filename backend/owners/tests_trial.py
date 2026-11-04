import shutil
import tempfile
from datetime import date
from unittest import mock

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import invoicing, stripe_api, trial
from .models import Cottage, Owner, OwnerSignup
from .tests import VALID

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
MEDIA = tempfile.mkdtemp()


def png(name="mokki.png"):
    return SimpleUploadedFile(name, PNG, "image/png")


class FakeStripe:
    """Records what Rantio asks Stripe for and answers like Stripe would."""

    def __init__(self, complete=True):
        self.posts, self.complete = [], complete

    def post(self, path, data=None, idempotency_key=None):
        self.posts.append((path, data or {}))
        if path == "/customers":
            return {"id": "cus_signup"}
        if path == "/checkout/sessions":
            return {"id": "cs_1", "url": "https://checkout.stripe.com/c/pay/cs_1"}
        if path.endswith("/finalize"):
            return {"id": "in_1", "status": "open", "hosted_invoice_url": "https://invoice.stripe.com/i/1"}
        if path.endswith("/pay"):
            return {"id": "in_1", "status": "paid", "hosted_invoice_url": "https://invoice.stripe.com/i/1"}
        return {"id": "in_1"}

    def get(self, path, params=None):
        return {"status": "complete" if self.complete else "open", "setup_intent": {"payment_method": "pm_card"}}


@override_settings(MEDIA_ROOT=MEDIA, STRIPE_SECRET_KEY="sk_test_x", SIGNUP_NOTIFY_EMAILS=[], SIGNUP_EMAIL_CHECK=False)
class TrialSignupTests(TestCase):
    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        shutil.rmtree(MEDIA, ignore_errors=True)

    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.stripe = FakeStripe()
        for name, fake in (("post", self.stripe.post), ("_post", self.stripe.post), ("get", self.stripe.get)):
            patcher = mock.patch.object(stripe_api, name, fake)
            patcher.start()
            self.addCleanup(patcher.stop)

    def sign_up(self, **extra):
        data = {**VALID, "privacy_consent": "true", "photos": [png("a.png"), png("b.png")], **extra}
        return self.client.post("/api/signups/", data, format="multipart")

    def test_photos_are_kept_and_the_answer_has_the_card_page(self):
        res = self.sign_up(app="1")
        self.assertEqual(res.status_code, 201, res.content)
        signup = OwnerSignup.objects.get()
        self.assertEqual(signup.photos.count(), 2)
        self.assertEqual(res.json()["checkout_url"], "https://checkout.stripe.com/c/pay/cs_1")
        session = dict(self.stripe.posts)["/checkout/sessions"]
        self.assertEqual((session["mode"], session["currency"], session["locale"]), ("setup", "eur", "fi"))
        self.assertIn("3 kuukautta maksutta", session["custom_text"]["submit"]["message"])
        self.assertIn("99 €", session["custom_text"]["submit"]["message"])
        self.assertIn(f"/fi/hosts/welcome?signup={signup.token}&app=1", session["success_url"])

    def test_swedish_owner_sees_the_fee_in_kronor(self):
        self.sign_up(country="SE", region="dalarna", nettimokki_url="", language="sv")
        session = dict(self.stripe.posts)["/checkout/sessions"]
        self.assertEqual(session["currency"], "sek")
        self.assertIn("1 080 kr", session["custom_text"]["submit"]["message"])

    def test_not_a_photo_is_refused(self):
        res = self.sign_up(photos=[SimpleUploadedFile("x.png", b"hello there, not a picture", "image/png")])
        self.assertEqual((res.status_code, res.json()), (400, {"photos": ["not_image"]}))
        self.assertFalse(OwnerSignup.objects.exists())

    def test_card_saved_on_return_and_used_for_invoices(self):
        self.sign_up()
        signup = OwnerSignup.objects.get()
        res = self.client.get(f"/api/signups/{signup.token}/card/")
        self.assertEqual(res.json()["card_saved"], True)
        signup.refresh_from_db()
        self.assertEqual(signup.stripe_payment_method, "pm_card")
        self.assertIn(("/customers/cus_signup", {"invoice_settings": {"default_payment_method": "pm_card"}}), self.stripe.posts)

        # The owner is made from the sign-up; their first yearly fee comes after the free months.
        owner = Owner.objects.create(name=signup.name, email=signup.email, signup=signup)
        Cottage.objects.create(owner=owner, name="Rantamökki", max_guests=4, price_per_night=120,
                               listing_started_on=date(2026, 11, 10))
        self.assertIsNone(invoicing.build(owner, date(2026, 11, 1)))
        invoice = invoicing.build(owner, date(2027, 2, 1))
        self.assertEqual([x["kind"] for x in invoice.lines], ["yearly_fee"])
        stripe_api.send(invoice)
        made = dict(self.stripe.posts)["/invoices"]
        self.assertEqual((made["collection_method"], made["default_payment_method"], made["customer"]),
                         ("charge_automatically", "pm_card", "cus_signup"))
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "paid")

    def test_card_page_left_without_saving(self):
        self.stripe.complete = False
        self.sign_up()
        token = OwnerSignup.objects.get().token
        self.assertEqual(self.client.get(f"/api/signups/{token}/card/").json()["card_saved"], False)
        again = self.client.post(f"/api/signups/{token}/card/", {}, format="json")
        self.assertEqual(again.json()["checkout_url"], "https://checkout.stripe.com/c/pay/cs_1")
        self.assertEqual(self.client.get("/api/signups/nope/card/").status_code, 404)

    @override_settings(STRIPE_SECRET_KEY="")
    def test_without_stripe_the_form_just_says_thanks(self):
        res = self.sign_up()
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(res.json()["checkout_url"])
        self.assertFalse(trial.enabled())

    def test_where_the_cottage_is_listed_now(self):
        self.sign_up(listed_on="airbnb,nettimokki,airbnb")
        self.assertEqual(OwnerSignup.objects.get().listed_on_display, "Airbnb, Nettimökki")
        OwnerSignup.objects.all().delete()
        self.sign_up(listed_on="booking,none")
        self.assertEqual(OwnerSignup.objects.get().listed_on, "none")
        self.assertEqual(self.sign_up(listed_on="tripadvisor").status_code, 400)


@override_settings(MEDIA_ROOT=MEDIA, STRIPE_SECRET_KEY="", SIGNUP_NOTIFY_EMAILS=[], SIGNUP_EMAIL_CHECK=True)
class EmailCheckTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()

    def code_for(self, email="Matti@Example.fi"):
        from django.core import mail

        res = self.client.post("/api/signups/email-code/", {"email": email, "name": "Matti Virtanen", "lang": "fi"},
                               format="json")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertIn("Rantio-koodisi", mail.outbox[-1].subject)
        return mail.outbox[-1].subject.rsplit(" ", 1)[-1]

    def sign_up(self, **extra):
        data = {**VALID, "privacy_consent": "true", "photos": [png("a.png")], **extra}
        return self.client.post("/api/signups/", data, format="multipart")

    def test_needs_the_right_code(self):
        self.code_for()
        self.assertEqual(self.sign_up(email_code="000000").json(), {"email_code": ["wrong"]})
        self.assertEqual(self.sign_up().status_code, 400)
        self.assertFalse(OwnerSignup.objects.exists())

    def test_checked_sign_up_is_an_owner_signed_in_with_the_cottage(self):
        res = self.sign_up(email_code=self.code_for())
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.json()["signed_in"])
        owner = Owner.objects.get()
        self.assertEqual((owner.email, owner.phone, owner.signup), ("matti@example.fi", "+358401234567", OwnerSignup.objects.get()))
        cottage = owner.cottages.get()
        self.assertEqual((cottage.name, cottage.status, cottage.photos.count()), ("Savonlinna", "intake", 1))
        self.assertEqual(self.client.get("/api/owner/me/").status_code, 200)
        # The code works once.
        self.client.logout()
        self.assertEqual(self.sign_up(email_code="x").status_code, 400)

    def test_the_app_gets_a_key(self):
        res = self.sign_up(email_code=self.code_for(), app="1", platform="ios", device="iPhone")
        key = res.json()["app_key"]
        self.assertTrue(key.startswith("stg_"))
        me = APIClient().get("/api/owner/me/", HTTP_AUTHORIZATION=f"Bearer {key}")
        self.assertEqual(me.status_code, 200)

    def test_a_signed_in_account_lists_without_a_code_and_becomes_a_host(self):
        from . import login as owner_login

        account = owner_login.new_account("matti@example.fi", lang="fi")
        self.client.force_login(owner_login.user_for(account))
        self.assertEqual(self.client.get("/api/owner/summary/").status_code, 403)
        res = self.sign_up(email="someone.else@example.fi")  # the account's own address is used
        self.assertEqual(res.status_code, 201, res.content)
        self.assertTrue(res.json()["signed_in"])
        account.refresh_from_db()
        self.assertTrue(account.is_host)
        self.assertEqual(account.name, "Matti Virtanen")
        self.assertEqual(OwnerSignup.objects.get().email, "matti@example.fi")
        self.assertEqual(account.cottages.count(), 1)
        self.assertEqual(self.client.get("/api/owner/summary/").status_code, 200)

    def test_a_session_without_its_csrf_token_counts_as_signed_out(self):
        from . import login as owner_login

        account = owner_login.new_account("matti@example.fi", lang="fi")
        self.client = APIClient(enforce_csrf_checks=True)
        self.client.force_login(owner_login.user_for(account))
        res = self.sign_up(email="matti@example.fi")
        self.assertEqual(res.status_code, 400)  # not refused as forbidden: asked for the email code
        self.assertEqual(res.json(), {"email_code": ["wrong"]})
        res = self.sign_up(email="matti@example.fi", email_code=self.code_for("matti@example.fi"))
        self.assertEqual(res.status_code, 201, res.content)
        account.refresh_from_db()
        self.assertTrue(account.is_host)

    def test_codes_are_limited(self):
        for _ in range(5):
            self.code_for()
        res = self.client.post("/api/signups/email-code/", {"email": "matti@example.fi"}, format="json")
        self.assertEqual(res.status_code, 429)

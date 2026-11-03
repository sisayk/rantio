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


@override_settings(MEDIA_ROOT=MEDIA, STRIPE_SECRET_KEY="sk_test_x", SIGNUP_NOTIFY_EMAILS=[])
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

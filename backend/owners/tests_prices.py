from datetime import date
from decimal import Decimal

from django.test import TestCase
from rest_framework.test import APIClient

from . import trial
from .models import Cottage, Owner, Pricing


class PricingTests(TestCase):
    def set_prices(self, **values):
        p = Pricing.current()
        for k, v in values.items():
            setattr(p, k, v)
        p.save()

    def test_starts_with_the_plan_prices(self):
        body = APIClient().get("/api/pricing/").json()
        self.assertEqual(body["commission_rate"], 12)
        self.assertEqual(body["trial_months"], 3)
        self.assertEqual(body["yearly_fees"], {"EUR": 99, "SEK": 1080, "NOK": 1030, "DKK": 740, "ISK": 13500})
        self.assertEqual(body["platform_fee"], 15)

    def test_the_api_shows_what_the_admin_set(self):
        self.set_prices(commission_rate=Decimal("10.50"), trial_months=6, yearly_fee_eur=Decimal("79.00"))
        res = APIClient().get("/api/pricing/")
        self.assertEqual(res["Cache-Control"], "public, max-age=60")
        body = res.json()
        self.assertEqual((body["commission_rate"], body["trial_months"], body["yearly_fees"]["EUR"]), (10.5, 6, 79))

    def test_new_owners_and_cottages_get_the_current_prices_and_old_ones_keep_theirs(self):
        old = Owner.objects.create(name="Old", email="old@example.com")
        old_cottage = Cottage.objects.create(owner=old, name="Old", max_guests=2, price_per_night=0)
        self.set_prices(commission_rate=Decimal("8.00"), trial_months=12)
        new = Owner.objects.create(name="New", email="new@example.com")
        new_cottage = Cottage.objects.create(owner=new, name="New", max_guests=2, price_per_night=0)
        old.refresh_from_db()
        old_cottage.refresh_from_db()
        self.assertEqual((old.commission_rate, old_cottage.trial_months), (Decimal("12.00"), 3))
        self.assertEqual((new.commission_rate, new_cottage.trial_months), (Decimal("8.00"), 12))

    def test_the_yearly_fee_is_the_current_one_in_the_cottages_currency(self):
        owner = Owner.objects.create(name="O", email="o@example.com")
        fi = Cottage.objects.create(owner=owner, name="F", max_guests=2, price_per_night=0, country="FI",
                                    listing_started_on=date(2026, 1, 1))
        se = Cottage.objects.create(owner=owner, name="S", max_guests=2, price_per_night=0, country="SE",
                                    listing_started_on=date(2026, 1, 1))
        self.set_prices(yearly_fee_eur=Decimal("120.00"), yearly_fee_sek=Decimal("1300.00"))
        self.assertEqual((fi.yearly_fee(1), se.yearly_fee(1)), (Decimal("120.00"), Decimal("1300.00")))

    def test_stripe_terms_use_the_current_prices_and_grammar(self):
        self.set_prices(commission_rate=Decimal("10.50"), trial_months=1, yearly_fee_eur=Decimal("79.00"))
        en, fi = trial.terms("en", "EUR"), trial.terms("fi", "EUR")
        self.assertTrue(en.startswith("1 month free."))
        self.assertIn("10.5% + VAT", en)
        self.assertIn("€79 + VAT", en)
        self.assertTrue(fi.startswith("1 kuukausi maksutta."))
        self.assertIn("10,5 % + ALV", fi)
        self.set_prices(trial_months=3)
        self.assertTrue(trial.terms("lt", "EUR").startswith("3 mėnesiai nemokamai."))
        for lang in trial.TERMS:
            self.assertLessEqual(len(trial.terms(lang, "ISK")), 1200)


class PricingAdminTests(TestCase):
    def test_the_prices_page_opens_and_saves(self):
        from django.contrib.auth.models import User

        admin = User.objects.create_superuser("a", "a@example.com", "x")
        self.client.force_login(admin)
        res = self.client.get("/admin/owners/pricing/")
        self.assertRedirects(res, "/admin/owners/pricing/1/change/")
        self.assertContains(self.client.get("/admin/owners/pricing/1/change/"), "Free months")
        data = {"commission_rate": "11", "trial_months": "2", "yearly_fee_eur": "89", "yearly_fee_sek": "980",
                "yearly_fee_nok": "950", "yearly_fee_dkk": "670", "yearly_fee_isk": "12000", "platform_fee": "15"}
        self.client.post("/admin/owners/pricing/1/change/", data)
        p = Pricing.current()
        self.assertEqual((p.commission_rate, p.trial_months, p.yearly_fee_eur), (Decimal("11.00"), 2, Decimal("89.00")))

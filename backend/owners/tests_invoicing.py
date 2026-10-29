from datetime import date
from decimal import Decimal
from unittest import mock

from django.test import TestCase, override_settings

from . import alerts, invoicing, stripe_api
from .models import Booking, Cottage, Invoice, Owner

NOV = date(2026, 11, 1)
RATES = ({"EUR": Decimal("1"), "SEK": Decimal("11.00")}, "2026-11-30")


class InvoiceTests(TestCase):
    def setUp(self):
        self.owner = Owner.objects.create(name="Maija", email="maija@example.fi")
        self.cottage = Cottage.objects.create(owner=self.owner, name="Järvimökki", max_guests=6, price_per_night=150,
                                              listing_started_on=date(2026, 11, 15))
        with alerts.muted():
            for channel, ci, payout in [
                ("booking", date(2026, 11, 3), "500.00"),   # charged: 60.00
                ("airbnb", date(2026, 11, 10), "400.00"),   # Airbnb pays as co-host
                ("nettimokki", date(2026, 11, 20), "900.00"),  # never charged
                ("vrbo", date(2026, 12, 2), "300.00"),      # next month
            ]:
                Booking.objects.create(cottage=self.cottage, channel=channel, check_in=ci,
                                       check_out=date(ci.year, ci.month, ci.day + 3), owner_payout=Decimal(payout))

    def test_builds_commission_and_yearly_fee_with_vat(self):
        inv = invoicing.build(self.owner, NOV, RATES)
        self.assertEqual([x["kind"] for x in inv.lines], ["commission", "yearly_fee"])
        self.assertEqual(inv.subtotal, Decimal("159.00"))  # 60 + 99
        self.assertEqual(inv.vat, Decimal("40.55"))
        self.assertEqual(inv.total, Decimal("199.55"))
        self.assertEqual(inv.number, "STG-2026-0001")
        self.assertIn("12 % commission", inv.lines[0]["description"])

    def test_airbnb_included_without_cohost_payout_and_rebuild_keeps_number(self):
        first = invoicing.build(self.owner, NOV, RATES)
        self.owner.airbnb_cohost_payout = False
        self.owner.save()
        again = invoicing.build(self.owner, NOV, RATES)
        self.assertEqual((again.pk, again.number, len(again.lines)), (first.pk, first.number, 3))

    def test_swedish_stay_is_converted_to_euros(self):
        se = Cottage.objects.create(owner=self.owner, name="Stuga", country="SE", max_guests=4, price_per_night=1500)
        with alerts.muted():
            Booking.objects.create(cottage=se, channel="booking", check_in=date(2026, 11, 5), check_out=date(2026, 11, 8),
                                   owner_payout=Decimal("5500.00"))  # 660 SEK commission = 60 €
        line = invoicing.build(self.owner, NOV, RATES).lines[1]
        self.assertEqual((line["amount"], line["original"]), ("60.00", "660.00 SEK"))

    def test_nothing_due_makes_no_invoice(self):
        self.assertIsNone(invoicing.build(self.owner, date(2027, 1, 1), RATES))

    def test_sent_invoice_is_not_rebuilt(self):
        inv = invoicing.build(self.owner, NOV, RATES)
        Invoice.objects.filter(pk=inv.pk).update(status=Invoice.Status.SENT)
        self.owner.airbnb_cohost_payout = False
        self.owner.save()
        self.assertEqual(len(invoicing.build(self.owner, NOV, RATES).lines), 2)

    @override_settings(STRIPE_SECRET_KEY="sk_test_x", STRIPE_TAX_RATE_ID="")
    def test_send_through_stripe(self):
        inv = invoicing.build(self.owner, NOV, RATES)
        calls = []

        def fake(path, data=None, idempotency_key=None):
            calls.append((path, data))
            if path == "/customers":
                return {"id": "cus_1"}
            if path == "/invoices":
                return {"id": "in_1"}
            return {"id": "x", "hosted_invoice_url": "https://invoice.stripe.com/i/1"}

        with mock.patch.object(stripe_api, "_post", side_effect=fake):
            stripe_api.send(inv)
        paths = [p for p, _ in calls]
        self.assertEqual(paths, ["/customers", "/invoices", "/invoiceitems", "/invoiceitems", "/invoiceitems",
                                 "/invoices/in_1/finalize", "/invoices/in_1/send"])
        self.assertEqual(calls[-3][1]["amount"], 4055)  # VAT line in cents
        inv.refresh_from_db()
        self.assertEqual((inv.status, inv.stripe_url), ("sent", "https://invoice.stripe.com/i/1"))
        self.assertEqual(Owner.objects.get().stripe_customer_id, "cus_1")

    def test_flatten_for_stripe_forms(self):
        self.assertEqual(stripe_api._flatten({"a": {"b": 1}, "t": ["x"], "n": None, "f": False}),
                         [("a[b]", "1"), ("t[0]", "x"), ("f", "false")])

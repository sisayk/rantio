from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from . import rates
from .models import Booking, Cottage, ExchangeRate, Owner
from .statements import summary

ECB_XML = b"""<?xml version="1.0" encoding="UTF-8"?>
<gesmes:Envelope xmlns:gesmes="http://www.gesmes.org/xml/2002-08-01" xmlns="http://www.ecb.int/vocabulary/2002-08-01/eurofxref">
  <Cube><Cube time="2026-10-28">
    <Cube currency="USD" rate="1.08"/><Cube currency="SEK" rate="11.0560"/><Cube currency="NOK" rate="10.3475"/>
    <Cube currency="DKK" rate="7.4741"/><Cube currency="ISK" rate="135.80"/>
  </Cube></Cube>
</gesmes:Envelope>"""


def ecb_response(body=ECB_XML):
    res = mock.MagicMock()
    res.read.return_value = body
    res.__enter__.return_value = res
    return res


class RatesTests(TestCase):
    def setUp(self):
        cache.clear()

    @mock.patch("owners.rates.urllib.request.urlopen")
    def test_fetches_and_stores_the_ecb_rates(self, urlopen):
        urlopen.return_value = ecb_response()
        res = APIClient().get("/api/rates/")
        self.assertEqual(res.status_code, 200)
        body = res.json()
        self.assertEqual(body["date"], "2026-10-28")
        self.assertEqual(body["rates"]["SEK"], 11.056)
        self.assertEqual(body["rates"]["EUR"], 1)
        self.assertNotIn("USD", body["rates"])
        self.assertEqual(ExchangeRate.objects.count(), 4)

    @mock.patch("owners.rates.urllib.request.urlopen")
    def test_fresh_rates_are_not_fetched_again(self, urlopen):
        ExchangeRate.objects.create(currency="SEK", per_eur=Decimal("11.5"), rate_date=date(2026, 10, 27), fetched_at=timezone.now())
        per_eur, day = rates.current()
        urlopen.assert_not_called()
        self.assertEqual(per_eur["SEK"], Decimal("11.5"))
        self.assertEqual(day, "2026-10-27")

    @mock.patch("owners.rates.urllib.request.urlopen", side_effect=OSError("offline"))
    def test_offline_keeps_old_rates_and_waits_before_trying_again(self, urlopen):
        old = timezone.now() - timedelta(days=3)
        ExchangeRate.objects.create(currency="SEK", per_eur=Decimal("11.5"), rate_date=date(2026, 10, 24), fetched_at=old)
        per_eur, _ = rates.current()
        self.assertEqual(per_eur["SEK"], Decimal("11.5"))
        self.assertEqual(per_eur["NOK"], rates.FALLBACK["NOK"])
        rates.current()
        self.assertEqual(urlopen.call_count, 1)

    def test_convert(self):
        r = {"EUR": Decimal("1"), "SEK": Decimal("11"), "NOK": Decimal("10")}
        self.assertEqual(rates.convert(Decimal("99"), "EUR", "SEK", r), Decimal("1089.00"))
        self.assertEqual(rates.convert(Decimal("1100"), "SEK", "NOK", r), Decimal("1000.00"))


class SwedishOwnerTests(TestCase):
    """A Swedish owner sees kronor, Rantio's yearly fee included (a set 1 080 kr)."""

    def setUp(self):
        cache.clear()
        ExchangeRate.objects.create(currency="SEK", per_eur=Decimal("11"), rate_date=date(2026, 10, 28), fetched_at=timezone.now())
        self.owner = Owner.objects.create(name="Erik Lund", email="erik@example.se", language="sv")
        self.cottage = Cottage.objects.create(
            owner=self.owner, name="Röda stugan", country="SE", max_guests=4,
            price_per_night=Decimal("1450"), status=Cottage.Status.LIVE, listing_started_on=date(2026, 3, 1), trial_months=0,
        )
        Booking.objects.create(cottage=self.cottage, channel=Booking.Channel.AIRBNB, check_in=date(2026, 7, 1),
                               check_out=date(2026, 7, 5), owner_payout=Decimal("5000.00"))

    def test_summary_in_kronor(self):
        s = summary(self.owner, 2026, date(2026, 7, 10))
        self.assertEqual(s["currency"], "SEK")
        self.assertEqual(s["totals"]["payout"], "5000.00")
        self.assertEqual(s["totals"]["commission"], "600.00")  # 12 % of the payout, in kronor
        self.assertEqual(s["totals"]["fees"], "1080.00")  # the Swedish yearly fee, not €99 converted
        self.assertEqual((s["fees"][0]["fee"], s["fees"][0]["currency"]), ("1080.00", "SEK"))
        self.assertEqual(s["cottages"][0]["next_fee"], "1080.00")
        self.assertEqual(s["cottages"][0]["currency"], "SEK")
        self.assertEqual(s["upcoming"], [])
        self.assertEqual(s["rate"], {"per_eur": "11.0000", "date": "2026-10-28"})

    def test_finnish_owner_needs_no_rates(self):
        finn = Owner.objects.create(name="Aino", email="aino@example.fi")
        Cottage.objects.create(owner=finn, name="Mökki", max_guests=4, price_per_night=Decimal("150"))
        with mock.patch("owners.rates.current") as current:
            s = summary(finn, 2026, date(2026, 7, 10))
        current.assert_not_called()
        self.assertEqual(s["currency"], "EUR")
        self.assertIsNone(s["rate"])

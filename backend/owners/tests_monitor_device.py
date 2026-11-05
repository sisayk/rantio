from datetime import timedelta
from decimal import Decimal
from unittest import mock

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from . import app, monitor
from . import login as owner_login
from .models import Booking, CalendarBlock, MonitorAlert, MonitorReading
from .tests_calendar import make_cottage


@override_settings(BOOKING_ALERTS=False, APP_PUSH=True)
class MonitorDeviceTests(TestCase):
    def setUp(self):
        cache.clear()
        self.c = make_cottage()
        self.o = self.c.owner
        self.o.is_host = True
        self.o.language = "en"
        self.o.save()
        self.d, self.code, self.secret = monitor.new_device()
        self.client.force_login(owner_login.user_for(self.o))
        self.pushed = []
        patcher = mock.patch.object(app, "notify", lambda owner, title, body, data=None: self.pushed.append((title, body, data)))
        patcher.start()
        self.addCleanup(patcher.stop)

    def claim(self):
        res = self.client.post("/api/owner/monitors/", {"serial": self.d.serial, "code": self.code, "cottage": self.c.pk}, content_type="application/json")
        self.assertEqual(res.status_code, 201, res.content)
        return res.json()

    def send(self, secret=None, **reading):
        return self.client.post("/api/monitor/readings/", reading, content_type="application/json",
                                HTTP_AUTHORIZATION=f"Device {self.d.serial}:{secret or self.secret}")

    def test_a_host_connects_a_box_with_its_sticker_code(self):
        bad = self.client.post("/api/owner/monitors/", {"serial": self.d.serial, "code": "AAAA-BBBB"}, content_type="application/json")
        self.assertEqual(bad.json(), {"error": "wrong_code"})
        row = self.claim()
        self.assertEqual((row["serial"], row["cottage"]["id"], row["online"]), (self.d.serial, self.c.pk, False))
        # Typed without the dash and the MM- prefix works too.
        self.d.refresh_from_db()
        self.assertEqual(self.d.owner, self.o)

    def test_only_the_box_with_its_secret_can_send(self):
        self.claim()
        self.assertEqual(self.send(secret="nope", temp=20).status_code, 401)
        res = self.send(temp=20.5, humidity=40, battery=90, mains=True, signal=-97, fw="0.1.0")
        self.assertEqual(res.json(), {"ok": True, "interval": 900, "saved": 1})
        self.d.refresh_from_db()
        self.assertEqual((self.d.last["temp"], self.d.firmware), (20.5, "0.1.0"))

    def test_frost_alerts_once_and_says_when_its_over(self):
        self.claim()
        self.send(temp=3.5)
        self.send(temp=3.0)
        self.assertEqual(len(self.pushed), 1)
        self.assertIn("Frost risk", self.pushed[0][0])
        self.assertIn("3.5 °C", self.pushed[0][1])
        self.assertEqual(self.pushed[0][2], {"type": "monitor", "id": self.d.pk})
        self.send(temp=12)
        self.assertIn("warm again", self.pushed[-1][0])
        self.assertFalse(MonitorAlert.objects.filter(ended_at__isnull=True).exists())

    def test_the_door_only_matters_when_nobody_is_booked(self):
        self.claim()
        today = timezone.localdate()
        stay = Booking.objects.create(cottage=self.c, channel="airbnb", check_in=today - timedelta(days=1), check_out=today + timedelta(days=2), owner_payout=Decimal("100"))
        self.send(door=True)
        self.assertEqual(self.pushed, [])
        stay.delete()
        self.send(door=False)
        self.send(door=True)
        self.assertIn("door opened", self.pushed[-1][0].lower())

    def test_the_sauna_left_on_in_an_empty_cottage(self):
        self.claim()
        now = timezone.now()
        MonitorReading.objects.create(device=self.d, at=now - timedelta(minutes=90), temp_sauna=Decimal("75"))
        self.send(sauna=80)
        self.assertIn("empty cottage", self.pushed[-1][0])
        self.send(sauna=40)
        self.assertIn("cooled down", self.pushed[-1][0])

    def test_a_power_cut_and_a_low_battery(self):
        self.claim()
        self.send(mains=False, battery=60)
        self.assertIn("Power cut", self.pushed[-1][0])
        self.send(mains=False, battery=12)
        self.assertIn("battery is low", self.pushed[-1][0])
        self.send(mains=True, battery=12)
        self.assertIn("Power is back", self.pushed[-1][0])

    def test_a_quiet_box_and_guests_arriving_to_a_cold_cottage(self):
        self.claim()
        self.send(temp=9)
        self.d.refresh_from_db()
        self.d.last_seen_at = timezone.now() - timedelta(hours=4)
        self.d.save()
        Booking.objects.create(cottage=self.c, channel="booking", check_in=timezone.localdate() + timedelta(days=1),
                               check_out=timezone.localdate() + timedelta(days=4), owner_payout=Decimal("300"))
        self.assertEqual(monitor.check(), {"offline": 1, "arrival": 1})
        self.assertEqual(monitor.check(), {"offline": 0, "arrival": 0})  # each told once
        titles = [p[0] for p in self.pushed]
        self.assertTrue(any("No word" in t for t in titles) and any("Guests arrive" in t for t in titles))
        self.send(temp=19)
        self.assertIn("is back", self.pushed[-1][0])

    def test_settings_detail_and_disconnecting(self):
        self.claim()
        self.send(temp=21)
        res = self.client.patch(f"/api/owner/monitors/{self.d.pk}/", {"frost_limit": 7, "sauna_hours": 3, "name": "Main house"}, content_type="application/json")
        self.assertEqual(res.json()["settings"], {"frost_limit": 7.0, "arrival_temp": 18.0, "sauna_hours": 3})
        self.assertEqual(self.client.patch(f"/api/owner/monitors/{self.d.pk}/", {"frost_limit": 40}, content_type="application/json").status_code, 400)
        detail = self.client.get(f"/api/owner/monitors/{self.d.pk}/").json()
        self.assertEqual(len(detail["history"]), 1)
        self.assertEqual(self.client.delete(f"/api/owner/monitors/{self.d.pk}/").status_code, 204)
        self.d.refresh_from_db()
        self.assertIsNone(self.d.owner)
        self.assertFalse(self.d.readings.exists())
        # The owner's own dates count as someone being there.
        CalendarBlock.objects.create(cottage=self.c, start=timezone.localdate(), end=timezone.localdate() + timedelta(days=1))
        self.assertTrue(monitor.occupied(self.c))

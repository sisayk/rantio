from django.core.cache import cache
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient

from .models import MonitorInterest


class MonitorWaitlistTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.url = reverse("monitor-waitlist")

    def test_joins_and_normalises_email(self):
        res = self.client.post(self.url, {"email": "Liisa@Example.fi", "language": "fi", "country": "FI",
                                           "rents": "yes", "privacy_consent": True}, format="json")
        self.assertEqual(res.status_code, 201)
        entry = MonitorInterest.objects.get()
        self.assertEqual((entry.email, entry.rents), ("liisa@example.fi", "yes"))

    def test_joining_again_updates_instead_of_failing(self):
        body = {"email": "liisa@example.fi", "privacy_consent": True, "rents": "no"}
        self.client.post(self.url, body, format="json")
        res = self.client.post(self.url, {**body, "rents": "not_yet", "country": "SE"}, format="json")
        self.assertEqual(res.status_code, 201)
        entry = MonitorInterest.objects.get()
        self.assertEqual((entry.rents, entry.country), ("not_yet", "SE"))

    def test_needs_consent_and_rejects_bots(self):
        res = self.client.post(self.url, {"email": "a@b.fi", "privacy_consent": False}, format="json")
        self.assertEqual(res.status_code, 400)
        res = self.client.post(self.url, {"email": "a@b.fi", "privacy_consent": True, "website": "x"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertFalse(MonitorInterest.objects.exists())

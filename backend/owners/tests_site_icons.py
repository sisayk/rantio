import re
from pathlib import Path
from unittest import mock

from django.core.cache import cache
from django.test import TestCase

from . import site_icons


class SiteIconTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_fetched_once_then_served_from_the_cache(self):
        with mock.patch.object(site_icons, "fetch", return_value=(b"\x89PNG icon", "image/png")) as fetch:
            for _ in range(3):
                res = self.client.get("/api/site-icon/airbnb/")
                self.assertEqual(res.status_code, 200)
                self.assertEqual(res["Content-Type"], "image/png")
                self.assertEqual(res.content, b"\x89PNG icon")
        fetch.assert_called_once_with("airbnb.com")

    def test_only_listed_sites(self):
        with mock.patch.object(site_icons, "fetch") as fetch:
            self.assertEqual(self.client.get("/api/site-icon/example.com/").status_code, 404)
        fetch.assert_not_called()

    def test_a_failed_fetch_is_a_404_and_isnt_retried_at_once(self):
        with mock.patch.object(site_icons, "fetch", return_value=None) as fetch:
            self.assertEqual(self.client.get("/api/site-icon/vrbo/").status_code, 404)
            self.assertEqual(self.client.get("/api/site-icon/vrbo/").status_code, 404)
        fetch.assert_called_once()

    def test_the_list_matches_the_sites_catalog(self):
        catalog = (Path(__file__).resolve().parents[2] / "frontend/src/lib/catalog.ts").read_text()
        block = catalog.split("export const CHANNELS = {", 1)[1].split("} as const;", 1)[0]
        listed = dict(re.findall(r'(\w+): \{ name: "[^"]+", domain: "([^"]+)" \}', block))
        self.assertEqual(listed, site_icons.SITES)


class HealthTests(TestCase):
    def test_health_shows_the_live_commit(self):
        import json
        import tempfile

        from django.test import override_settings

        with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as f:
            json.dump({"deployed": "94b9728366eb6adcd73398b0b778ff97d058f83f", "state": "ok", "at": "2026-11-03T20:00:00+0200"}, f)
        with override_settings(DEPLOY_STATUS_FILE=f.name):
            body = self.client.get("/api/health/").json()
        self.assertEqual(body["deploy"]["live"], "94b9728")
        self.assertEqual(body["deploy"]["state"], "ok")
        with override_settings(DEPLOY_STATUS_FILE="/nonexistent.json"):
            self.assertEqual(self.client.get("/api/health/").json(), {"ok": True})

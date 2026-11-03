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

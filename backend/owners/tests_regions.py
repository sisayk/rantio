import json
import re
from pathlib import Path

from django.test import SimpleTestCase

from .regions import REGIONS


class RegionListTests(SimpleTestCase):
    def test_same_regions_as_the_website(self):
        places = (Path(__file__).resolve().parents[2] / "frontend/src/lib/places.ts").read_text()
        data = json.loads(re.search(r"export const PLACES: [^=]+= (\{.*\});", places).group(1))
        site = {country: {r["id"]: r["name"]["en"] for r in regions} for country, regions in data.items()}
        self.assertEqual(site, REGIONS)

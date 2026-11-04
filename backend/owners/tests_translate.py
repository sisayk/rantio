import re
import sys
import threading
import types
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from . import login as owner_login
from .models import Cottage
from .tests_calendar import make_cottage

ALL = {"en", "fi", "sv", "nb", "nn", "da", "is", "et", "lv", "lt", "de"}


class FakeClaude:
    """Stands in for anthropic.Anthropic: "translates" by tagging the text with the target language."""

    calls: list[dict] = []
    fail_for: set[str] = set()
    lock = threading.Lock()

    def __init__(self, **kw):
        self.messages = self

    def create(self, **kw):
        target = re.search(r"into .*?\(language code (\w+)\)", kw["system"]).group(1)
        with FakeClaude.lock:
            FakeClaude.calls.append({**kw, "target": target})
        if target in FakeClaude.fail_for:
            raise RuntimeError("API down")
        text = re.search(r"<description>\n(.*)\n</description>", kw["messages"][0]["content"], re.S).group(1)
        return types.SimpleNamespace(stop_reason="end_turn", content=[types.SimpleNamespace(type="text", text=f"[{target}] {text}")])


@override_settings(ANTHROPIC_API_KEY="test-key", ANTHROPIC_MODEL="claude-sonnet-5-5", TRANSLATE_IN_BACKGROUND=False)
class TranslateTests(TestCase):
    def setUp(self):
        cache.clear()
        FakeClaude.calls, FakeClaude.fail_for = [], set()
        self._real = sys.modules.get("anthropic")
        sys.modules["anthropic"] = types.SimpleNamespace(Anthropic=FakeClaude)
        self.c = make_cottage()
        self.client.force_login(owner_login.user_for(self.c.owner))
        self.base = f"/api/owner/cottages/{self.c.pk}/"

    def tearDown(self):
        if self._real is not None:
            sys.modules["anthropic"] = self._real
        else:
            sys.modules.pop("anthropic", None)

    def patch(self, descriptions):
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.patch(self.base, {"descriptions": descriptions}, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        return self.client.get(self.base).json()

    def test_one_language_fills_all_the_others(self):
        d = self.patch({"fi": "Mökki järven rannalla.\n\nSauna ja laituri."})
        self.assertEqual(set(d["descriptions"]), ALL)
        self.assertEqual(d["descriptions"]["sv"], "[sv] Mökki järven rannalla.\n\nSauna ja laituri.")
        self.assertEqual(d["descriptions_auto"], {lang: "fi" for lang in ALL - {"fi"}})
        self.assertEqual(d["translation"], {"enabled": True, "pending": [], "failed": [], "from": None})
        self.assertEqual(len(FakeClaude.calls), 10)
        call = FakeClaude.calls[0]
        self.assertEqual(call["model"], "claude-sonnet-5-5")
        self.assertIn("from Suomi (language code fi)", call["system"])
        self.c.refresh_from_db()
        self.assertEqual(self.c.description_en, "[en] Mökki järven rannalla.\n\nSauna ja laituri.")  # mirrored

    def test_the_owners_own_languages_are_never_overwritten(self):
        self.patch({"en": "By the lake.", "sv": "Vid sjön, med egen brygga."})
        d = self.client.get(self.base).json()
        self.assertEqual(d["descriptions"]["sv"], "Vid sjön, med egen brygga.")
        self.assertNotIn("sv", d["descriptions_auto"])
        self.assertNotIn("sv", {c["target"] for c in FakeClaude.calls})
        self.assertIn("from English (language code en)", FakeClaude.calls[0]["system"])  # English is preferred

    def test_saving_the_translations_back_unchanged_changes_nothing(self):
        d = self.patch({"en": "By the lake."})
        FakeClaude.calls = []
        d = self.patch(d["descriptions"])  # the editor sends every language
        self.assertEqual(FakeClaude.calls, [])
        self.assertEqual(len(d["descriptions_auto"]), 10)

    def test_editing_a_translation_makes_it_the_owners_and_translates_nothing(self):
        self.patch({"en": "By the lake."})
        FakeClaude.calls = []
        d = self.patch({"de": "Am See."})
        self.assertEqual(FakeClaude.calls, [])
        self.assertEqual(d["descriptions"]["de"], "Am See.")
        self.assertNotIn("de", d["descriptions_auto"])
        FakeClaude.calls = []
        d = self.patch({"en": "By the lake, with a sauna."})  # a new original: the translations follow, German stays
        self.assertEqual({c["target"] for c in FakeClaude.calls}, ALL - {"en", "de"})
        self.assertEqual(d["descriptions"]["de"], "Am See.")
        self.assertEqual(d["descriptions"]["fi"], "[fi] By the lake, with a sauna.")

    def test_removing_the_only_original_removes_its_translations(self):
        self.patch({"en": "By the lake."})
        d = self.patch({"en": ""})
        self.assertEqual(d["descriptions"], {})
        self.assertEqual(d["descriptions_auto"], {})

    def test_a_failed_language_is_reported_and_can_be_retried(self):
        FakeClaude.fail_for = {"is"}
        d = self.patch({"en": "By the lake."})
        self.assertNotIn("is", d["descriptions"])
        self.assertEqual(d["translation"]["failed"], ["is"])
        FakeClaude.fail_for, FakeClaude.calls = set(), []
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"{self.base}translate/", {}, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        d = self.client.get(self.base).json()
        self.assertEqual(d["descriptions"]["is"], "[is] By the lake.")
        self.assertEqual(d["translation"]["failed"], [])

    def test_translate_needs_a_description_of_the_owners(self):
        res = self.client.post(f"{self.base}translate/", {}, content_type="application/json")
        self.assertEqual(res.status_code, 400)

    def test_a_newer_edit_wins_over_an_older_job(self):
        self.patch({"en": "By the lake."})
        c = Cottage.objects.get(pk=self.c.pk)
        c.translating = {"job": "old", "from": "en", "langs": ["sv"], "started": timezone.now().isoformat()}
        c.save()
        from . import translate

        self.patch({"en": "By the sea."})  # a new job replaces the old one
        translate.run(self.c.pk, "old")  # the old one wakes up late and does nothing
        d = self.client.get(self.base).json()
        self.assertEqual(d["descriptions"]["sv"], "[sv] By the sea.")

    def test_a_stopped_job_goes_stale(self):
        c = Cottage.objects.get(pk=self.c.pk)
        c.descriptions = {"en": "By the lake."}
        c.translating = {"job": "x", "from": "en", "langs": ["sv", "fi"], "started": (timezone.now() - timedelta(minutes=10)).isoformat()}
        c.save()
        d = self.client.get(self.base).json()
        self.assertEqual(d["translation"]["pending"], [])
        self.assertEqual(d["translation"]["failed"], ["sv", "fi"])

    def test_others_cottages_cannot_be_translated(self):
        other = make_cottage(email="someone@example.fi")
        res = self.client.post(f"/api/owner/cottages/{other.pk}/translate/", {}, content_type="application/json")
        self.assertEqual(res.status_code, 404)


class WithoutAITests(TestCase):
    @override_settings(ANTHROPIC_API_KEY="")
    def test_nothing_is_translated_without_a_key(self):
        c = make_cottage()
        self.client.force_login(owner_login.user_for(c.owner))
        res = self.client.patch(f"/api/owner/cottages/{c.pk}/", {"descriptions": {"en": "By the lake."}}, content_type="application/json")
        self.assertEqual(res.json()["descriptions"], {"en": "By the lake."})
        self.assertFalse(res.json()["translation"]["enabled"])
        self.assertEqual(self.client.post(f"/api/owner/cottages/{c.pk}/translate/").status_code, 503)

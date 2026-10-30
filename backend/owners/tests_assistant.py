import sys
import types
from datetime import timedelta
from decimal import Decimal

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from .login import user_for
from .models import Booking, Conversation, Cottage, Message, Owner


class FakeClaude:
    """Stands in for anthropic.Anthropic and remembers the request."""

    calls: list[dict] = []
    reply = "Hej Emma! Ja, bastun är vedeldad och handdukar ingår. [check-in time]\n\nMaija"
    fail = False

    def __init__(self, **kw):
        self.messages = self

    def create(self, **kw):
        FakeClaude.calls.append(kw)
        if FakeClaude.fail:
            raise RuntimeError("API down")
        return types.SimpleNamespace(content=[types.SimpleNamespace(type="text", text=FakeClaude.reply)])


@override_settings(ANTHROPIC_API_KEY="test-key", ANTHROPIC_MODEL="claude-sonnet-5-5")
class AssistantTests(TestCase):
    def setUp(self):
        cache.clear()
        FakeClaude.calls, FakeClaude.fail = [], False
        self._real = sys.modules.get("anthropic")
        sys.modules["anthropic"] = types.SimpleNamespace(Anthropic=FakeClaude)
        self.owner = Owner.objects.create(name="Maija Mökki", email="m@example.com")
        self.cottage = Cottage.objects.create(owner=self.owner, name="Rantasauna", municipality="Lohja", max_guests=4,
                                              price_per_night=Decimal("120"), house_rules="No parties.")
        today = timezone.localdate()
        self.booking = Booking.objects.create(cottage=self.cottage, channel="airbnb", check_in=today + timedelta(days=10),
                                              check_out=today + timedelta(days=14), owner_payout=Decimal("400"), guests=2)
        self.c = Conversation.objects.create(cottage=self.cottage, booking=self.booking, channel="airbnb",
                                             guest_name="Emma Lindqvist", guest_language="sv", guest_email="e@example.com",
                                             token="x" * 32)
        Message.objects.create(conversation=self.c, sender="guest", body="Är bastun vedeldad? Behöver vi ta med handdukar?")
        self.client.force_login(user_for(self.owner))

    def tearDown(self):
        if self._real is not None:
            sys.modules["anthropic"] = self._real
        else:
            sys.modules.pop("anthropic", None)

    def draft(self, **data):
        return self.client.post(f"/api/owner/conversations/{self.c.pk}/draft/", data, content_type="application/json")

    def test_suggests_a_reply_and_sends_nothing(self):
        res = self.draft()
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["draft"], FakeClaude.reply)
        self.assertEqual(self.c.messages.count(), 1)  # the owner still has to send it
        call = FakeClaude.calls[0]
        self.assertEqual(call["model"], "claude-sonnet-5-5")
        prompt = call["messages"][0]["content"]
        self.assertIn("Är bastun vedeldad", prompt)  # the conversation
        self.assertIn("Rantasauna", prompt)  # the cottage's facts
        self.assertIn("No parties.", prompt)
        self.assertIn("Booked dates", prompt)
        self.assertIn("Airbnb", prompt)
        self.assertNotIn("e@example.com", prompt)  # the guest's email never leaves
        self.assertIn("language of the guest's latest message", call["system"])

    def test_notes_and_owner_draft_are_used(self):
        self.draft(notes="say towels are included", draft="Hei, kyllä on puusauna")
        prompt = FakeClaude.calls[0]["messages"][0]["content"]
        self.assertIn("<owner_notes>\nsay towels are included", prompt)
        self.assertIn("<owner_draft>\nHei, kyllä on puusauna", prompt)

    def test_errors(self):
        FakeClaude.fail = True
        self.assertEqual(self.draft().status_code, 502)
        with override_settings(ANTHROPIC_API_KEY=""):
            self.assertEqual(self.draft().json()["detail"], "ai_not_configured")
            self.assertFalse(self.client.get("/api/owner/assistant/").json()["enabled"])
        self.assertTrue(self.client.get("/api/owner/assistant/").json()["enabled"])

    def test_only_own_conversations(self):
        other = Owner.objects.create(name="Other", email="o@example.com")
        self.client.force_login(user_for(other))
        self.assertEqual(self.draft().status_code, 404)
        self.client.logout()
        self.assertEqual(self.draft().status_code, 403)
        self.assertEqual(FakeClaude.calls, [])


@override_settings(ANTHROPIC_API_KEY="test-key", ANTHROPIC_MODEL="claude-sonnet-5-5")
class GuestDraftTests(TestCase):
    """A traveller's first message, written from a few words."""

    def setUp(self):
        cache.clear()
        FakeClaude.calls, FakeClaude.fail = [], False
        FakeClaude.reply = "Hei! Onko mökki vapaa 12.–15.11. kahdelle aikuiselle ja lapselle? Kiitos, Emma"
        self._real = sys.modules.get("anthropic")
        sys.modules["anthropic"] = types.SimpleNamespace(Anthropic=FakeClaude)

    def tearDown(self):
        if self._real is not None:
            sys.modules["anthropic"] = self._real
        else:
            sys.modules.pop("anthropic", None)

    def draft(self, **kw):
        data = {"listing": "nuuksio-forest-cabin", "cottage": "Nuuksio Forest Cabin", "place": "Espoo, Finland", "lang": "fi", **kw}
        return self.client.post("/api/enquiries/draft/", data, content_type="application/json")

    def test_writes_from_notes_in_the_travellers_language(self):
        res = self.draft(name="Emma Virtanen", check_in="2026-11-12", check_out="2026-11-15", adults=2, children=1,
                         draft="dog ok? arriving late ~22")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.json()["draft"], FakeClaude.reply)
        call = FakeClaude.calls[0]
        self.assertIn("Suomi (language code fi)", call["system"])
        content = call["messages"][0]["content"]
        for text in ("Nuuksio Forest Cabin, Espoo, Finland", "2 adults and 1 children", "3 nights", "Emma", "dog ok? arriving late ~22"):
            self.assertIn(text, content)

    def test_without_notes_asks_about_availability(self):
        res = self.draft()
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("traveller_notes", FakeClaude.calls[0]["messages"][0]["content"])

    def test_not_configured_and_failure(self):
        with self.settings(ANTHROPIC_API_KEY=""):
            self.assertEqual(self.draft().json()["detail"], "ai_not_configured")
        FakeClaude.fail = True
        self.assertEqual(self.draft().status_code, 502)

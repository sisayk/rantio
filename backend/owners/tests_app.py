import json
import re
from datetime import date, timedelta
from decimal import Decimal
from unittest import mock

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from . import app
from .models import AppDevice, Booking, Cottage, Owner


@override_settings(DEV_LOGIN_CODES=False)
class AppSignInTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = Owner.objects.create(name="Aino Järvinen", email="owner@example.com", language="fi")

    def sign_in(self, **extra) -> str:
        self.client.post("/api/auth/request-code/", {"email": "owner@example.com", "lang": "fi"}, content_type="application/json")
        code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        res = self.client.post(
            "/api/auth/verify-code/",
            {"email": "owner@example.com", "code": code, "app": True, "device": "iPhone 17", "platform": "ios", **extra},
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200)
        return res.json()["token"]

    def auth(self, key):
        return {"HTTP_AUTHORIZATION": f"Bearer {key}"}

    def test_app_gets_a_key_and_no_session(self):
        key = self.sign_in()
        self.assertTrue(key.startswith("stg_"))
        self.assertNotIn("sessionid", self.client.cookies)
        self.assertEqual(self.client.get("/api/owner/me/").status_code, 403)  # no cookie
        me = self.client.get("/api/owner/me/", **self.auth(key))
        self.assertEqual(me.status_code, 200)
        self.assertEqual(me.json()["email"], "owner@example.com")
        device = AppDevice.objects.get()
        self.assertEqual((device.name, device.platform), ("iPhone 17", "ios"))
        self.assertNotIn(key, device.token_hash)

    def test_writes_need_no_csrf_with_a_key(self):
        key = self.sign_in()
        client = self.client_class(enforce_csrf_checks=True)
        res = client.post("/api/owner/device/", {"push_token": "ExponentPushToken[abc-123]"},
                          content_type="application/json", **self.auth(key))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(AppDevice.objects.get().push_token, "ExponentPushToken[abc-123]")

    def test_switching_notifications_off_and_on_on_one_phone(self):
        # The app sends "" when the switch goes off, and at every start while it is off.
        first, second = self.sign_in(), self.sign_in()
        token = "ExponentPushToken[abc-123]"
        for key in (first, second):
            self.client.post("/api/owner/device/", {"push_token": token if key == first else "ExponentPushToken[other]"},
                             content_type="application/json", **self.auth(key))
        for _ in range(2):  # sending off again changes nothing
            res = self.client.post("/api/owner/device/", {"push_token": ""}, content_type="application/json", **self.auth(first))
            self.assertEqual(res.status_code, 200)
        owner = AppDevice.objects.first().owner
        self.assertEqual(list(owner.app_devices.exclude(push_token="").values_list("push_token", flat=True)),
                         ["ExponentPushToken[other]"])  # only the other phone still gets pushes
        self.client.post("/api/owner/device/", {"push_token": token}, content_type="application/json", **self.auth(first))
        self.assertEqual(owner.app_devices.exclude(push_token="").count(), 2)

    def test_bad_or_expired_key_is_signed_out(self):
        self.assertIn(self.client.get("/api/owner/me/", **self.auth("stg_nope")).status_code, (401, 403))
        key = self.sign_in()
        AppDevice.objects.update(last_used_at=timezone.now() - timedelta(days=AppDevice.LIFETIME_DAYS + 1))
        self.assertIn(self.client.get("/api/owner/me/", **self.auth(key)).status_code, (401, 403))

    def test_logout_ends_only_this_phone(self):
        first, second = self.sign_in(), self.sign_in()
        self.assertEqual(self.client.post("/api/auth/logout/", **self.auth(first)).status_code, 200)
        self.assertIn(self.client.get("/api/owner/me/", **self.auth(first)).status_code, (401, 403))
        self.assertEqual(self.client.get("/api/owner/me/", **self.auth(second)).status_code, 200)

    def test_test_notification_reports_what_happened(self):
        key = self.sign_in()
        url = "/api/owner/device/test/"
        self.assertEqual(self.client.post(url, **self.auth(key)).json(), {"ok": False, "step": "no_token"})
        self.client.post("/api/owner/device/", {"push_token": "ExponentPushToken[abc-123]"}, content_type="application/json", **self.auth(key))
        answers = {
            app.EXPO_PUSH_URL: {"data": [{"status": "ok", "id": "t1"}]},
            app.EXPO_RECEIPTS_URL: {"data": {"t1": {"status": "error", "message": "x", "details": {"error": "InvalidCredentials"}}}},
        }
        calls = []

        class Reply:
            def __init__(self, body): self.body = json.dumps(body).encode()
            def __enter__(self): return self
            def __exit__(self, *a): return False
            def read(self): return self.body

        def fake(req, timeout=8):
            calls.append(req.full_url)
            return Reply(answers[req.full_url])

        with mock.patch.object(app.urllib.request, "urlopen", side_effect=fake), mock.patch("time.sleep"):
            body = self.client.post(url, **self.auth(key)).json()
        self.assertEqual(body, {"ok": False, "step": "receipt", "error": "InvalidCredentials"})
        self.assertEqual(calls, [app.EXPO_PUSH_URL, app.EXPO_RECEIPTS_URL])
        answers[app.EXPO_RECEIPTS_URL] = {"data": {"t1": {"status": "ok"}}}
        with mock.patch.object(app.urllib.request, "urlopen", side_effect=fake), mock.patch("time.sleep"):
            self.assertEqual(self.client.post(url, **self.auth(key)).json(), {"ok": True, "step": "delivered"})

    def test_push_token_is_checked_and_moves_with_the_phone(self):
        key = self.sign_in()
        bad = self.client.post("/api/owner/device/", {"push_token": "hello"}, content_type="application/json", **self.auth(key))
        self.assertEqual(bad.status_code, 400)
        self.client.post("/api/owner/device/", {"push_token": "ExponentPushToken[x1]"}, content_type="application/json", **self.auth(key))
        other = self.sign_in()
        self.client.post("/api/owner/device/", {"push_token": "ExponentPushToken[x1]"}, content_type="application/json", **self.auth(other))
        self.assertEqual(AppDevice.objects.filter(push_token="ExponentPushToken[x1]").count(), 1)

    def test_language_setting(self):
        key = self.sign_in()
        res = self.client.patch("/api/owner/me/", {"language": "sv"}, content_type="application/json", **self.auth(key))
        self.assertEqual(res.json()["language"], "sv")
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.language, "sv")
        self.assertEqual(
            self.client.patch("/api/owner/me/", {"language": "xx"}, content_type="application/json", **self.auth(key)).status_code,
            400,
        )

    def test_website_sign_in_is_unchanged(self):
        self.client.post("/api/auth/request-code/", {"email": "owner@example.com"}, content_type="application/json")
        code = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        res = self.client.post("/api/auth/verify-code/", {"email": "owner@example.com", "code": code}, content_type="application/json")
        self.assertEqual(res.json(), {"ok": True})
        self.assertEqual(self.client.get("/api/owner/me/").status_code, 200)
        self.assertFalse(AppDevice.objects.exists())


@override_settings(BOOKING_ALERTS=True, APP_PUSH=True)
class PushTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = Owner.objects.create(name="Aino Järvinen", email="owner@example.com", language="en")
        self.cottage = Cottage.objects.create(owner=self.owner, name="Rantasauna", max_guests=4, listing_slug="rantasauna", price_per_night=Decimal("150"),
                                              status=Cottage.Status.LIVE)
        AppDevice.objects.create(owner=self.owner, token_hash="a", push_token="ExponentPushToken[one]")
        AppDevice.objects.create(owner=self.owner, token_hash="b", push_token="")

    def test_new_booking_and_guest_message_are_pushed(self):
        with mock.patch.object(app, "_post") as post, self.captureOnCommitCallbacks(execute=True):
            Booking.objects.create(cottage=self.cottage, channel=Booking.Channel.AIRBNB, check_in=date.today() + timedelta(days=10),
                                   check_out=date.today() + timedelta(days=12), guests=2, owner_payout=Decimal("300"))
        messages = post.call_args.args[0]
        self.assertEqual([m["to"] for m in messages], ["ExponentPushToken[one]"])
        self.assertIn("Rantasauna", messages[0]["title"])
        self.assertEqual(messages[0]["data"]["type"], "booking")

        with mock.patch.object(app, "_post") as post, self.captureOnCommitCallbacks(execute=True):
            res = self.client.post("/api/enquiries/", {"listing": "rantasauna", "name": "Lena Berg", "email": "lena@example.com",
                                                       "lang": "en", "body": "Is the sauna wood-fired?"},
                                   content_type="application/json")
        self.assertEqual(res.status_code, 201, res.content)
        msg = post.call_args.args[0][0]
        self.assertIn("Lena Berg", msg["title"])
        self.assertEqual(msg["body"], "Is the sauna wood-fired?")
        self.assertEqual(msg["data"]["type"], "message")

    def test_the_guest_in_the_app_hears_the_owners_answer(self):
        from .messaging import add
        from .models import Conversation, Message

        res = self.client.post("/api/enquiries/", {"listing": "rantasauna", "name": "Lena Berg", "email": "lena@example.com",
                                                   "lang": "en", "body": "Is the sauna wood-fired?"}, content_type="application/json")
        token = res.json()["token"]
        bad = self.client.post(f"/api/conversations/{token}/push/", {"push_token": "nope"}, content_type="application/json")
        self.assertEqual(bad.status_code, 400)
        ok = self.client.post(f"/api/conversations/{token}/push/", {"push_token": "ExponentPushToken[guest]"},
                              content_type="application/json")
        self.assertEqual(ok.status_code, 200)
        c = Conversation.objects.get(token=token)
        with mock.patch.object(app, "_post") as post, self.captureOnCommitCallbacks(execute=True):
            add(c, Message.Sender.HOST, "Yes, it is.")
        msg = post.call_args.args[0][0]
        self.assertEqual(msg["to"], "ExponentPushToken[guest]")
        self.assertEqual(msg["title"], "Rantasauna")
        self.assertEqual(msg["data"], {"type": "guest-message", "token": token})
        # Notifications off in the app: nothing more is sent.
        self.client.post(f"/api/conversations/{token}/push/", {"push_token": ""}, content_type="application/json")
        c.refresh_from_db()
        with mock.patch.object(app, "_post") as post, self.captureOnCommitCallbacks(execute=True):
            add(c, Message.Sender.HOST, "And the lake is warm.")
        post.assert_not_called()

    def test_a_failed_push_is_only_logged(self):
        with self.assertLogs("owners.app", "ERROR"), mock.patch.object(app, "_post", side_effect=OSError("down")), \
                self.captureOnCommitCallbacks(execute=True):
            app.notify(self.owner, "t", "b")

    def test_unregistered_phones_stop_getting_pushes(self):
        reply = json.dumps({"data": [{"status": "error", "details": {"error": "DeviceNotRegistered"}}]}).encode()
        res = mock.MagicMock()
        res.__enter__.return_value.read.return_value = reply
        with mock.patch("urllib.request.urlopen", return_value=res):
            app._post([{"to": "ExponentPushToken[one]", "title": "t", "body": "b"}])
        self.assertFalse(AppDevice.objects.exclude(push_token="").exists())

    @override_settings(APP_PUSH=False)
    def test_push_can_be_switched_off(self):
        with mock.patch.object(app, "_post") as post, self.captureOnCommitCallbacks(execute=True):
            app.notify(self.owner, "t", "b")
        post.assert_not_called()

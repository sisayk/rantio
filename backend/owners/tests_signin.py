import time
from unittest import mock

import jwt
from cryptography.hazmat.primitives.asymmetric import rsa
from django.core.cache import cache
from django.test import TestCase, override_settings

from . import sms, social
from .models import Owner

KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)


def token(provider="google", aud="web-client", email="aino@example.com", sub="g-123", verified=True, **extra):
    iss = "https://accounts.google.com" if provider == "google" else "https://appleid.apple.com"
    now = int(time.time())
    claims = {"iss": iss, "aud": aud, "sub": sub, "email": email, "email_verified": verified, "iat": now, "exp": now + 600}
    return jwt.encode({**claims, **extra}, KEY, algorithm="RS256")


class FakeKeys:
    def __init__(self, *args, **kwargs):
        pass

    def get_signing_key_from_jwt(self, _token):
        return mock.Mock(key=KEY.public_key())


@override_settings(DEV_LOGIN_CODES=False, GOOGLE_CLIENT_IDS=["web-client", "ios-client"], APPLE_AUDIENCES=["fi.rantio.app"])
class SocialSignInTests(TestCase):
    def setUp(self):
        cache.clear()
        social._clients.clear()
        self.owner = Owner.objects.create(name="Aino Järvinen", email="Aino@Example.com", phone="040 123 4567")
        patcher = mock.patch.object(social.jwt, "PyJWKClient", FakeKeys)
        patcher.start()
        self.addCleanup(patcher.stop)

    def post(self, **body):
        return self.client.post("/api/auth/social/", body, content_type="application/json")

    def test_options_say_whats_switched_on(self):
        self.assertEqual(self.client.get("/api/auth/options/").json(), {"sms": False, "google": True, "apple": True})

    def test_google_signs_in_by_email_then_by_account_id(self):
        res = self.post(provider="google", id_token=token())
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(self.client.get("/api/owner/me/").status_code == 200)
        self.owner.refresh_from_db()
        self.assertEqual(self.owner.google_sub, "g-123")
        # Later the Google account's email changes: the account id still finds the owner.
        self.client.logout()
        self.assertEqual(self.post(provider="google", id_token=token(email="new@example.com")).status_code, 200)

    def test_the_app_gets_a_key(self):
        res = self.post(provider="apple", id_token=token("apple", aud="fi.rantio.app", sub="a-1", verified="true"), app=True,
                        platform="ios")
        self.assertEqual(res.status_code, 200, res.content)
        self.assertTrue(res.json()["token"].startswith("stg_"))

    def test_refused(self):
        cases = [
            ({"id_token": token(aud="someone-else")}, "invalid_token"),
            ({"id_token": token(exp=int(time.time()) - 3600)}, "invalid_token"),
            ({"id_token": token(iss="https://evil.example")}, "invalid_token"),
            ({"id_token": token(verified=False)}, "no_email"),
        ]
        for body, why in cases:
            res = self.post(provider="google", **body)
            self.assertEqual((res.status_code, res.json()["detail"]), (400, why), why)

    def test_someone_new_gets_an_account_that_is_not_a_host(self):
        res = self.post(provider="google", id_token=token(email="stranger@example.com", sub="g-999"))
        self.assertEqual(res.status_code, 200, res.content)
        o = Owner.objects.get(email="stranger@example.com")
        self.assertFalse(o.is_host)
        self.assertEqual(o.google_sub, "g-999")
        self.assertEqual(self.client.get("/api/owner/me/").json()["is_host"], False)
        res = self.client.get("/api/owner/summary/")
        self.assertEqual((res.status_code, res.json()["detail"]), (403, "not_host"))

    @override_settings(GOOGLE_CLIENT_IDS=[])
    def test_not_switched_on(self):
        self.assertEqual(self.post(provider="google", id_token=token()).json()["detail"], "not_enabled")


@override_settings(DEV_LOGIN_CODES=False, BREVO_API_KEY="xkeysib-test")
class SmsSignInTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = Owner.objects.create(name="Aino Järvinen", email="aino@example.com", phone="040 123 4567", language="fi")

    def test_normalize(self):
        self.assertEqual(sms.normalize("040 123 4567", "FI"), "+358401234567")
        self.assertEqual(sms.normalize("+46 70-123 45 67"), "+46701234567")
        self.assertEqual(sms.normalize("0047 912 34 567", ""), "+4791234567")
        self.assertEqual(sms.normalize("0401234567", ""), "")
        self.assertEqual(sms.normalize("hello"), "")

    def test_code_by_sms(self):
        with mock.patch.object(sms, "send") as send:
            res = self.client.post("/api/auth/request-code/", {"phone": "+358 40 123 4567", "lang": "fi"},
                                   content_type="application/json")
        self.assertEqual(res.status_code, 200)
        to, text = send.call_args.args
        self.assertEqual(to, "+358401234567")
        self.assertIn("Rantio-kirjautumiskoodisi", text)
        code = text.split("#")[-1]
        res = self.client.post("/api/auth/verify-code/", {"phone": "+358401234567", "code": code}, content_type="application/json")
        self.assertEqual(res.status_code, 200, res.content)

    def test_slow_brevo_still_lets_the_owner_type_the_code(self):
        with mock.patch.object(sms._brevo, "open", side_effect=TimeoutError("timed out")):
            res = self.client.post("/api/auth/request-code/", {"phone": "+358401234567"}, content_type="application/json")
        self.assertEqual(res.status_code, 200)

    def test_refused_sms_is_an_error(self):
        import urllib.error
        from io import BytesIO

        refused = urllib.error.HTTPError(sms.BREVO_SMS_URL, 400, "Bad", {}, BytesIO(b'{"message":"sender"}'))
        with mock.patch.object(sms._brevo, "open", side_effect=refused):
            res = self.client.post("/api/auth/request-code/", {"phone": "+358401234567"}, content_type="application/json")
        self.assertEqual(res.status_code, 503)

    def test_unknown_number_gets_the_same_answer(self):
        with mock.patch.object(sms, "send") as send:
            res = self.client.post("/api/auth/request-code/", {"phone": "+46701234567"}, content_type="application/json")
        self.assertEqual(res.json(), {"sent": True})
        send.assert_not_called()

    def test_number_needs_its_country_code(self):
        res = self.client.post("/api/auth/request-code/", {"phone": "0401234567"}, content_type="application/json")
        self.assertEqual(res.status_code, 400)

    @override_settings(BREVO_API_KEY="")
    def test_sms_off_sends_nothing(self):
        with mock.patch.object(sms, "send") as send:
            self.client.post("/api/auth/request-code/", {"phone": "+358401234567"}, content_type="application/json")
        send.assert_not_called()


class SmsKeyCheckTests(TestCase):
    @override_settings(BREVO_API_KEY="xkeysib-test", SIGNUP_NOTIFY_EMAILS=["info@rantio.fi"])
    def test_a_refused_key_emails_the_team(self):
        from io import StringIO

        from django.core import mail
        from django.core.management import call_command

        with mock.patch.object(sms, "check_key", return_value=(True, "")):
            call_command("check_sms_key", stdout=StringIO())
        self.assertEqual(len(mail.outbox), 0)
        with mock.patch.object(sms, "check_key", return_value=(False, "Brevo answered 401")):
            call_command("check_sms_key", stdout=StringIO(), stderr=StringIO())
        self.assertIn("SMS sign-in codes may have stopped", mail.outbox[0].subject)

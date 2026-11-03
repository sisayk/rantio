from datetime import timedelta

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from .models import NewsletterSubscriber
from .newsletter import MAX_CONFIRMATIONS


@override_settings(SITE_URL="https://rantio.fi")
class NewsletterTests(TestCase):
    def setUp(self):
        cache.clear()  # throttle counters

    def sign_up(self, email="Guest@Example.com", language="fi", **extra):
        return self.client.post("/api/newsletter/", {"email": email, "language": language, **extra}, content_type="application/json")

    def test_sign_up_sends_a_confirmation_link_in_the_page_language(self):
        res = self.sign_up()
        self.assertEqual(res.status_code, 201)
        sub = NewsletterSubscriber.objects.get()
        self.assertEqual(sub.email, "guest@example.com")
        self.assertFalse(sub.active)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Vahvista", mail.outbox[0].subject)
        self.assertIn(f"https://rantio.fi/fi/newsletter/{sub.token}", mail.outbox[0].body)

    def test_confirm_and_unsubscribe(self):
        self.sign_up()
        sub = NewsletterSubscriber.objects.get()
        res = self.client.post("/api/newsletter/confirm/", {"token": sub.token}, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        sub.refresh_from_db()
        self.assertTrue(sub.active)
        res = self.client.post("/api/newsletter/unsubscribe/", {"token": sub.token}, content_type="application/json")
        self.assertEqual(res.status_code, 200)
        sub.refresh_from_db()
        self.assertFalse(sub.active)
        # An unsubscribed link can't put the address back on the list.
        res = self.client.post("/api/newsletter/confirm/", {"token": sub.token}, content_type="application/json")
        self.assertEqual(res.status_code, 404)

    def test_unknown_token(self):
        res = self.client.post("/api/newsletter/confirm/", {"token": "nope"}, content_type="application/json")
        self.assertEqual(res.status_code, 404)

    def test_the_answer_doesnt_reveal_who_is_subscribed(self):
        self.sign_up()
        sub = NewsletterSubscriber.objects.get()
        self.client.post("/api/newsletter/confirm/", {"token": sub.token}, content_type="application/json")
        mail.outbox.clear()
        res = self.sign_up()
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json(), {"ok": True})
        self.assertEqual(mail.outbox, [])  # already on the list: no new email

    def test_confirmation_emails_are_limited_per_address(self):
        self.sign_up()
        self.sign_up()  # straight away: not sent again
        self.assertEqual(len(mail.outbox), 1)
        sub = NewsletterSubscriber.objects.get()
        for _ in range(MAX_CONFIRMATIONS + 2):
            NewsletterSubscriber.objects.filter(pk=sub.pk).update(last_confirmation_at=timezone.now() - timedelta(hours=1))
            cache.clear()
            self.sign_up()
        self.assertEqual(len(mail.outbox), MAX_CONFIRMATIONS)

    def test_coming_back_after_unsubscribing_needs_a_new_confirmation(self):
        self.sign_up()
        sub = NewsletterSubscriber.objects.get()
        old = sub.token
        self.client.post("/api/newsletter/confirm/", {"token": old}, content_type="application/json")
        self.client.post("/api/newsletter/unsubscribe/", {"token": old}, content_type="application/json")
        mail.outbox.clear()
        self.sign_up(language="sv")
        sub.refresh_from_db()
        self.assertFalse(sub.active)
        self.assertNotEqual(sub.token, old)
        self.assertEqual(sub.language, "sv")
        self.assertEqual(len(mail.outbox), 1)

    def test_honeypot_and_bad_email(self):
        res = self.sign_up(website="http://spam.example")
        self.assertEqual(res.status_code, 201)
        self.assertFalse(NewsletterSubscriber.objects.exists())
        self.assertEqual(mail.outbox, [])
        self.assertEqual(self.sign_up(email="not-an-email").status_code, 400)

    def test_unconfirmed_sign_ups_are_forgotten_after_a_month(self):
        self.sign_up()
        sub = NewsletterSubscriber.objects.get()
        NewsletterSubscriber.objects.filter(pk=sub.pk).update(created_at=timezone.now() - timedelta(days=31))
        res = self.client.post("/api/newsletter/confirm/", {"token": sub.token}, content_type="application/json")
        self.assertEqual(res.status_code, 404)
        self.assertFalse(NewsletterSubscriber.objects.exists())

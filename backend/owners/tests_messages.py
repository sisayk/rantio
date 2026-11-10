from decimal import Decimal

from django.core import mail
from django.core.cache import cache
from django.test import TestCase, override_settings

from .login import user_for
from .models import Conversation, Cottage, Message, Owner


@override_settings(SITE_URL="https://rantio.fi", SIGNUP_NOTIFY_EMAILS=["team@rantio.fi"])
class MessagingTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = Owner.objects.create(name="Maija Mökki", email="maija@example.com", language="fi")
        self.cottage = Cottage.objects.create(
            owner=self.owner, name="Järvihuvila", max_guests=6, price_per_night=Decimal("180"), listing_slug="lakeside-villa"
        )

    def enquire(self, **kw):
        data = {"listing": "lakeside-villa", "name": "Lukas Becker", "email": "Lukas@Example.com", "lang": "sv",
                "body": "Is the cottage free in February?"}
        data.update(kw)
        return self.client.post("/api/enquiries/", data, content_type="application/json")

    def test_enquiry_starts_a_conversation_and_tells_both_sides(self):
        res = self.enquire(check_in="2027-02-15", check_out="2027-02-20", guests=4)
        self.assertEqual(res.status_code, 201)
        c = Conversation.objects.get(token=res.json()["token"])
        self.assertEqual((c.cottage, c.channel, c.guest_email, c.guest_language), (self.cottage, "direct", "lukas@example.com", "sv"))
        self.assertEqual(c.messages.get().sender, "guest")
        to = {m.to[0]: m for m in mail.outbox}
        self.assertIn(f"https://rantio.fi/sv/messages/{c.token}", to["lukas@example.com"].body)  # guest's private link
        self.assertIn("Lukas Becker", to["maija@example.com"].subject)  # owner, in Finnish
        self.assertIn("kirjoitti", to["maija@example.com"].body)
        self.assertNotIn(c.token, to["maija@example.com"].body)
        self.assertNotIn("lukas@example.com", to["maija@example.com"].body)

    def test_enquiry_about_a_cottage_without_owner_goes_to_the_team(self):
        res = self.enquire(listing="lofoten-rorbu")
        self.assertEqual(res.status_code, 201)
        self.assertIsNone(Conversation.objects.get().cottage)
        team = next(m for m in mail.outbox if m.to[0] == "team@rantio.fi")
        self.assertTrue(team.subject.startswith("Example cottage:"))
        self.assertIn("/owners/conversation/", team.body)  # the team answers in the admin

    def test_a_guest_of_an_example_stay_is_told_the_rantio_team_answers(self):
        for lang in ("en", "fi", "sv", "nb", "nn", "da", "is", "et", "lv", "lt", "de"):
            with self.subTest(lang=lang):
                cache.clear()  # past the guests' rate limit
                mail.outbox.clear()
                token = self.enquire(listing="lofoten-rorbu", lang=lang).json()["token"]
                guest = next(m for m in mail.outbox if m.to[0] == "lukas@example.com")
                self.assertIn(token, guest.body)  # still their private link
                self.assertIn("Rantio", guest.body.split("\n\n")[1])
                for promise in ("within a day", "vuorokauden", "inom ett dygn", "innen et døgn", "innan eit døgn",
                                "inden for et døgn", "innan sólarhrings", "ööpäeva", "diennakts", "per parą", "innerhalb eines Tages"):
                    self.assertNotIn(promise, guest.body)  # no owner, so no owner's answering time
        cache.clear()
        mail.outbox.clear()
        self.enquire(listing="lofoten-rorbu", lang="en")
        guest = next(m for m in mail.outbox if m.to[0] == "lukas@example.com")
        self.assertIn("example stay", guest.body)
        self.assertIn("Rantio team", guest.body)
        self.assertNotIn("owner usually", guest.body)

    def test_a_guest_of_a_real_owner_still_hears_about_the_owner(self):
        self.enquire(lang="en")
        guest = next(m for m in mail.outbox if m.to[0] == "lukas@example.com")
        self.assertIn("The owner usually answers within a day", guest.body)
        self.assertNotIn("example", guest.body)

    def test_the_page_and_the_thread_say_who_answers(self):
        self.assertEqual(self.client.get("/api/cottages/lakeside-villa/contact/").json(), {"answered_by": "owner"})
        self.assertEqual(self.client.get("/api/cottages/lofoten-rorbu/contact/").json(), {"answered_by": "rantio"})
        mine = self.enquire().json()["token"]
        example = self.enquire(listing="lofoten-rorbu").json()["token"]
        self.assertEqual(self.client.get(f"/api/conversations/{mine}/").json()["answered_by"], "owner")
        self.assertEqual(self.client.get(f"/api/conversations/{example}/").json()["answered_by"], "rantio")

    def test_a_team_reply_in_the_admin_reaches_the_guest_signed_by_the_team(self):
        from django.contrib.auth.models import User

        token = self.enquire(listing="lofoten-rorbu", lang="sv").json()["token"]
        c = Conversation.objects.get(token=token)
        admin = User.objects.create_superuser("staff", "staff@rantio.fi", "pw-for-tests-only")
        self.client.force_login(admin)
        mail.outbox.clear()
        url = f"/admin/owners/conversation/{c.pk}/change/"
        page = self.client.get(url)
        self.assertEqual(page.status_code, 200)
        form = page.context["adminform"].form
        data = {k: v for k, v in form.initial.items() if v is not None and not isinstance(v, (list, dict))}
        data.update({
            "guest_name": c.guest_name, "guest_email": c.guest_email, "guest_language": c.guest_language,
            "listing_slug": c.listing_slug, "channel": c.channel, "children": 0,
            "messages-TOTAL_FORMS": "2", "messages-INITIAL_FORMS": "1", "messages-MIN_NUM_FORMS": "0", "messages-MAX_NUM_FORMS": "1000",
            "messages-0-id": str(c.messages.get().pk), "messages-0-conversation": str(c.pk),
            "messages-0-sender": "guest", "messages-0-body": "Is the cottage free in February?",
            "messages-1-conversation": str(c.pk), "messages-1-sender": "host", "messages-1-body": "Hej! Det här är ett exempel.",
        })
        res = self.client.post(url, data)
        self.assertEqual(res.status_code, 302, getattr(res, "context", None) and res.context["adminform"].form.errors)
        self.assertEqual(c.messages.count(), 2)
        self.assertEqual([m.to for m in mail.outbox], [["lukas@example.com"]])
        self.assertIn("Rantios team har svarat", mail.outbox[0].body)
        self.assertIn("Det här är ett exempel", mail.outbox[0].body)
        c.refresh_from_db()
        self.assertIsNotNone(c.owner_read_at)

    def test_an_owner_reply_is_still_signed_by_the_owner(self):
        token = self.enquire(lang="en").json()["token"]
        c = Conversation.objects.get(token=token)
        from . import messaging

        mail.outbox.clear()
        messaging.add(c, Message.Sender.HOST, "Yes, it's free.")
        self.assertIn("the owner of", mail.outbox[0].body)
        self.assertNotIn("Rantio team", mail.outbox[0].body)

    def test_enquiry_with_adults_and_children(self):
        c = Conversation.objects.get(token=self.enquire(adults=2, children=1).json()["token"])
        self.assertEqual((c.guests, c.children), (2, 1))
        self.assertEqual(self.enquire(children=2).status_code, 400)  # children travel with an adult
        old = Conversation.objects.get(token=self.enquire(guests=3).json()["token"])  # one head count still works
        self.assertEqual((old.guests, old.children), (3, 0))

    def test_enquiry_validation_and_honeypot(self):
        self.assertEqual(self.enquire(check_in="2027-02-20", check_out="2027-02-15").status_code, 400)
        self.assertEqual(self.enquire(website="http://spam").status_code, 400)
        self.assertEqual(self.enquire(body="").status_code, 400)
        self.assertEqual(Conversation.objects.count(), 0)

    def test_guest_reads_and_replies_with_token_only(self):
        token = self.enquire().json()["token"]
        thread = self.client.get(f"/api/conversations/{token}/").json()
        self.assertEqual(thread["host_name"], "Maija")
        self.assertNotIn("guest_email", thread)
        self.assertEqual(self.client.get("/api/conversations/not-a-real-token/").status_code, 404)
        mail.outbox.clear()
        res = self.client.post(f"/api/conversations/{token}/", {"body": "We are 4."}, content_type="application/json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual([m["sender"] for m in res.json()["messages"]], ["guest", "guest"])
        self.assertEqual(mail.outbox[0].to, ["maija@example.com"])

    def test_owner_inbox_reply_and_unread(self):
        token = self.enquire().json()["token"]
        c = Conversation.objects.get(token=token)
        self.client.force_login(user_for(self.owner))
        inbox = self.client.get("/api/owner/conversations/").json()
        self.assertEqual(inbox["unread"], 1)
        self.assertEqual(self.client.get("/api/owner/summary/").json()["unread_messages"], 1)
        self.client.get(f"/api/owner/conversations/{c.pk}/")
        self.assertEqual(self.client.get("/api/owner/conversations/").json()["unread"], 0)
        mail.outbox.clear()
        res = self.client.post(f"/api/owner/conversations/{c.pk}/", {"body": "Yes, it is free."}, content_type="application/json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(mail.outbox[0].to, ["lukas@example.com"])  # guest hears about the reply, in Swedish
        self.assertIn("Nytt svar", mail.outbox[0].subject)
        guest_view = self.client.get(f"/api/conversations/{token}/").json()
        self.assertEqual(guest_view["messages"][-1], {**guest_view["messages"][-1], "sender": "host", "body": "Yes, it is free."})

    def test_archive_and_new_message_brings_it_back(self):
        token = self.enquire().json()["token"]
        c = Conversation.objects.get(token=token)
        self.client.force_login(user_for(self.owner))
        self.client.patch(f"/api/owner/conversations/{c.pk}/", {"archived": True}, content_type="application/json")
        c.refresh_from_db()
        self.assertTrue(c.archived)
        self.client.logout()
        self.client.post(f"/api/conversations/{token}/", {"body": "Hello again"}, content_type="application/json")
        c.refresh_from_db()
        self.assertFalse(c.archived)

    def test_reply_on_a_booking_site_thread_does_not_email_the_guest(self):
        c = Conversation.objects.create(cottage=self.cottage, channel="airbnb", guest_name="Emma", token="t" * 32)
        Message.objects.create(conversation=c, sender="guest", body="Hi")
        self.client.force_login(user_for(self.owner))
        self.client.post(f"/api/owner/conversations/{c.pk}/", {"body": "Hello Emma"}, content_type="application/json")
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(self.client.get(f"/api/conversations/{c.token}/").status_code, 404)  # no guest link for site threads

    def test_owners_only_see_their_own_conversations(self):
        token = self.enquire().json()["token"]
        c = Conversation.objects.get(token=token)
        other = Owner.objects.create(name="Other", email="other@example.com")
        self.client.force_login(user_for(other))
        self.assertEqual(self.client.get("/api/owner/conversations/").json()["results"], [])
        self.assertEqual(self.client.get(f"/api/owner/conversations/{c.pk}/").status_code, 404)
        self.assertEqual(self.client.post(f"/api/owner/conversations/{c.pk}/", {"body": "x"}, content_type="application/json").status_code, 404)
        self.client.logout()
        self.assertEqual(self.client.get("/api/owner/conversations/").status_code, 403)

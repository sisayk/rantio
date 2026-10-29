from datetime import date, timedelta
from decimal import Decimal

from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse

from .booking_emails import ingest, parse
from .models import Booking, Cottage, InboundEmail, Owner

TODAY = date.today()
IN = TODAY + timedelta(days=60)
OUT = IN + timedelta(days=5)


def d(day: date) -> str:
    return f"{day.day}.{day.month}.{day.year}"


def raw(to: str, subject: str, body: str, frm: str = "noreply@nettimokki.com", mid: str = "<a1@nettimokki.com>") -> str:
    return (f"From: Nettimökki <{frm}>\r\nTo: {to}\r\nSubject: {subject}\r\nMessage-ID: {mid}\r\n"
            f"Content-Type: text/plain; charset=utf-8\r\n\r\n{body}")


FINNISH = (
    "Hei Maija,\n\nolet saanut uuden varauksen kohteeseen Järvimökki.\n\n"
    "Varausnumero: NM-48213\nSaapuminen: {ci}\nLähtö: {co}\nHenkilömäärä: 4\nYhteensä: 1 050,00 €\n\n"
    "Peruutusehdot: katso kohteen sivu.\n"
)


@override_settings(SIGNUP_NOTIFY_EMAILS=["team@stugora.fi"], SITE_URL="https://stugora.fi")
class BookingEmailTests(TestCase):
    def setUp(self):
        self.owner = Owner.objects.create(name="Maija", email="maija@example.fi", language="fi")
        self.cottage = Cottage.objects.create(owner=self.owner, name="Järvimökki", max_guests=6, price_per_night=150)

    def test_parse_labelled_finnish_email(self):
        p = parse("Uusi varaus", FINNISH.format(ci=d(IN), co=d(OUT)))
        self.assertEqual((p.kind, p.check_in, p.check_out, p.guests, p.reference), ("booking", IN, OUT, 4, "NM-48213"))
        self.assertEqual(p.amount, Decimal("1050.00"))

    def test_parse_range_and_unclear(self):
        p = parse(f"Varauspyyntö {IN.day}.{IN.month}.–{d(OUT)}", "3 henkilöä")
        self.assertEqual((p.check_in, p.check_out, p.guests), (IN, OUT, 3))
        self.assertEqual(parse("Hei", "Kiitos viestistä!").kind, "unclear")
        self.assertEqual(parse("Hei", f"{d(IN)} {d(OUT)} {d(OUT + timedelta(days=3))}").kind, "unclear")

    def test_forwarded_email_blocks_dates_and_alerts_owner(self):
        with self.captureOnCommitCallbacks(execute=True):
            email = ingest(raw(self.cottage.forwarding_address, "Uusi varaus", FINNISH.format(ci=d(IN), co=d(OUT))))
        self.assertEqual(email.status, InboundEmail.Status.BOOKED)
        b = email.booking
        self.assertEqual((b.cottage, b.channel, b.check_in, b.check_out, b.external_id), (self.cottage, "nettimokki", IN, OUT, "NM-48213"))
        self.assertFalse(b.is_chargeable)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ["maija@example.fi"])
        self.assertIn("Uusi varaus: Järvimökki", mail.outbox[0].subject)
        self.assertIn("Estämme nämä päivät", mail.outbox[0].body)

    def test_same_email_twice_is_one_booking(self):
        r = raw(self.cottage.forwarding_address, "Uusi varaus", FINNISH.format(ci=d(IN), co=d(OUT)))
        ingest(r)
        second = ingest(r)
        self.assertEqual(second.status, InboundEmail.Status.DUPLICATE)
        self.assertEqual(Booking.objects.count(), 1)

    def test_owner_forwarding_by_hand_is_recognised(self):
        body = "---------- Forwarded message ---------\n" + FINNISH.format(ci=d(IN), co=d(OUT))
        email = ingest(raw("bookings@stugora.fi", "Fwd: Uusi varaus", body, frm="maija@example.fi", mid="<x@gmail.com>"))
        self.assertEqual((email.status, email.cottage), (InboundEmail.Status.BOOKED, self.cottage))

    def test_unknown_sender_needs_a_look(self):
        email = ingest(raw("bookings@stugora.fi", "Uusi varaus", FINNISH.format(ci=d(IN), co=d(OUT)), frm="x@y.fi"))
        self.assertEqual(email.status, InboundEmail.Status.REVIEW)
        self.assertFalse(Booking.objects.exists())

    def test_cancellation_cancels_the_booking(self):
        ingest(raw(self.cottage.forwarding_address, "Uusi varaus", FINNISH.format(ci=d(IN), co=d(OUT))))
        email = ingest(raw(self.cottage.forwarding_address, "Varaus peruttu",
                           "Varaus on peruttu.\nVarausnumero: NM-48213\n", mid="<c1@nettimokki.com>"))
        self.assertEqual(email.status, InboundEmail.Status.CANCELLED)
        self.assertTrue(Booking.objects.get().cancelled)

    def test_overlap_is_flagged_to_owner_and_team(self):
        Booking.objects.create(cottage=self.cottage, channel="airbnb", check_in=IN + timedelta(days=2),
                               check_out=OUT + timedelta(days=2), owner_payout=600)
        mail.outbox.clear()
        with self.captureOnCommitCallbacks(execute=True):
            email = ingest(raw(self.cottage.forwarding_address, "Uusi varaus", FINNISH.format(ci=d(IN), co=d(OUT))))
        self.assertEqual(email.status, InboundEmail.Status.CONFLICT)
        self.assertIn("Huomio", mail.outbox[0].body)
        self.assertEqual(mail.outbox[1].to, ["team@stugora.fi"])

    def test_airbnb_booking_reminds_owner_about_nettimokki(self):
        with self.captureOnCommitCallbacks(execute=True):
            Booking.objects.create(cottage=self.cottage, channel="airbnb", check_in=IN, check_out=OUT, owner_payout=600)
        self.assertIn("myös Nettimökissä", mail.outbox[0].body)

    def test_past_stays_send_no_alert(self):
        with self.captureOnCommitCallbacks(execute=True):
            Booking.objects.create(cottage=self.cottage, channel="airbnb", check_in=TODAY - timedelta(days=30),
                                   check_out=TODAY - timedelta(days=25), owner_payout=600)
        self.assertEqual(mail.outbox, [])

    @override_settings(INBOUND_EMAIL_SECRET="s3cret")
    def test_webhook(self):
        url = reverse("inbound-booking-email")
        r = raw(self.cottage.forwarding_address, "Uusi varaus", FINNISH.format(ci=d(IN), co=d(OUT)))
        self.assertEqual(self.client.post(url, r, content_type="message/rfc822").status_code, 403)
        res = self.client.post(url, r, content_type="message/rfc822", HTTP_X_STUGORA_SECRET="s3cret")
        self.assertEqual(res.json()["status"], "booked")
        res = self.client.post(url + "?secret=s3cret", {"body-mime": r.replace("a1@", "a2@")})
        self.assertEqual(res.json()["status"], "duplicate")  # same stay, second email

    def test_webhook_off_without_secret(self):
        self.assertEqual(self.client.post(reverse("inbound-booking-email"), "x", content_type="text/plain").status_code, 404)

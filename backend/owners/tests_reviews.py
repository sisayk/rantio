import secrets
from decimal import Decimal

from django.core import mail
from django.test import TestCase

from . import login as owner_login
from . import reviews
from .models import Booking, Conversation, ExternalRating, RequestStatus, Review
from .tests_calendar import D, make_cottage


class ReviewTests(TestCase):
    def setUp(self):
        self.c = make_cottage()
        self.c.booking_link_token = "link-1"
        self.c.save()

    def stay(self, check_in=-5, check_out=-2, status=RequestStatus.ACCEPTED, cancelled=False, email="sam@example.com"):
        b = Booking.objects.create(cottage=self.c, channel=Booking.Channel.OWNER, check_in=D(check_in), check_out=D(check_out),
                                   guests=2, owner_payout=Decimal("400.00"), cancelled=cancelled, external_id=secrets.token_hex(4))
        return Conversation.objects.create(
            cottage=self.c, channel="direct", guest_name="Sam Guest", guest_email=email, guest_language="en",
            check_in=b.check_in, check_out=b.check_out, token=secrets.token_urlsafe(12), request_status=status, booking=b,
        )

    def post(self, conv, **body):
        return self.client.post(f"/api/reviews/{conv.token}/", {"rating": 5, **body}, content_type="application/json")

    def test_a_guest_who_stayed_can_review_once(self):
        conv = self.stay()
        page = self.client.get(f"/api/reviews/{conv.token}/").json()
        self.assertTrue(page["can_review"])
        res = self.post(conv, cleanliness=4, comment="Lovely sauna.")
        self.assertEqual(res.status_code, 201, res.content)
        self.assertEqual(res.json()["review"]["comment"], "Lovely sauna.")
        self.assertEqual(self.post(conv).json()["detail"], "already_reviewed")
        self.assertIn("Järvihuvila: 5/5", mail.outbox[-1].subject)  # in the owner's Finnish

    def test_no_review_before_the_stay_ends_or_without_an_accepted_booking(self):
        self.assertEqual(self.post(self.stay(check_in=1, check_out=4)).status_code, 400)
        self.assertEqual(self.post(self.stay(status=RequestStatus.PENDING)).status_code, 400)
        self.assertEqual(self.post(self.stay(cancelled=True)).status_code, 400)
        late = self.stay(check_in=-80, check_out=-70)
        self.assertEqual(self.client.get(f"/api/reviews/{late.token}/").json()["reason"], "too_late")
        self.assertEqual(Review.objects.count(), 0)

    def test_the_booking_page_shows_the_average_and_scores_elsewhere(self):
        self.post(self.stay(), rating=5, value=5)
        self.post(self.stay(check_in=-9, check_out=-7), rating=4, value=4)
        hidden = self.stay(check_in=-12, check_out=-10)
        self.post(hidden, rating=1)
        Review.objects.filter(conversation=hidden).update(hidden=True)
        self.client.force_login(owner_login.user_for(self.c.owner))
        res = self.client.post(f"/api/owner/cottages/{self.c.pk}/ratings/",
                               {"url": "https://www.booking.com/hotel/fi/x.html", "score": "9.4", "count": 120},
                               content_type="application/json")
        self.assertEqual(res.status_code, 201, res.content)
        self.client.logout()
        r = self.client.get("/api/book/link-1/").json()["ratings"]
        self.assertEqual((r["count"], r["average"], r["categories"]["value"]), (2, 4.5, 4.5))
        self.assertEqual([(e["name"], e["score"], e["scale"], e["count"]) for e in r["external"]], [("Booking.com", 9.4, 10, 120)])

    def test_scores_need_the_listing_on_that_site_and_a_score_on_its_scale(self):
        self.client.force_login(owner_login.user_for(self.c.owner))
        url = f"/api/owner/cottages/{self.c.pk}/ratings/"
        bad = self.client.post(url, {"url": "https://example.com/x", "score": "4.9", "count": 3}, content_type="application/json")
        self.assertEqual(bad.json()["url"], ["unknown_site"])
        high = self.client.post(url, {"url": "https://www.airbnb.fi/rooms/1", "score": "9", "count": 3}, content_type="application/json")
        self.assertEqual(high.json()["score"], ["too_high"])
        ok = self.client.post(url, {"url": "https://www.airbnb.fi/rooms/1", "score": "4.9", "count": 87}, content_type="application/json")
        again = self.client.post(url, {"url": "https://www.airbnb.com/rooms/1", "score": "4.8", "count": 90}, content_type="application/json")
        self.assertEqual(ok.json()["id"], again.json()["id"])  # one score per site, replaced
        self.assertEqual(self.client.delete(f"/api/owner/ratings/{ok.json()['id']}/").status_code, 204)

    def test_the_owner_replies_and_another_owner_cant(self):
        self.post(self.stay())
        review = Review.objects.get()
        self.client.force_login(owner_login.user_for(self.c.owner))
        res = self.client.patch(f"/api/owner/reviews/{review.pk}/", {"reply": "Thank you, Sam!"}, content_type="application/json")
        self.assertEqual(res.json()["reply"], "Thank you, Sam!")
        listed = self.client.get(f"/api/owner/cottages/{self.c.pk}/reviews/").json()
        self.assertEqual((listed["count"], listed["average"]), (1, 5.0))
        other = make_cottage(email="other@example.fi").owner
        self.client.force_login(owner_login.user_for(other))
        self.assertEqual(self.client.patch(f"/api/owner/reviews/{review.pk}/", {"reply": "x"}, content_type="application/json").status_code, 404)

    def test_guests_are_asked_once_the_day_after_check_out(self):
        asked = self.stay(check_in=-4, check_out=-1)
        self.stay(check_in=-1, check_out=2)  # still there
        self.stay(check_in=-40, check_out=-30)  # too long ago
        mail.outbox.clear()
        self.assertEqual(reviews.ask_for_reviews(), 1)
        self.assertEqual(mail.outbox[0].to, ["sam@example.com"])
        self.assertIn(f"/en/review/{asked.token}", mail.outbox[0].body)
        self.assertEqual(reviews.ask_for_reviews(), 0)

    def test_the_guest_thread_offers_the_review(self):
        conv = self.stay()
        self.assertTrue(self.client.get(f"/api/conversations/{conv.token}/").json()["can_review"])


class CottageAboutTests(TestCase):
    """The top of a cottage's page: only real reviews, Guest favourite by Rantio's rule, the real host."""

    stay = ReviewTests.stay
    post = ReviewTests.post

    def setUp(self):
        ReviewTests.setUp(self)
        self.c.listing_slug = "lakeside-villa"
        self.c.save()

    def about(self, slug="lakeside-villa"):
        return self.client.get(f"/api/cottages/{slug}/about/")

    def test_an_example_cottage_has_nothing_to_show(self):
        self.assertEqual(self.about("arctic-cabin").status_code, 404)  # no Rantio cottage behind it
        self.c.status = "paused"
        self.c.save()
        self.assertEqual(self.about().status_code, 404)  # not shown while paused

    def test_a_new_cottage_shows_its_host_but_no_rating(self):
        r = self.about().json()
        self.assertEqual((r["ratings"]["count"], r["ratings"]["average"], r["guest_favourite"]), (0, None, False))
        self.assertEqual(r["host"]["name"], "Aino")  # first name only
        self.assertNotIn("email", r["host"])
        self.assertNotIn("Järvinen", str(r))

    def test_guest_favourite_needs_five_reviews_averaging_4_8(self):
        for i in range(4):
            self.post(self.stay(check_in=-5 - 4 * i, check_out=-3 - 4 * i), rating=5)
        self.assertFalse(self.about().json()["guest_favourite"])  # 4 reviews: not yet
        self.post(self.stay(check_in=-30, check_out=-28), rating=4)
        r = self.about().json()
        self.assertEqual((r["ratings"]["count"], r["ratings"]["average"], r["guest_favourite"]), (5, 4.8, True))
        self.post(self.stay(check_in=-40, check_out=-38), rating=3)
        self.assertFalse(self.about().json()["guest_favourite"])  # 4.5 now

    def test_scores_from_other_sites_never_make_a_guest_favourite(self):
        ExternalRating.objects.create(cottage=self.c, site="airbnb", score=Decimal("4.9"), count=80, url="https://www.airbnb.com/rooms/123")
        r = self.about().json()
        self.assertEqual([(e["name"], e["score"], e["count"]) for e in r["ratings"]["external"]], [("Airbnb", 4.9, 80)])
        self.assertFalse(r["guest_favourite"])

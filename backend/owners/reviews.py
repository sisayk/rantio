"""Ratings: guests' reviews of stays booked through Rantio, and the cottage's scores on other sites.

A review can only come from a real stay. The guest opens the form with the private link of their
booking conversation, and only once the owner has accepted the request and the stay has ended.
The day after check-out Rantio emails that link (manage.py send_review_requests).

Scores from other sites are what the owner types in, with the address of the listing there, so
guests can check them. Rantio shows only the score and the number of reviews, never the reviews.
"""

import logging
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.core.mail import send_mail
from django.db.models import Avg
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import app
from .listing_links import SITES, detect_site
from .models import Conversation, Cottage, ExternalRating, RequestStatus, Review
from .portal import IsOwner

logger = logging.getLogger(__name__)

REVIEW_DAYS = 60  # how long after check-out the guest can still write one
ASK_WITHIN_DAYS = 14  # stays that ended longer ago than this aren't asked any more
SHOWN = 30  # newest reviews on the cottage's page

# The sites whose scores can be shown, and their scale. Booking.com scores out of 10.
RATING_SITES = ("airbnb", "booking", "vrbo", "expedia", "agoda", "nettimokki", "lomarengas", "mokkivuokra",
                "holidu", "hometogo", "novasol", "stugsommar", "finn", "inatur", "dancenter", "sologstrand")
SCALE = {"booking": 10}


# --- Emails -------------------------------------------------------------------------------------

GUEST_ASK = {
    "en": ("How was your stay at {cottage}?", "Hi {name},\n\nthank you for staying at {cottage}. How was it? A rating takes a minute and helps the next guests, and {host}:\n{link}\n\nRantio"),
    "fi": ("Millainen oli vierailusi kohteessa {cottage}?", "Hei {name},\n\nkiitos, että vierailit kohteessa {cottage}. Millaista oli? Arvion antaminen vie minuutin. Se auttaa seuraavia vieraita, ja {host} saa siitä arvokasta palautetta:\n{link}\n\nRantio"),
    "sv": ("Hur var din vistelse på {cottage}?", "Hej {name},\n\ntack för att du bodde på {cottage}. Hur var det? Att sätta betyg tar en minut och hjälper nästa gäster, och {host}:\n{link}\n\nRantio"),
    "nb": ("Hvordan var oppholdet på {cottage}?", "Hei {name},\n\ntakk for at du bodde på {cottage}. Hvordan var det? En vurdering tar ett minutt og hjelper de neste gjestene, og {host}:\n{link}\n\nRantio"),
    "nn": ("Korleis var opphaldet på {cottage}?", "Hei {name},\n\ntakk for at du budde på {cottage}. Korleis var det? Ei vurdering tek eitt minutt og hjelper dei neste gjestene, og {host}:\n{link}\n\nRantio"),
    "da": ("Hvordan var dit ophold på {cottage}?", "Hej {name},\n\ntak, fordi du boede på {cottage}. Hvordan var det? En bedømmelse tager et minut og hjælper de næste gæster, og {host}:\n{link}\n\nRantio"),
    "is": ("Hvernig var dvölin í {cottage}?", "Hæ {name},\n\ntakk fyrir að gista í {cottage}. Hvernig var? Það tekur mínútu að gefa einkunn. Það hjálpar næstu gestum, og {host} fær að vita hvernig til tókst:\n{link}\n\nRantio"),
    "et": ("Kuidas sulle {cottage} meeldis?", "Tere {name},\n\naitäh külastuse eest! Kuidas sulle {cottage} meeldis? Hinnangu andmine võtab minuti. See aitab järgmisi külalisi ja {host} saab sinult tagasisidet:\n{link}\n\nRantio"),
    "lv": ("Kā jums patika {cottage}?", "Sveiki, {name}!\n\nPaldies par uzturēšanos! Kā jums patika {cottage}? Novērtējums aizņem minūti. Tas palīdz nākamajiem viesiem, un arī {host} uzzinās jūsu domas:\n{link}\n\nRantio"),
    "lt": ("Kaip Jums patiko {cottage}?", "Sveiki, {name},\n\načiū už viešnagę! Kaip Jums patiko {cottage}? Įvertinimas užtruks minutę. Jis padės kitiems svečiams, o {host} sužinos Jūsų nuomonę:\n{link}\n\nRantio"),
    "de": ("Wie war dein Aufenthalt in {cottage}?", "Hallo {name},\n\ndanke, dass du in {cottage} zu Gast warst. Wie war es? Eine Bewertung dauert eine Minute und hilft den nächsten Gästen und {host}:\n{link}\n\nRantio"),
}
OWNER_REVIEWED = {
    "en": ("New review for {cottage}: {rating}/5", "{name} rated their stay at {cottage} {rating}/5.\n\n“{comment}”\n\nRead it and reply in Rantio:\n{link}"),
    "fi": ("Uusi arvostelu kohteelle {cottage}: {rating}/5", "{name} arvioi vierailunsa kohteessa {cottage}: {rating}/5.\n\n”{comment}”\n\nLue ja vastaa Rantiossa:\n{link}"),
    "sv": ("Nytt omdöme om {cottage}: {rating}/5", "{name} gav sin vistelse på {cottage} betyget {rating}/5.\n\n”{comment}”\n\nLäs och svara i Rantio:\n{link}"),
    "nb": ("Ny omtale av {cottage}: {rating}/5", "{name} ga oppholdet på {cottage} {rating}/5.\n\n«{comment}»\n\nLes og svar i Rantio:\n{link}"),
    "nn": ("Ny omtale av {cottage}: {rating}/5", "{name} gav opphaldet på {cottage} {rating}/5.\n\n«{comment}»\n\nLes og svar i Rantio:\n{link}"),
    "da": ("Ny anmeldelse af {cottage}: {rating}/5", "{name} gav sit ophold på {cottage} {rating}/5.\n\n»{comment}«\n\nLæs og svar i Rantio:\n{link}"),
    "is": ("Ný umsögn um {cottage}: {rating}/5", "{name} gaf dvölinni í {cottage} {rating}/5.\n\n„{comment}“\n\nLestu og svaraðu í Rantio:\n{link}"),
    "et": ("Uus arvustus: {cottage}, {rating}/5", "{name} hindas oma külastust ({cottage}): {rating}/5.\n\n„{comment}“\n\nLoe ja vasta Rantios:\n{link}"),
    "lv": ("Jauna atsauksme: {cottage}, {rating}/5", "{name} novērtēja savu uzturēšanos ({cottage}): {rating}/5.\n\n“{comment}”\n\nIzlasiet un atbildiet Rantio:\n{link}"),
    "lt": ("Naujas atsiliepimas: {cottage}, {rating}/5", "{name} įvertino savo viešnagę ({cottage}): {rating}/5.\n\n„{comment}“\n\nPerskaitykite ir atsakykite Rantio:\n{link}"),
    "de": ("Neue Bewertung für {cottage}: {rating}/5", "{name} hat den Aufenthalt in {cottage} mit {rating}/5 bewertet.\n\n„{comment}“\n\nLies sie und antworte in Rantio:\n{link}"),
}
OWNER_PUSH = {
    "en": "New review: {rating}/5 from {name}",
    "fi": "Uusi arvostelu: {name} antoi {rating}/5",
    "sv": "Nytt omdöme: {rating}/5 från {name}",
    "nb": "Ny omtale: {rating}/5 fra {name}",
    "nn": "Ny omtale: {rating}/5 frå {name}",
    "da": "Ny anmeldelse: {rating}/5 fra {name}",
    "is": "Ný umsögn: {name} gaf {rating}/5",
    "et": "Uus arvustus: {name} andis {rating}/5",
    "lv": "Jauna atsauksme: {name} novērtēja ar {rating}/5",
    "lt": "Naujas atsiliepimas: {name} įvertino {rating}/5",
    "de": "Neue Bewertung: {rating}/5 von {name}",
}


def _send(templates: dict, lang: str, to: list[str], **values) -> None:
    subject, body = templates.get(lang) or templates["en"]
    try:
        send_mail(subject.format(**values), body.format(**values), settings.DEFAULT_FROM_EMAIL, to)
    except Exception:  # a mail outage must not lose the review
        logger.exception("Could not send a review email to %s", to)


# --- Who can review ------------------------------------------------------------------------------

def review_link(c: Conversation) -> str:
    return f"{settings.SITE_URL}/{c.guest_language}/review/{c.token}"


def stay_of(c: Conversation):
    """The booking of an accepted request, or None."""
    b = c.booking
    if c.request_status != RequestStatus.ACCEPTED or not b or b.cancelled:
        return None
    return b


def can_review(c: Conversation, today: date | None = None) -> bool:
    today = today or timezone.localdate()
    b = stay_of(c)
    if not b or hasattr(c, "review"):
        return False
    return b.check_out <= today <= b.check_out + timedelta(days=REVIEW_DAYS)


def ask_for_reviews(today: date | None = None) -> int:
    """Emails each guest whose stay ended yesterday (or up to two weeks ago, if missed) a link to rate it."""
    today = today or timezone.localdate()
    due = Conversation.objects.filter(
        request_status=RequestStatus.ACCEPTED, booking__cancelled=False, review_asked_at__isnull=True,
        booking__check_out__lt=today, booking__check_out__gte=today - timedelta(days=ASK_WITHIN_DAYS),
        review__isnull=True,
    ).exclude(guest_email="").select_related("cottage__owner", "booking")
    sent = 0
    for c in due:
        host = c.cottage.owner.name.split()[0] if c.cottage and c.cottage.owner.name else "Rantio"
        _send(GUEST_ASK, c.guest_language, [c.guest_email], name=c.guest_name.split()[0], cottage=c.cottage.name,
              host=host, link=review_link(c))
        Conversation.objects.filter(pk=c.pk).update(review_asked_at=timezone.now())
        sent += 1
    return sent


# --- What guests see -----------------------------------------------------------------------------

def _avg(qs, field: str) -> float | None:
    v = qs.exclude(**{f"{field}__isnull": True}).aggregate(a=Avg(field))["a"]
    return float(Decimal(v).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)) if v is not None else None


def external_row(r: ExternalRating) -> dict:
    return {"id": r.pk, "site": r.site, "name": SITES.get(r.site, r.site), "score": float(r.score), "scale": r.scale,
            "count": r.count, "url": r.url}


def review_row(r: Review, owner: bool = False) -> dict:
    row = {
        "id": r.pk,
        "name": r.conversation.guest_name.split()[0] if r.conversation.guest_name else "",
        "rating": r.rating,
        "cleanliness": r.cleanliness,
        "location": r.location,
        "value": r.value,
        "comment": r.comment,
        "language": r.language,
        "stayed": r.conversation.booking.check_in.isoformat()[:7] if r.conversation.booking else r.created_at.date().isoformat()[:7],
        "reply": r.owner_reply,
        "created_at": r.created_at.isoformat(),
    }
    if owner:
        row["hidden"] = r.hidden
    return row


def summary(cottage: Cottage) -> dict:
    """The cottage's ratings for its public page: Rantio's own reviews and its scores elsewhere."""
    qs = cottage.reviews.filter(hidden=False)
    count = qs.count()
    newest = qs.select_related("conversation__booking")[:SHOWN]
    return {
        "count": count,
        "average": _avg(qs, "rating") if count else None,
        "categories": {k: _avg(qs, k) for k in ("cleanliness", "location", "value")} if count else None,
        "reviews": [review_row(r) for r in newest],
        "external": [external_row(r) for r in cottage.external_ratings.all()],
    }


# --- Guest: write a review -----------------------------------------------------------------------

class ReviewSerializer(serializers.Serializer):
    rating = serializers.IntegerField(min_value=1, max_value=5)
    cleanliness = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    location = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    value = serializers.IntegerField(min_value=1, max_value=5, required=False, allow_null=True)
    comment = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class GuestReviewView(APIView):
    """GET what the review page needs; POST the review. Opened with the conversation's private link."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "guest-message"

    def get_throttles(self):
        return super().get_throttles() if self.request.method == "POST" else []

    def conversation(self, token: str) -> Conversation:
        return get_object_or_404(
            Conversation.objects.select_related("cottage__owner", "booking"), token=token, channel="direct"
        )

    def answer(self, c: Conversation) -> dict:
        b = stay_of(c)
        review = getattr(c, "review", None)
        return {
            "cottage": c.cottage.name if c.cottage else "",
            "host": c.cottage.owner.name.split()[0] if c.cottage and c.cottage.owner.name else "",
            "name": c.guest_name.split()[0] if c.guest_name else "",
            "check_in": b.check_in.isoformat() if b else None,
            "check_out": b.check_out.isoformat() if b else None,
            "can_review": can_review(c),
            # Why not, when it can't: not_stayed (not accepted or not over yet), too_late.
            "reason": None if can_review(c) or review else ("too_late" if b and b.check_out < timezone.localdate() else "not_stayed"),
            "review": review_row(review) if review else None,
        }

    def get(self, request, token):
        return Response(self.answer(self.conversation(token)))

    def post(self, request, token):
        c = self.conversation(token)
        if hasattr(c, "review"):
            return Response({"detail": "already_reviewed"}, status=status.HTTP_400_BAD_REQUEST)
        if not can_review(c):
            return Response({"detail": "not_allowed"}, status=status.HTTP_400_BAD_REQUEST)
        data = ReviewSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        r = Review.objects.create(
            conversation=c, cottage=c.cottage, rating=v["rating"], cleanliness=v.get("cleanliness"),
            location=v.get("location"), value=v.get("value"), comment=v.get("comment", "").strip(),
            language=c.guest_language,
        )
        c.review = r
        owner = c.cottage.owner
        name = c.guest_name.split()[0] if c.guest_name else ""
        comment = r.comment[:300] + ("…" if len(r.comment) > 300 else "")
        _send(OWNER_REVIEWED, owner.language, [owner.email], name=name, cottage=c.cottage.name, rating=r.rating,
              comment=comment or "-", link=f"{settings.SITE_URL}/{owner.language}/hosting/listings/{c.cottage_id}#reviews")
        push = OWNER_PUSH.get(owner.language) or OWNER_PUSH["en"]
        app.notify(owner, push.format(rating=r.rating, name=name), c.cottage.name, {"type": "review", "cottage": c.cottage_id})
        return Response(self.answer(c), status=status.HTTP_201_CREATED)


# --- Owner: read, reply, scores from other sites -------------------------------------------------

def owner_view(cottage: Cottage) -> dict:
    qs = cottage.reviews.select_related("conversation__booking")
    shown = cottage.reviews.filter(hidden=False)
    count = shown.count()
    return {
        "count": count,
        "average": _avg(shown, "rating") if count else None,
        "reviews": [review_row(r, owner=True) for r in qs],
        "external": [external_row(r) for r in cottage.external_ratings.all()],
        "sites": [{"site": s, "name": SITES[s], "scale": SCALE.get(s, 5)} for s in RATING_SITES],
    }


class OwnerReviewsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request, pk):
        cottage = get_object_or_404(Cottage, pk=pk, owner=request.user.owner)
        return Response(owner_view(cottage))


class ReplySerializer(serializers.Serializer):
    reply = serializers.CharField(max_length=1000, allow_blank=True)


class OwnerReplyView(APIView):
    """PATCH {reply}: the owner's public answer to a review (empty removes it)."""

    permission_classes = [IsOwner]

    def patch(self, request, pk):
        r = get_object_or_404(Review.objects.select_related("conversation__booking"), pk=pk, cottage__owner=request.user.owner)
        data = ReplySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        r.owner_reply = data.validated_data["reply"].strip()
        r.replied_at = timezone.now() if r.owner_reply else None
        r.save(update_fields=["owner_reply", "replied_at"])
        return Response(review_row(r, owner=True))


class RatingSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=500)
    score = serializers.DecimalField(max_digits=3, decimal_places=1, min_value=Decimal("1"))
    count = serializers.IntegerField(min_value=1, max_value=100000)

    def validate_url(self, url: str) -> str:
        if not url.lower().startswith("https://"):
            raise serializers.ValidationError("https")
        if detect_site(url) not in RATING_SITES:
            raise serializers.ValidationError("unknown_site")
        return url

    def validate(self, data):
        site = detect_site(data["url"])
        if data["score"] > SCALE.get(site, 5):
            raise serializers.ValidationError({"score": ["too_high"]})
        data["site"] = site
        return data


class OwnerRatingsView(APIView):
    """POST {url, score, count}: the cottage's score on the site the address is on (replaces an earlier one)."""

    permission_classes = [IsOwner]

    def post(self, request, pk):
        cottage = get_object_or_404(Cottage, pk=pk, owner=request.user.owner)
        data = RatingSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        r, _ = ExternalRating.objects.update_or_create(
            cottage=cottage, site=v["site"],
            defaults={"score": v["score"], "scale": SCALE.get(v["site"], 5), "count": v["count"], "url": v["url"]},
        )
        return Response(external_row(r), status=status.HTTP_201_CREATED)


class OwnerRatingView(APIView):
    permission_classes = [IsOwner]

    def delete(self, request, pk):
        get_object_or_404(ExternalRating, pk=pk, cottage__owner=request.user.owner).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

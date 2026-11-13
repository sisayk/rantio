"""Calendar and booking-request API.

Public (no sign-in, the token in the link is the key):
  GET  /api/calendar/<token>.ics       the cottage's busy dates, for Airbnb, Booking.com, Vrbo
  GET  /api/book/<token>/              what a guest needs to choose dates
  GET  /api/book/<token>/quote/?check_in=&check_out=   the stay's price, night by night
  POST /api/book/<token>/              send a booking request
Owner (signed in):
  GET  /api/owner/calendar/            every cottage's calendar, requests and site links
  POST /api/owner/calendar/blocks/     close dates;  DELETE …/blocks/<id>/ opens them again
  POST /api/owner/calendar/feeds/      add or change a site's calendar link; DELETE …/feeds/<id>/
  PATCH/POST /api/owner/cottages/<id>/booking-link/   open or close the link / make a new one
  POST /api/owner/conversations/<id>/accept/ and …/decline/   answer a booking request
"""

from datetime import date, timedelta
from decimal import Decimal

from django.http import Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.http import require_GET
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import booking_requests, calendar, limits, messaging, pricing, reviews
from .booking_requests import RequestError
from .calendar import FEED_CHANNELS, FeedError
from .models import Booking, CalendarBlock, CalendarFeed, Conversation, Cottage, Language, RequestStatus, new_link_token
from .portal import IsOwner

MAX_MONTHS = 13


def money(value: Decimal) -> str:
    return f"{value:.2f}"


# ---------- public ----------

@require_GET
def calendar_export(request, token: str):
    cottage = Cottage.objects.filter(calendar_token=token).first()
    if not cottage:
        raise Http404
    site = request.GET.get("site", "")
    body = calendar.export_ics(cottage, site if site in Booking.Channel.values else "")
    response = HttpResponse(body, content_type="text/calendar; charset=utf-8")
    response["Cache-Control"] = "no-store"
    response["Content-Disposition"] = f'inline; filename="stugora-{cottage.pk}.ics"'
    return response


class RequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=120, trim_whitespace=True)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=40, required=False, allow_blank=True, trim_whitespace=True)
    lang = serializers.ChoiceField(choices=Language.values, default=Language.ENGLISH)
    check_in = serializers.DateField()
    check_out = serializers.DateField()
    adults = serializers.IntegerField(min_value=1, max_value=30)
    children = serializers.IntegerField(min_value=0, max_value=20, default=0)
    body = serializers.CharField(max_length=4000, trim_whitespace=True)
    website = serializers.CharField(required=False, allow_blank=True)  # honeypot

    def validate(self, attrs):
        if attrs.pop("website", ""):
            raise serializers.ValidationError("Invalid submission.")
        if attrs["check_out"] <= attrs["check_in"]:
            raise serializers.ValidationError({"check_out": "Check-out must be after check-in."})
        attrs["email"] = attrs["email"].strip().lower()
        return attrs


def public_cottage(cottage: Cottage) -> dict:
    today = timezone.localdate()
    busy = calendar.busy_ranges(cottage, today, today + timedelta(days=booking_requests.BOOKABLE_DAYS_AHEAD))
    owner_name = cottage.owner.name.split()[0] if cottage.owner.name else ""
    return {
        "name": cottage.name,
        "municipality": cottage.municipality,
        "country": cottage.country,
        "listing_slug": cottage.listing_slug,
        "host": owner_name,
        "max_guests": cottage.max_guests,
        "min_nights": max(1, cottage.min_nights),
        "max_nights": booking_requests.MAX_NIGHTS,
        "price_per_night": money(cottage.price_per_night),
        "cleaning_fee": money(cottage.cleaning_fee),
        "currency": cottage.currency,
        "cancellation_policy": cottage.cancellation_policy,
        "long_stay_policy": cottage.long_stay_policy,
        "check_in_from": cottage.check_in_from.strftime("%H:%M") if cottage.check_in_from else None,
        "open": cottage.booking_requests_open and cottage.status not in (Cottage.Status.PAUSED, Cottage.Status.ARCHIVED),
        "today": today.isoformat(),
        "busy": [[s.isoformat(), e.isoformat()] for s, e in busy],
        "ratings": reviews.summary(cottage),
    }


class BookingLinkView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_scope = "booking-request"

    def get_throttles(self):  # looking is free; sending is limited
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    def get_cottage(self, token: str) -> Cottage:
        return get_object_or_404(Cottage.objects.select_related("owner"), booking_link_token=token)

    def get(self, request, token):
        return Response(public_cottage(self.get_cottage(token)))

    def post(self, request, token):
        cottage = self.get_cottage(token)
        data = RequestSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        try:
            c = booking_requests.create(
                cottage, name=v["name"], email=v["email"], phone=v.get("phone", ""), lang=v["lang"],
                check_in=v["check_in"], check_out=v["check_out"], adults=v["adults"], children=v["children"],
                text=v["body"],
            )
        except RequestError as exc:
            return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"token": c.token}, status=status.HTTP_201_CREATED)


class BookingQuoteView(APIView):
    """The price of a stay through the booking link, with each night's own price."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, token):
        cottage = get_object_or_404(Cottage, booking_link_token=token)
        try:
            check_in = date.fromisoformat(request.query_params.get("check_in", ""))
            check_out = date.fromisoformat(request.query_params.get("check_out", ""))
        except ValueError:
            return Response({"detail": "dates"}, status=status.HTTP_400_BAD_REQUEST)
        if not 0 < (check_out - check_in).days <= booking_requests.MAX_NIGHTS or not sane(check_in):
            return Response({"detail": "dates"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(pricing.quote(cottage, check_in, check_out))


# ---------- owner ----------

def own_cottages(request):
    return list(Cottage.objects.filter(owner=request.user.owner).select_related("owner").prefetch_related("feeds"))


def own_cottage(request, pk) -> Cottage:
    return get_object_or_404(Cottage.objects.select_related("owner"), pk=pk, owner=request.user.owner)


def feed_row(f: CalendarFeed) -> dict:
    return {
        "id": f.pk, "cottage_id": f.cottage_id, "channel": f.channel, "label": f.get_channel_display(), "url": f.url,
        "last_synced_at": f.last_synced_at.isoformat() if f.last_synced_at else None, "last_error": f.last_error,
    }


def cottage_row(c: Cottage) -> dict:
    return {
        "id": c.pk,
        "name": c.name,
        "status": c.status,
        "currency": c.currency,
        "price_per_night": money(c.price_per_night),
        "cleaning_fee": money(c.cleaning_fee),
        "min_nights": max(1, c.min_nights),
        "max_guests": c.max_guests,
        "booking_link": f"{calendar.settings.SITE_URL}/book/{c.booking_link_token}",
        "booking_requests_open": c.booking_requests_open,
        "forwarding_address": c.forwarding_address,
        "export": {ch: calendar.export_url(c, ch) for ch in FEED_CHANNELS} | {"all": calendar.export_url(c)},
        "feeds": [feed_row(f) for f in c.feeds.all()],
    }


def request_row(c: Conversation) -> dict:
    nights = (c.check_out - c.check_in).days
    first = c.messages.order_by("created_at", "pk").first()
    return {
        "id": c.pk,
        "cottage_id": c.cottage_id,
        "guest_name": c.guest_name,
        "guest_phone": c.guest_phone,
        "guest_language": c.guest_language,
        "check_in": c.check_in.isoformat(),
        "check_out": c.check_out.isoformat(),
        "nights": nights,
        "adults": c.guests or 1,
        "children": c.children,
        "message": first.body if first else "",
        "estimate": money(booking_requests.estimate(c.cottage, c.check_in, c.check_out)),
        "currency": c.cottage.currency,
        "free": calendar.is_free(c.cottage, c.check_in, c.check_out),
        "created_at": c.created_at.isoformat(),
    }


def sane(d: date) -> bool:
    """A date a calendar can show: year 1 or 9999 would overflow the sums around it."""
    return 2000 <= d.year <= 2100


def parse_month(value: str | None, today: date) -> date:
    try:
        d = date.fromisoformat(value) if value else today
    except ValueError:
        d = today
    return (d if sane(d) else today).replace(day=1)


def add_months(d: date, n: int) -> date:
    total = d.month - 1 + n
    return date(d.year + total // 12, total % 12 + 1, 1)


class OwnerCalendarView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        today = timezone.localdate()
        start = parse_month(request.query_params.get("from"), today)
        try:
            months = min(MAX_MONTHS, max(1, int(request.query_params.get("months", 2))))
        except ValueError:
            months = 2
        end = add_months(start, months)
        cottages = own_cottages(request)
        items = calendar.entries(cottages, start, end)
        clashes = calendar.conflicts(items)
        pending = (
            Conversation.objects.filter(cottage__in=cottages, request_status=RequestStatus.PENDING)
            .select_related("cottage")
            .order_by("check_in")
        )
        return Response({
            "today": today.isoformat(),
            "from": start.isoformat(),
            "to": end.isoformat(),
            "cottages": [cottage_row(c) for c in cottages],
            "entries": [e.as_dict() for e in items],
            "conflicts": [[f"{a.kind}-{a.id}", f"{b.kind}-{b.id}"] for a, b in clashes],
            "requests": [request_row(c) for c in pending],
            # Each night's price per cottage, for the calendar (owners/pricing.py).
            "prices": {
                str(c.pk): {
                    "currency": c.currency,
                    "smart_pricing": c.smart_pricing,
                    "nights": [
                        {"date": n.date.isoformat(), "price": f"{n.price:.2f}", "override": n.override,
                         "suggested": f"{n.suggested:.2f}", "reasons": n.reasons}
                        for n in pricing.nights(c, start, end)
                    ],
                }
                for c in cottages
            },
        })


class BlockSerializer(serializers.Serializer):
    cottage = serializers.IntegerField()
    start = serializers.DateField()
    end = serializers.DateField()
    note = serializers.CharField(max_length=200, required=False, allow_blank=True, trim_whitespace=True)

    def validate(self, attrs):
        if attrs["end"] <= attrs["start"]:
            raise serializers.ValidationError({"end": "The last day must be after the first."})
        if (attrs["end"] - attrs["start"]).days > 366:
            raise serializers.ValidationError({"end": "Close at most a year at a time."})
        return attrs


class OwnerBlocksView(APIView):
    permission_classes = [IsOwner]

    def post(self, request):
        data = BlockSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        cottage = own_cottage(request, v["cottage"])
        block = CalendarBlock.objects.create(cottage=cottage, start=v["start"], end=v["end"], note=v.get("note", ""))
        return Response({"id": block.pk}, status=status.HTTP_201_CREATED)


class OwnerBlockView(APIView):
    permission_classes = [IsOwner]

    def delete(self, request, pk):
        # Only dates the owner closed; a site's dates change on that site.
        block = get_object_or_404(CalendarBlock, pk=pk, cottage__owner=request.user.owner, feed__isnull=True)
        block.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class FeedSerializer(serializers.Serializer):
    cottage = serializers.IntegerField()
    channel = serializers.ChoiceField(choices=[c.value for c in FEED_CHANNELS])
    url = serializers.URLField(max_length=1000)

    def validate_url(self, value: str) -> str:
        if not value.lower().startswith("https://"):
            raise serializers.ValidationError("https")
        return value.strip()


class OwnerFeedsView(APIView):
    permission_classes = [IsOwner]

    def post(self, request):
        data = FeedSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        cottage = own_cottage(request, v["cottage"])
        # Each one makes the server read a web address the owner typed, while they wait.
        if not limits.allow(f"feed-reads:{request.user.owner.pk}", 30, 3600):
            return Response({"detail": "limit"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        feed, _ = CalendarFeed.objects.update_or_create(cottage=cottage, channel=v["channel"], defaults={"url": v["url"]})
        try:
            calendar.sync_feed(feed)
        except FeedError:
            pass  # kept, with the reason shown; the next sync tries again
        feed.refresh_from_db()
        return Response(feed_row(feed), status=status.HTTP_201_CREATED)


class OwnerFeedView(APIView):
    permission_classes = [IsOwner]

    def delete(self, request, pk):
        get_object_or_404(CalendarFeed, pk=pk, cottage__owner=request.user.owner).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class LinkSerializer(serializers.Serializer):
    open = serializers.BooleanField()


class OwnerBookingLinkView(APIView):
    permission_classes = [IsOwner]

    def patch(self, request, pk):
        cottage = own_cottage(request, pk)
        data = LinkSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        cottage.booking_requests_open = data.validated_data["open"]
        cottage.save(update_fields=["booking_requests_open"])
        return Response(cottage_row(cottage))

    def post(self, request, pk):
        """A new link; the old one stops working (if it was shared too widely)."""
        cottage = own_cottage(request, pk)
        cottage.booking_link_token = new_link_token()
        cottage.save(update_fields=["booking_link_token"])
        return Response(cottage_row(cottage))


class AcceptSerializer(serializers.Serializer):
    payout = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=Decimal("0"))


class OwnerRequestView(APIView):
    permission_classes = [IsOwner]

    def post(self, request, pk, action):
        c = get_object_or_404(
            Conversation.objects.select_related("cottage", "cottage__owner"), pk=pk, cottage__owner=request.user.owner
        )
        try:
            if action == "accept":
                data = AcceptSerializer(data=request.data)
                data.is_valid(raise_exception=True)
                booking_requests.accept(c, data.validated_data["payout"])
            elif action == "decline":
                booking_requests.decline(c)
            else:
                raise Http404
        except RequestError as exc:
            return Response({"detail": exc.code}, status=status.HTTP_400_BAD_REQUEST)
        c.refresh_from_db()
        return Response(messaging.conversation_row(c))

"""The owner's listings on other sites (Nettimökki, Lomarengas, Mökkivuokra, anything else).

The owner pastes the listing's address; Rantio recognises the site from it. If the site gives a
calendar link (iCal), its bookings are read like any booking site's, so those dates close on
every site Rantio lists the cottage on. A Nettimökki link also sets the cottage's Nettimökki
address, which matches Nettimökki's booking emails to the cottage.
"""

from urllib.parse import urlparse

from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import calendar
from .calendar import FEED_CHANNELS, FeedError
from .models import Booking, CalendarFeed, Cottage, ListingLink
from .portal import IsOwner

# The sites Rantio knows by name (and has icons for), by the name in their address:
# airbnb.fi and airbnb.com are both Airbnb. Keep in step with CHANNELS in frontend/src/lib/catalog.ts.
SITES = {
    "nettimokki": "Nettimökki",
    "lomarengas": "Lomarengas",
    "mokkivuokra": "Mökkivuokra",
    "airbnb": "Airbnb",
    "booking": "Booking.com",
    "vrbo": "Vrbo",
    "expedia": "Expedia",
    "agoda": "Agoda",
    "holidu": "Holidu",
    "hometogo": "HomeToGo",
    "novasol": "Novasol",
    "stugsommar": "Stugsommar",
    "finn": "FINN",
    "inatur": "Inatur",
    "dancenter": "DanCenter",
    "sologstrand": "Sol og Strand",
}
MAX_LINKS = 12


def host(url: str) -> str:
    h = (urlparse(url).hostname or "").lower()
    return h[4:] if h.startswith("www.") else h


# Endings a known site's own address can have: airbnb.fi, booking.com, airbnb.co.uk. A look-alike
# on a throwaway ending (airbnb.xyz, vrbo.top) isn't the site and must not be shown under its name.
SITE_ENDINGS = {"com", "fi", "se", "no", "dk", "is", "ee", "lv", "lt", "de", "nl", "fr", "es", "it", "pt", "at", "ch",
                "be", "ie", "pl", "cz", "ca", "eu", "co.uk", "com.au", "co.nz"}


def detect_site(url: str) -> str:
    """The known site an address belongs to, or "" for another site."""
    parts = host(url).split(".")
    for n in (2, 3):  # name.fi, name.co.uk; subdomains (www., fi.) in front are fine
        if len(parts) >= n and parts[-n] in SITES and ".".join(parts[-n + 1:]) in SITE_ENDINGS:
            return parts[-n]
    return ""


def site_name(site: str, url: str) -> str:
    return SITES.get(site) or host(url) or url


def link_row(link: ListingLink) -> dict:
    f = link.feed
    if not f:
        state = "none"
    elif f.last_error:
        state = "failed"
    elif not f.last_synced_at:
        state = "pending"
    else:
        state = "connected"
    return {
        "id": link.pk,
        "site": link.site or "other",
        "name": link.name,
        "url": link.url,
        "calendar_url": f.url if f else "",
        "calendar_state": state,
        "calendar_error": f.last_error if f else "",
        "last_synced_at": f.last_synced_at.isoformat() if f and f.last_synced_at else None,
    }


def links_for(cottage: Cottage) -> list[dict]:
    return [link_row(k) for k in cottage.links.all()]


def sync_nettimokki(cottage: Cottage) -> None:
    """The Nettimökki address set elsewhere (sign-up, editor) also shows among the listings."""
    url = cottage.nettimokki_url
    if url and not cottage.links.filter(url=url).exists():
        ListingLink.objects.create(cottage=cottage, site="nettimokki", url=url)


def _set_nettimokki(cottage: Cottage) -> None:
    first = cottage.links.filter(site="nettimokki").order_by("created_at", "pk").first()
    url = first.url if first else ""
    if cottage.nettimokki_url != url:
        cottage.nettimokki_url = url
        cottage.save(update_fields=["nettimokki_url"])


def _channel(link: ListingLink) -> str:
    # A booking site Rantio already reads (Airbnb, Booking.com…) keeps its one calendar.
    return link.site if link.site in FEED_CHANNELS else Booking.Channel.OTHER


def set_calendar(link: ListingLink, url: str) -> None:
    """Adds, changes or removes the listing's calendar link, and reads it at once."""
    url = url.strip()
    feed = link.feed
    if not url:
        if feed:
            link.feed = None
            link.save(update_fields=["feed"])
            if feed.channel == Booking.Channel.OTHER:
                feed.delete()  # its dates go with it
        return
    if feed and feed.url == url:
        return
    if feed:
        feed.url = url
        feed.last_synced_at = None
        feed.last_error = ""
        feed.save(update_fields=["url", "last_synced_at", "last_error"])
    else:
        channel = _channel(link)
        if channel == Booking.Channel.OTHER:
            feed = CalendarFeed.objects.create(cottage=link.cottage, channel=channel, url=url)
        else:
            feed, _ = CalendarFeed.objects.update_or_create(cottage=link.cottage, channel=channel, defaults={"url": url})
        link.feed = feed
        link.save(update_fields=["feed"])
    try:
        calendar.sync_feed(feed, get=calendar.fetch)  # looked up now, so tests can stand in for the site
    except FeedError:
        pass  # kept, with the reason shown; the next sync tries again
    link.feed.refresh_from_db()


def https(value: str) -> str:
    value = value.strip()
    if value and not value.lower().startswith("https://"):
        raise serializers.ValidationError("https")
    return value


class LinkSerializer(serializers.Serializer):
    url = serializers.URLField(max_length=500)
    calendar_url = serializers.URLField(max_length=1000, required=False, allow_blank=True)

    def validate_url(self, value: str) -> str:
        return https(value)

    def validate_calendar_url(self, value: str) -> str:
        return https(value)


class CalendarSerializer(serializers.Serializer):
    calendar_url = serializers.URLField(max_length=1000, allow_blank=True)

    def validate_calendar_url(self, value: str) -> str:
        return https(value)


class OwnerLinksView(APIView):
    """GET the cottage's other listings; POST {url, calendar_url?} adds one."""

    permission_classes = [IsOwner]

    def cottage(self, request, pk) -> Cottage:
        return get_object_or_404(Cottage, pk=pk, owner=request.user.owner)

    def get(self, request, pk):
        return Response(links_for(self.cottage(request, pk)))

    def post(self, request, pk):
        cottage = self.cottage(request, pk)
        data = LinkSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        url = data.validated_data["url"]
        if cottage.links.filter(url=url).exists():
            return Response({"url": ["already_added"]}, status=status.HTTP_400_BAD_REQUEST)
        if cottage.links.count() >= MAX_LINKS:
            return Response({"url": ["too_many"]}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            link = ListingLink.objects.create(cottage=cottage, site=detect_site(url), url=url)
            if link.site == "nettimokki":
                _set_nettimokki(cottage)
        if data.validated_data.get("calendar_url"):
            set_calendar(link, data.validated_data["calendar_url"])
        return Response(link_row(link), status=status.HTTP_201_CREATED)


class OwnerLinkView(APIView):
    """PATCH {calendar_url} adds, changes or removes its calendar; DELETE removes the listing here."""

    permission_classes = [IsOwner]

    def link(self, request, pk) -> ListingLink:
        return get_object_or_404(
            ListingLink.objects.select_related("cottage", "feed"), pk=pk, cottage__owner=request.user.owner
        )

    def patch(self, request, pk):
        link = self.link(request, pk)
        data = CalendarSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        set_calendar(link, data.validated_data["calendar_url"])
        return Response(link_row(link))

    def delete(self, request, pk):
        link = self.link(request, pk)
        cottage = link.cottage
        with transaction.atomic():
            set_calendar(link, "")
            was_nettimokki = link.site == "nettimokki"
            link.delete()
            if was_nettimokki:
                _set_nettimokki(cottage)
        return Response(status=status.HTTP_204_NO_CONTENT)

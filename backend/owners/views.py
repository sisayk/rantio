import logging

from django.conf import settings
from django.core.mail import send_mail
from rest_framework import generics, permissions, views
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import MonitorInterest, OwnerSignup
from .serializers import MonitorInterestSerializer, OwnerSignupSerializer

logger = logging.getLogger(__name__)


class OwnerSignupCreateView(generics.CreateAPIView):
    """Public endpoint behind the rantio.fi sign-up form."""

    queryset = OwnerSignup.objects.all()
    serializer_class = OwnerSignupSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # public form: no session, so no CSRF check
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    def perform_create(self, serializer):
        signup = serializer.save()
        if settings.SIGNUP_NOTIFY_EMAILS:
            try:
                send_mail(
                    subject=f"New Rantio owner: {signup.name} ({signup.location_display})",
                    message=(
                        f"{signup.name} <{signup.email}> {signup.phone}\n"
                        f"Where: {signup.location_display} · cottages: {signup.cottage_count}"
                        f" · writes in: {signup.get_language_display()}\n"
                        f"Nettimökki: {signup.nettimokki_url or '-'}\n\n{signup.message}"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=settings.SIGNUP_NOTIFY_EMAILS,
                )
            except Exception:  # a mail outage must not lose the sign-up
                logger.exception("Could not send sign-up notification for %s", signup.pk)


class MonitorInterestCreateView(generics.CreateAPIView):
    """Public endpoint behind "Tell me when it's ready" for the Mökki monitor on the owners' page."""

    queryset = MonitorInterest.objects.all()
    serializer_class = MonitorInterestSerializer
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    def perform_create(self, serializer):
        entry = serializer.save()
        if settings.SIGNUP_NOTIFY_EMAILS:
            try:
                send_mail(
                    subject=f"Mökki monitor waitlist: {entry.email}",
                    message=f"{entry.email} · {entry.get_country_display()} · {entry.get_rents_display() or '-'}"
                    f" · writes in {entry.get_language_display()}",
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=settings.SIGNUP_NOTIFY_EMAILS,
                )
            except Exception:
                logger.exception("Could not send waitlist notification for %s", entry.pk)


class RatesView(views.APIView):
    """Today's exchange rates for showing guests prices in their own currency."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        from . import rates

        per_eur, day = rates.current()
        res = Response({"base": "EUR", "date": day, "source": "European Central Bank",
                        "rates": {code: float(v) for code, v in per_eur.items()}})
        res["Cache-Control"] = "public, max-age=3600"
        return res


class HeroSlidesView(views.APIView):
    """The homepage slides, in order. An empty list means the site's built-in photo."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        from .models import HeroSlide

        slides = []
        for s in HeroSlide.objects.filter(active=True):
            if s.kind == HeroSlide.Kind.VIDEO and not s.video:
                continue
            photo = s.image.url if s.image else s.image_url
            if s.kind == HeroSlide.Kind.IMAGE and not photo:
                continue
            slides.append({
                "id": s.pk,
                "kind": s.kind,
                "src": s.video.url if s.kind == HeroSlide.Kind.VIDEO else photo,
                "poster": (photo or None) if s.kind == HeroSlide.Kind.VIDEO else None,
                "alt": s.alt,
                "focus": s.focus,
                "seconds": float(s.video_seconds) if s.kind == HeroSlide.Kind.VIDEO and s.video_seconds else s.seconds,
            })
        res = Response({"slides": slides})
        res["Cache-Control"] = "public, max-age=60"
        return res


def health(request):
    """Up or not, plus which commit is live and how the last automatic deploy went
    (deploy/autodeploy.sh writes the file). Short commit ids only."""
    import json

    from django.http import JsonResponse

    body = {"ok": True}
    try:
        with open(settings.DEPLOY_STATUS_FILE) as f:
            data = json.load(f)
        body["deploy"] = {
            "live": data.get("deployed", "")[:7],
            "state": data.get("state", ""),
            "at": data.get("at", ""),
            "failed": data.get("failed", "")[:7],
        }
    except (OSError, ValueError):
        pass
    res = JsonResponse(body)
    res["Cache-Control"] = "no-store"
    return res

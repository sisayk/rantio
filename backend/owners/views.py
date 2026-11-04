import logging

from django.conf import settings
from django.core.mail import send_mail
from django.db import transaction
from django.shortcuts import get_object_or_404
from rest_framework import authentication, generics, parsers, permissions, views
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from django.contrib.auth import login
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.core.validators import validate_email

from . import app as app_keys
from . import email_check, stripe_api, trial
from . import login as owner_login
from .media_checks import IMAGE_MAX, image_type
from .listing_links import sync_nettimokki
from .models import Cottage, CottagePhoto, MonitorInterest, Owner, OwnerSignup, SignupPhoto
from .regions import REGIONS
from .serializers import MonitorInterestSerializer, OwnerSignupSerializer

logger = logging.getLogger(__name__)


MAX_SIGNUP_PHOTOS = 10


def signup_photos(request):
    """The photos sent with the form, checked, or an error response."""
    files = request.FILES.getlist("photos")
    if len(files) > MAX_SIGNUP_PHOTOS:
        return None, Response({"photos": ["too_many"]}, status=400)
    for f in files:
        if f.size > IMAGE_MAX:
            return None, Response({"photos": ["too_big"]}, status=400)
        kind = image_type(f.read(16))
        f.seek(0)
        if not kind:
            return None, Response({"photos": ["not_image"]}, status=400)
        f.name = f"photo.{'jpg' if kind == 'jpeg' else kind}"
    return files, None


def wants_app(request) -> bool:
    return str(request.data.get("app", "")).lower() in ("1", "true")


class EmailCodeView(views.APIView):
    """POST {email, name, lang}: emails a code that the sign-up form then sends as email_code."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        email = str(request.data.get("email", "")).strip()
        try:
            validate_email(email)
        except ValidationError:
            return Response({"email": ["invalid"]}, status=400)
        if not email_check.can_send(email):
            return Response({"detail": "too_many"}, status=429)
        lang = str(request.data.get("lang", "en"))
        email_check.send(email, str(request.data.get("name", ""))[:120], lang)
        return Response({"sent": True})


def become_owner(signup: OwnerSignup) -> Owner:
    """A checked sign-up is an owner at once, with their cottage (its photos) waiting to be listed."""
    owner = Owner.objects.filter(email__iexact=signup.email).first()
    if owner is None:
        owner = Owner.objects.create(name=signup.name, email=signup.email, phone=signup.phone,
                                     language=signup.language, signup=signup)
    else:  # an account made by signing in (or an owner listing another cottage) becomes a host
        changed = []
        if owner.signup_id is None:
            owner.signup = signup
            changed.append("signup")
        if not owner.is_host:
            owner.is_host = True
            owner.name = signup.name or owner.name
            changed += ["is_host", "name"]
        if signup.phone and not owner.phone:
            owner.phone = signup.phone
            changed.append("phone")
        if changed:
            owner.save(update_fields=changed)
    region = REGIONS.get(signup.country, {}).get(signup.region, "")
    cottage = Cottage.objects.create(
        owner=owner, name=(signup.place or region or signup.name)[:120], country=signup.country, region=signup.region,
        municipality=signup.place[:80], max_guests=2, price_per_night=0, host_languages=[owner.language],
        status=Cottage.Status.INTAKE, nettimokki_url=signup.nettimokki_url,
    )
    sync_nettimokki(cottage)
    for i, photo in enumerate(signup.photos.all()):
        with photo.image.open("rb") as f:
            data = f.read()
        CottagePhoto.objects.create(cottage=cottage, position=i,
                                    image=ContentFile(data, name=photo.image.name.rsplit("/", 1)[-1]))
    return owner


class OwnerSignupCreateView(generics.CreateAPIView):
    """Public endpoint behind the sign-up form (rantio.fi/hosts and the app), with its photos.

    The answer carries checkout_url when the card step is on (owners/trial.py): the form
    sends the owner there to save a card for the free trial.
    """

    queryset = OwnerSignup.objects.all()
    serializer_class = OwnerSignupSerializer
    permission_classes = [permissions.AllowAny]
    # Public form; someone already signed in sends it with their session (and its CSRF token) or
    # the app's key, and their checked address stands in for the email code.
    authentication_classes = [authentication.SessionAuthentication, app_keys.AppKeyAuthentication]
    parser_classes = [parsers.JSONParser, parsers.MultiPartParser]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    def create(self, request, *args, **kwargs):
        photos, error = signup_photos(request)
        if error:
            return error
        account = request.user.owner if request.user.is_authenticated and hasattr(request.user, "owner") else None
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        checked = settings.SIGNUP_EMAIL_CHECK or account is not None
        if account:
            serializer.validated_data["email"] = account.email  # the address they signed in with
        elif checked and not email_check.check(serializer.validated_data["email"], str(request.data.get("email_code", ""))):
            return Response({"email_code": ["wrong"]}, status=400)
        owner = None
        with transaction.atomic():
            signup = serializer.save()
            for i, f in enumerate(photos):
                SignupPhoto.objects.create(signup=signup, image=f, position=i)
            if checked:
                owner = become_owner(signup)
        checkout_url = None
        if trial.enabled():
            try:
                checkout_url = trial.checkout(signup, app=wants_app(request))
            except stripe_api.StripeError:
                logger.exception("No card step for sign-up %s", signup.pk)
        self.notify(signup, len(photos))
        answer = {**serializer.data, "token": signup.token, "checkout_url": checkout_url, "signed_in": False}
        # The email is checked: signed in straight away (the website by cookie, the app by key).
        if owner and account:
            answer["signed_in"] = True  # already signed in, now as a host
        elif owner:
            owner_login.user_for(owner)
            if wants_app(request):
                platform = str(request.data.get("platform", ""))
                answer["app_key"] = app_keys.issue_key(owner, name=str(request.data.get("device", ""))[:80],
                                                       platform=platform if platform in ("ios", "android") else "")
            else:
                login(request._request, owner_login.user_for(owner), backend="django.contrib.auth.backends.ModelBackend")
            answer["signed_in"] = True
        return Response(answer, status=201)

    def notify(self, signup: OwnerSignup, photos: int):
        if settings.SIGNUP_NOTIFY_EMAILS:
            try:
                send_mail(
                    subject=f"New Rantio owner: {signup.name} ({signup.location_display})",
                    message=(
                        f"{signup.name} <{signup.email}> {signup.phone}\n"
                        f"Where: {signup.location_display} · cottages: {signup.cottage_count}"
                        f" · writes in: {signup.get_language_display()} · photos: {photos}\n"
                        f"Listed now: {signup.listed_on_display} · Nettimökki: {signup.nettimokki_url or '-'}\n\n"
                        f"{signup.message}\n\n"
                        f"{settings.ADMIN_URL}/owners/ownersignup/{signup.pk}/change/"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=settings.SIGNUP_NOTIFY_EMAILS,
                )
            except Exception:  # a mail outage must not lose the sign-up
                logger.exception("Could not send sign-up notification for %s", signup.pk)


class SignupCardView(views.APIView):
    """GET: has the owner saved a card for the free trial? POST: a new card page (to try again)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get_throttles(self):
        if self.request.method == "POST":
            self.throttle_scope = "signup"
            return [ScopedRateThrottle()]
        return []

    def signup(self, token: str) -> OwnerSignup:
        return get_object_or_404(OwnerSignup, token=token)

    def get(self, request, token):
        signup = self.signup(token)
        try:
            saved = trial.confirm(signup)
        except stripe_api.StripeError:
            logger.exception("Could not check the card of sign-up %s", signup.pk)
            saved = False
        return Response({"card_saved": saved, "name": signup.name.split(" ")[0], "card_step": trial.enabled()})

    def post(self, request, token):
        signup = self.signup(token)
        if signup.card_saved_at or not trial.enabled():
            return Response({"card_saved": bool(signup.card_saved_at), "checkout_url": None})
        try:
            url = trial.checkout(signup, app=wants_app(request))
        except stripe_api.StripeError:
            logger.exception("No card page for sign-up %s", signup.pk)
            return Response({"detail": "unavailable"}, status=503)
        return Response({"card_saved": False, "checkout_url": url})


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

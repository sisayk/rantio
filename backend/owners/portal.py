"""Owner dashboard API: sign in with an emailed code, then read your own figures."""

import logging

from django.conf import settings
from django.contrib.auth import login, logout
from django.utils import timezone
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import app
from . import login as owner_login
from . import messaging
from .models import AppDevice, Language, MonitorInterest
from .statements import booking_row, bookings_for, summary

logger = logging.getLogger(__name__)


class IsOwner(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and hasattr(request.user, "owner"))


class EmailSerializer(serializers.Serializer):
    email = serializers.EmailField()
    lang = serializers.ChoiceField(choices=Language.values, default=Language.ENGLISH)


class CodeSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.RegexField(r"^\s*\d{6}\s*$")
    # The phone app asks for a sign-in key instead of a session cookie.
    app = serializers.BooleanField(default=False)
    device = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    platform = serializers.ChoiceField(choices=["ios", "android", ""], required=False, default="")


class RequestCodeView(APIView):
    """Always answers the same way, so nobody can test which emails belong to owners."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        data = EmailSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        body = {"sent": True}
        owner = owner_login.find_owner(data.validated_data["email"])
        if owner and owner_login.can_send(owner):
            try:
                code = owner_login.issue_code(owner, data.validated_data["lang"])
                if settings.DEV_LOGIN_CODES:
                    body["dev_code"] = code  # local development only: no real email is sent
            except Exception:
                logger.exception("Could not send a login code to owner %s", owner.pk)
                return Response({"detail": "email_failed"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(body)


class VerifyCodeView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login-verify"

    def post(self, request):
        data = CodeSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        owner = owner_login.find_owner(data.validated_data["email"])
        if not owner or not owner_login.check_code(owner, data.validated_data["code"]):
            return Response({"detail": "invalid_code"}, status=status.HTTP_400_BAD_REQUEST)
        owner_login.user_for(owner)
        if data.validated_data["app"]:
            key = app.issue_key(owner, name=data.validated_data["device"], platform=data.validated_data["platform"])
            return Response({"ok": True, "token": key})
        login(request._request, owner_login.user_for(owner), backend="django.contrib.auth.backends.ModelBackend")
        return Response({"ok": True})


@method_decorator(ensure_csrf_cookie, name="dispatch")
class MeView(APIView):
    """Who is signed in; also hands the browser its CSRF cookie for later POSTs."""

    permission_classes = [IsOwner]

    def get(self, request):
        o = request.user.owner
        return Response({"name": o.name, "email": o.email, "language": o.language, "is_pilot": o.is_pilot})

    def patch(self, request):
        """The app's language setting also sets the language of the owner's emails."""
        lang = request.data.get("language")
        if lang not in Language.values:
            return Response({"detail": "language"}, status=status.HTTP_400_BAD_REQUEST)
        o = request.user.owner
        o.language = lang
        o.save(update_fields=["language"])
        return self.get(request)


class MonitorWaitlistView(APIView):
    """The Mökki monitor waitlist for a signed-in owner: one tap, with the email they sign in with."""

    permission_classes = [IsOwner]

    def get(self, request):
        return Response({"joined": MonitorInterest.objects.filter(email=request.user.owner.email.lower()).exists()})

    def post(self, request):
        o = request.user.owner
        first = o.cottages.order_by("id").first()
        MonitorInterest.objects.update_or_create(
            email=o.email.lower(),
            defaults={"language": o.language, "country": first.country if first else "FI",
                      "rents": MonitorInterest.Rents.YES, "privacy_consent": True, "source": "hosting"},
        )
        return Response({"joined": True})


class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if isinstance(request.auth, AppDevice):
            request.auth.delete()  # this phone only
        else:
            logout(request._request)
        return Response({"ok": True})


class DeviceSerializer(serializers.Serializer):
    push_token = serializers.RegexField(r"^(ExponentPushToken\[[\w-]+\]|ExpoPushToken\[[\w-]+\])?$", allow_blank=True)


class DeviceView(APIView):
    """The app tells us where to push (or, with an empty token, that notifications are off)."""

    permission_classes = [IsOwner]

    def post(self, request):
        if not isinstance(request.auth, AppDevice):
            return Response({"detail": "app_only"}, status=status.HTTP_400_BAD_REQUEST)
        data = DeviceSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        token = data.validated_data["push_token"]
        if token:  # a token moves with the phone, not the owner: one row keeps it
            AppDevice.objects.filter(push_token=token).exclude(pk=request.auth.pk).update(push_token="")
        request.auth.push_token = token
        request.auth.save(update_fields=["push_token"])
        return Response({"ok": True})


def year_param(request) -> int:
    today = timezone.localdate()
    try:
        year = int(request.query_params.get("year", today.year))
    except ValueError:
        return today.year
    return year if 2020 <= year <= today.year + 2 else today.year


@method_decorator(ensure_csrf_cookie, name="dispatch")
class SummaryView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        owner = request.user.owner
        data = summary(owner, year_param(request), timezone.localdate())
        data["unread_messages"] = sum(messaging.unread_for_owner(c) for c in messaging.owner_conversations(owner))
        return Response(data)


class BookingsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        today = timezone.localdate()
        rows = [booking_row(b, today) for b in bookings_for(request.user.owner, year_param(request))]
        return Response({"results": rows})

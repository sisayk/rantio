import logging

from django.conf import settings
from django.core.mail import send_mail
from rest_framework import generics, permissions
from rest_framework.throttling import ScopedRateThrottle

from .models import OwnerSignup
from .serializers import OwnerSignupSerializer

logger = logging.getLogger(__name__)


class OwnerSignupCreateView(generics.CreateAPIView):
    """Public endpoint behind the stugora.fi sign-up form."""

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
                    subject=f"New Stugora owner: {signup.name} ({signup.location_display})",
                    message=(
                        f"{signup.name} <{signup.email}> {signup.phone}\n"
                        f"Where: {signup.location_display} · cottages: {signup.cottage_count}\n"
                        f"Nettimökki: {signup.nettimokki_url or '-'}\n\n{signup.message}"
                    ),
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    recipient_list=settings.SIGNUP_NOTIFY_EMAILS,
                )
            except Exception:  # a mail outage must not lose the sign-up
                logger.exception("Could not send sign-up notification for %s", signup.pk)

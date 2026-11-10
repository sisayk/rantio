"""Messages API.

Guests: POST /api/enquiries/ starts a conversation from a cottage page; the private
token then reads and continues it at /api/conversations/<token>/. POST
/api/enquiries/draft/ has Claude write (or tidy up) the guest's first message.
Owners: /api/owner/conversations/ lists their own conversations, one by id with its
messages, and posts replies.
"""

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import assistant, messaging, reviews
from .calendar_views import request_row
from .models import Conversation, Language, Message, RequestStatus
from .portal import IsOwner

BODY = serializers.CharField(max_length=4000, trim_whitespace=True)


class EnquirySerializer(serializers.Serializer):
    listing = serializers.SlugField(max_length=60)
    name = serializers.CharField(max_length=120, trim_whitespace=True)
    email = serializers.EmailField()
    lang = serializers.ChoiceField(choices=Language.values, default=Language.ENGLISH)
    body = serializers.CharField(max_length=4000, trim_whitespace=True)
    check_in = serializers.DateField(required=False, allow_null=True)
    check_out = serializers.DateField(required=False, allow_null=True)
    # Either adults and children (the app, the website) or one head count (older pages).
    guests = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=30)
    adults = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=30)
    children = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=20)
    website = serializers.CharField(required=False, allow_blank=True)  # honeypot

    def validate(self, attrs):
        if attrs.pop("website", ""):
            raise serializers.ValidationError("Invalid submission.")
        ci, co = attrs.get("check_in"), attrs.get("check_out")
        if ci and co and co <= ci:
            raise serializers.ValidationError({"check_out": "Check-out must be after check-in."})
        attrs["email"] = attrs["email"].strip().lower()
        party(attrs)
        return attrs


def party(attrs: dict) -> None:
    """Stores the party as booking requests do: `guests` = adults, plus `children`."""
    adults, children = attrs.pop("adults", None), attrs.pop("children", None) or 0
    if adults:
        attrs["guests"], attrs["children"] = adults, children
    elif children:
        raise serializers.ValidationError({"adults": "Children travel with at least one adult."})
    else:
        attrs["children"] = 0


class BodySerializer(serializers.Serializer):
    body = BODY


def thread(c: Conversation, viewer: str) -> dict:
    owner = c.owner
    return {
        **messaging.conversation_row(c),
        "host_name": owner.name.split()[0] if owner and owner.name else "",
        "listing_slug": c.listing_slug,
        "messages": [messaging.message_row(m) for m in c.messages.all()],
        "viewer": viewer,
        # A booking request waiting for the owner: what accepting it would mean.
        "request": request_row(c) if viewer == "host" and c.request_status == RequestStatus.PENDING else None,
    }


class EnquiryView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "enquiry"

    def post(self, request):
        data = EnquirySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        v = data.validated_data
        c = messaging.start(
            listing_slug=v["listing"], name=v["name"], email=v["email"], lang=v["lang"], text=v["body"],
            check_in=v.get("check_in"), check_out=v.get("check_out"), guests=v.get("guests"), children=v["children"],
        )
        return Response({"token": c.token}, status=status.HTTP_201_CREATED)


class CottageContactView(APIView):
    """GET /api/cottages/<slug>/contact/: who answers this page's messages, so the page and the app say so
    before the guest writes: "owner", or "rantio" for an example stay with no owner on Rantio yet."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request, slug):
        cottage = messaging.cottage_for(slug)
        res = Response({"answered_by": "owner" if cottage and cottage.owner_id else "rantio"})
        res["Cache-Control"] = "public, max-age=300"
        return res


class EnquiryDraftSerializer(serializers.Serializer):
    listing = serializers.SlugField(max_length=60)
    # Example cottages aren't in the database yet: the page says what it shows.
    cottage = serializers.CharField(max_length=120, required=False, allow_blank=True)
    place = serializers.CharField(max_length=160, required=False, allow_blank=True)
    lang = serializers.ChoiceField(choices=Language.values, default=Language.ENGLISH)
    name = serializers.CharField(max_length=120, required=False, allow_blank=True)
    check_in = serializers.DateField(required=False, allow_null=True)
    check_out = serializers.DateField(required=False, allow_null=True)
    adults = serializers.IntegerField(required=False, allow_null=True, min_value=1, max_value=30)
    children = serializers.IntegerField(required=False, allow_null=True, min_value=0, max_value=20)
    draft = serializers.CharField(max_length=2000, required=False, allow_blank=True)


class EnquiryDraftView(APIView):
    """The guest's message to the owner, written by Claude from a few words; nothing is sent from here."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "guest-ai-draft"

    def post(self, request):
        data = EnquiryDraftSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            text = assistant.suggest_enquiry(**data.validated_data)
        except assistant.NotConfigured:
            return Response({"detail": "ai_not_configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except assistant.DraftFailed:
            return Response({"detail": "ai_failed"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"draft": text})


class GuestThreadView(APIView):
    """The guest's side of one conversation, opened with its private token."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "guest-message"

    def get_conversation(self, token: str) -> Conversation:
        return get_object_or_404(
            Conversation.objects.select_related("cottage__owner").prefetch_related("messages"),
            token=token, channel="direct",
        )

    def get_throttles(self):
        # Reading (and the page's polling) is not limited; only writing is.
        return super().get_throttles() if self.request.method == "POST" else []

    def get(self, request, token):
        c = self.get_conversation(token)
        Conversation.objects.filter(pk=c.pk).update(guest_read_at=timezone.now())
        # After the stay: the page offers the review form (owners/reviews.py).
        return Response({**thread(c, "guest"), "can_review": reviews.can_review(c), "reviewed": hasattr(c, "review")})

    def post(self, request, token):
        c = self.get_conversation(token)
        data = BodySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        messaging.add(c, Message.Sender.GUEST, data.validated_data["body"])
        return Response(thread(self.get_conversation(token), "guest"), status=status.HTTP_201_CREATED)


class GuestPushSerializer(serializers.Serializer):
    # Empty: the guest turned notifications off (or left the conversation).
    push_token = serializers.RegexField(r"^(ExponentPushToken\[[\w-]+\]|ExpoPushToken\[[\w-]+\])?$", allow_blank=True)


class GuestPushView(GuestThreadView):
    """POST {push_token}: the guest's phone wants a notification when the owner answers."""

    http_method_names = ["post", "options"]

    def post(self, request, token):
        c = self.get_conversation(token)
        data = GuestPushSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        Conversation.objects.filter(pk=c.pk).update(guest_push_token=data.validated_data["push_token"])
        return Response({"ok": True})


class OwnerConversationsView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        rows = [messaging.conversation_row(c) for c in messaging.owner_conversations(request.user.owner)]
        return Response({"results": rows, "unread": sum(r["unread"] for r in rows)})


class OwnerThreadView(APIView):
    permission_classes = [IsOwner]

    def get_conversation(self, request, pk) -> Conversation:
        return get_object_or_404(messaging.owner_conversations(request.user.owner), pk=pk)

    def get(self, request, pk):
        c = self.get_conversation(request, pk)
        Conversation.objects.filter(pk=c.pk).update(owner_read_at=timezone.now())
        c.owner_read_at = timezone.now()
        return Response(thread(c, "host"))

    def post(self, request, pk):
        c = self.get_conversation(request, pk)
        data = BodySerializer(data=request.data)
        data.is_valid(raise_exception=True)
        messaging.add(c, Message.Sender.HOST, data.validated_data["body"])
        return Response(thread(self.get_conversation(request, pk), "host"), status=status.HTTP_201_CREATED)

    def patch(self, request, pk):
        """Archive or bring back a conversation."""
        c = self.get_conversation(request, pk)
        c.archived = bool(request.data.get("archived"))
        c.save(update_fields=["archived"])
        return Response(messaging.conversation_row(c))


class DraftSerializer(serializers.Serializer):
    notes = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    draft = serializers.CharField(max_length=4000, required=False, allow_blank=True)


class OwnerDraftView(APIView):
    """A reply suggested by Claude for the owner to edit; nothing is sent from here."""

    permission_classes = [IsOwner]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "ai-draft"

    def post(self, request, pk):
        c = get_object_or_404(messaging.owner_conversations(request.user.owner), pk=pk)
        data = DraftSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        try:
            text = assistant.suggest_reply(c, data.validated_data.get("notes", ""), data.validated_data.get("draft", ""))
        except assistant.NotConfigured:
            return Response({"detail": "ai_not_configured"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except assistant.DraftFailed:
            return Response({"detail": "ai_failed"}, status=status.HTTP_502_BAD_GATEWAY)
        return Response({"draft": text})


class AssistantStatusView(APIView):
    permission_classes = [IsOwner]

    def get(self, request):
        return Response({"enabled": bool(settings.ANTHROPIC_API_KEY)})

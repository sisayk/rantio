"""The guest newsletter from the site footer: sign-up with double opt-in, confirm, unsubscribe.

Nobody is on the list until they click the link in the confirmation email. The sign-up
answer is the same whether the address is new, waiting or already confirmed, so the form
doesn't reveal who is subscribed. Sending the newsletter itself happens outside the site
(export the confirmed addresses from the admin).
"""

import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.utils import timezone
from rest_framework import permissions, serializers, status, views
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from .models import Language, NewsletterSubscriber

logger = logging.getLogger(__name__)

# At most this many confirmation emails per address, at least this far apart: someone
# typing another person's address can't flood their inbox.
MAX_CONFIRMATIONS = 4
RESEND_AFTER = timedelta(minutes=10)
# Sign-ups nobody confirmed are deleted after this (the privacy policy says so).
UNCONFIRMED_KEPT = timedelta(days=30)

# Subject and body per site language; {link} is the confirmation page.
MESSAGES = {
    "en": (
        "Confirm your Rantio newsletter",
        "Hi,\n\nplease confirm that you'd like Rantio's newsletter: new cottages, seasonal ideas and Nordic travel tips, about once a month.\n\n"
        "Confirm here:\n{link}\n\n"
        "If you didn't sign up, ignore this email; you won't hear from us.\n\nBest wishes\nRantio",
    ),
    "fi": (
        "Vahvista Rantion uutiskirjeen tilaus",
        "Hei,\n\nvahvista vielä, että haluat Rantion uutiskirjeen: uusia mökkejä, vuodenajan vinkkejä ja matkaideoita Pohjolasta, noin kerran kuussa.\n\n"
        "Vahvista tästä:\n{link}\n\n"
        "Jos et tilannut uutiskirjettä, voit jättää tämän viestin huomiotta. Emme lähetä sinulle mitään.\n\nTerveisin\nRantio",
    ),
    "sv": (
        "Bekräfta Rantios nyhetsbrev",
        "Hej,\n\nbekräfta att du vill ha Rantios nyhetsbrev: nya stugor, idéer för säsongen och restips från Norden, ungefär en gång i månaden.\n\n"
        "Bekräfta här:\n{link}\n\n"
        "Om du inte anmälde dig kan du bortse från det här mejlet. Vi hör inte av oss.\n\nHälsningar\nRantio",
    ),
    "nb": (
        "Bekreft Rantios nyhetsbrev",
        "Hei,\n\nbekreft at du vil ha nyhetsbrevet fra Rantio: nye hytter, tips for sesongen og reiseideer fra Norden, omtrent én gang i måneden.\n\n"
        "Bekreft her:\n{link}\n\n"
        "Hvis du ikke meldte deg på, kan du se bort fra denne e-posten. Du hører ikke fra oss.\n\nHilsen\nRantio",
    ),
    "nn": (
        "Stadfest nyheitsbrevet frå Rantio",
        "Hei,\n\nstadfest at du vil ha nyheitsbrevet frå Rantio: nye hytter, tips for sesongen og reiseidear frå Norden, om lag éin gong i månaden.\n\n"
        "Stadfest her:\n{link}\n\n"
        "Viss du ikkje melde deg på, kan du sjå bort frå denne e-posten. Du høyrer ikkje frå oss.\n\nHelsing\nRantio",
    ),
    "da": (
        "Bekræft Rantios nyhedsbrev",
        "Hej,\n\nbekræft, at du gerne vil have Rantios nyhedsbrev: nye sommerhuse, idéer til sæsonen og rejsetips fra Norden, cirka en gang om måneden.\n\n"
        "Bekræft her:\n{link}\n\n"
        "Hvis du ikke har tilmeldt dig, kan du se bort fra denne e-mail. Du hører ikke fra os.\n\nVenlig hilsen\nRantio",
    ),
    "is": (
        "Staðfestu fréttabréf Rantio",
        "Hæ,\n\nstaðfestu að þú viljir fá fréttabréf Rantio: ný sumarhús, hugmyndir fyrir árstíðina og ferðaráð frá Norðurlöndum, um það bil einu sinni í mánuði.\n\n"
        "Staðfestu hér:\n{link}\n\n"
        "Ef þú skráðir þig ekki geturðu hunsað þennan póst. Þú heyrir ekki frá okkur.\n\nKveðja\nRantio",
    ),
    "et": (
        "Kinnita Rantio uudiskirja tellimus",
        "Tere,\n\nkinnita, et soovid Rantio uudiskirja: uued suvilad, hooaja ideed ja reisinõuanded Põhjamaadest, umbes kord kuus.\n\n"
        "Kinnita siin:\n{link}\n\n"
        "Kui sa ei tellinud uudiskirja, võid selle kirja tähelepanuta jätta. Me ei saada sulle midagi.\n\nParimate soovidega\nRantio",
    ),
    "lv": (
        "Apstipriniet Rantio jaunumu vēstuli",
        "Sveiki!\n\nLūdzu, apstipriniet, ka vēlaties saņemt Rantio jaunumu vēstuli: jaunas brīvdienu mājas, sezonas idejas un ceļojumu padomi no Ziemeļvalstīm, aptuveni reizi mēnesī.\n\n"
        "Apstipriniet šeit:\n{link}\n\n"
        "Ja nepieteicāties, varat šo e-pastu neņemt vērā. Mēs jums neko nesūtīsim.\n\nAr cieņu\nRantio",
    ),
    "lt": (
        "Patvirtinkite Rantio naujienlaiškį",
        "Sveiki,\n\npatvirtinkite, kad norite gauti Rantio naujienlaiškį: nauji poilsio nameliai, sezono idėjos ir kelionių patarimai iš Šiaurės šalių, maždaug kartą per mėnesį.\n\n"
        "Patvirtinkite čia:\n{link}\n\n"
        "Jei neužsiprenumeravote, šį laišką galite ignoruoti. Mes jums nieko nesiųsime.\n\nPagarbiai\nRantio",
    ),
}


def confirm_link(sub: NewsletterSubscriber) -> str:
    return f"{settings.SITE_URL}/{sub.language}/newsletter/{sub.token}"


def send_confirmation(sub: NewsletterSubscriber) -> bool:
    """Emails the confirmation link unless this address has had enough of them. True if sent."""
    now = timezone.now()
    if sub.confirmations_sent >= MAX_CONFIRMATIONS:
        return False
    if sub.last_confirmation_at and now - sub.last_confirmation_at < RESEND_AFTER:
        return False
    subject, body = MESSAGES.get(sub.language) or MESSAGES["en"]
    try:
        send_mail(subject, body.format(link=confirm_link(sub)), settings.DEFAULT_FROM_EMAIL, [sub.email])
    except Exception:
        logger.exception("Could not send the newsletter confirmation to subscriber %s", sub.pk)
        return False
    sub.confirmations_sent += 1
    sub.last_confirmation_at = now
    sub.save(update_fields=["confirmations_sent", "last_confirmation_at"])
    return True


def forget_unconfirmed() -> None:
    NewsletterSubscriber.objects.filter(confirmed_at__isnull=True, created_at__lt=timezone.now() - UNCONFIRMED_KEPT).delete()


def subscribe(email: str, language: str, source: str = "") -> NewsletterSubscriber:
    forget_unconfirmed()
    sub, created = NewsletterSubscriber.objects.get_or_create(
        email=email, defaults={"language": language, "source": source, "token": secrets.token_urlsafe(32)}
    )
    if sub.active:
        return sub  # already on the list: nothing to send
    if sub.unsubscribed_at:
        # Coming back after unsubscribing: confirm again, with a fresh link.
        sub.unsubscribed_at = None
        sub.confirmed_at = None
        sub.token = secrets.token_urlsafe(32)
        sub.confirmations_sent = 0
        sub.last_confirmation_at = None
    if not created:
        sub.language = language
    sub.save()
    send_confirmation(sub)
    return sub


class SubscribeSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)
    language = serializers.ChoiceField(choices=Language.choices, default=Language.ENGLISH)
    source = serializers.CharField(max_length=80, required=False, allow_blank=True, default="")
    website = serializers.CharField(required=False, allow_blank=True, write_only=True)  # honeypot


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=64)


class SubscribeView(views.APIView):
    """POST {email, language}: sends the confirmation email. Same answer for every address."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # public form: no session, so no CSRF check
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "signup"

    def post(self, request):
        s = SubscribeSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = s.validated_data
        if not data.get("website"):  # a bot that filled the hidden field gets the same answer, and nothing happens
            subscribe(data["email"].strip().lower(), data["language"], data.get("source", ""))
        return Response({"ok": True}, status=status.HTTP_201_CREATED)


def _by_token(request):
    s = TokenSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    return NewsletterSubscriber.objects.filter(token=s.validated_data["token"]).first()


class ConfirmView(views.APIView):
    """POST {token}: the confirmation page calls this (a link scanner's GET confirms nothing)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "guest-message"

    def post(self, request):
        forget_unconfirmed()
        sub = _by_token(request)
        if not sub or sub.unsubscribed_at:
            return Response({"detail": "Unknown link."}, status=status.HTTP_404_NOT_FOUND)
        if not sub.confirmed_at:
            sub.confirmed_at = timezone.now()
            sub.save(update_fields=["confirmed_at"])
        return Response({"ok": True, "language": sub.language})


class UnsubscribeView(views.APIView):
    """POST {token}: off the list for good (signing up again needs a new confirmation)."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "guest-message"

    def post(self, request):
        sub = _by_token(request)
        if not sub:
            return Response({"detail": "Unknown link."}, status=status.HTTP_404_NOT_FOUND)
        if not sub.unsubscribed_at:
            sub.unsubscribed_at = timezone.now()
            sub.save(update_fields=["unsubscribed_at"])
        return Response({"ok": True})

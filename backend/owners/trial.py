"""The card step after the sign-up form: three months free, then the yearly fee.

The sign-up form sends the owner to a Stripe Checkout page in setup mode: they save a
card and nothing is charged. The free months start when the cottage's listing goes live
(Cottage.trial_months); after them the yearly fee is invoiced as usual (invoicing.py)
and charged to the saved card, as are the monthly commission invoices (stripe_api.send).

Stripe sends the owner back to rantio.fi/<lang>/hosts/welcome?signup=<token>, whose page
asks confirm() whether the card was saved. From the app, the page then opens rantio://
and the app asks the same. Without STRIPE_SECRET_KEY there's no card step: the form just
says thank you, as before.
"""

from __future__ import annotations

import logging
from urllib.parse import urlencode

from django.conf import settings
from django.utils import timezone

from . import stripe_api
from .models import COUNTRY_CURRENCY, TRIAL_MONTHS, YEARLY_FEES, OwnerSignup

logger = logging.getLogger(__name__)

# Stripe Checkout's own languages; Icelandic isn't one of them.
STRIPE_LOCALES = {"en": "en", "fi": "fi", "sv": "sv", "nb": "nb", "nn": "nb", "da": "da", "et": "et", "lv": "lv",
                  "lt": "lt", "de": "de", "is": "auto"}

# Shown above Stripe's "Save" button (at most 1,200 characters).
TERMS = {
    "en": "{months} months free. Nothing is charged today: your card is saved for Rantio's invoices. The free months "
          "start when your cottage's listing goes live. After them, the yearly fee of {fee} + VAT per cottage is "
          "charged to this card. 12% + VAT of the bookings Rantio brings is charged monthly, also during the free "
          "months. Stop before the free months end and there's no yearly fee.",
    "fi": "{months} kuukautta maksutta. Tänään ei veloiteta mitään: korttisi tallennetaan Rantion laskuja varten. "
          "Maksuttomat kuukaudet alkavat, kun mökkisi ilmoitus julkaistaan. Niiden jälkeen kortilta veloitetaan "
          "vuosimaksu {fee} + ALV mökkiä kohden. Rantion tuomista varauksista veloitetaan 12 % + ALV kuukausittain, "
          "myös maksuttomien kuukausien aikana. Jos lopetat ennen kuin maksuttomat kuukaudet päättyvät, vuosimaksua "
          "ei tule.",
    "sv": "{months} månader gratis. Inget dras i dag: ditt kort sparas för Rantios fakturor. De gratis månaderna "
          "börjar när stugans annons publiceras. Därefter dras årsavgiften {fee} + moms per stuga från kortet. 12 % "
          "+ moms av bokningarna Rantio ger dig dras varje månad, även under de gratis månaderna. Slutar du innan de "
          "gratis månaderna är slut blir det ingen årsavgift.",
    "nb": "{months} måneder gratis. Ingenting trekkes i dag: kortet ditt lagres for Rantios fakturaer. De gratis "
          "månedene starter når hyttas annonse publiseres. Etter dem trekkes årsavgiften {fee} + mva. per hytte fra "
          "kortet. 12 % + mva. av bookingene Rantio gir deg trekkes hver måned, også i de gratis månedene. Slutter du "
          "før de gratis månedene er over, blir det ingen årsavgift.",
    "nn": "{months} månader gratis. Ingenting blir trekt i dag: kortet ditt blir lagra for fakturaene frå Rantio. "
          "Dei gratis månadene byrjar når annonsen for hytta blir publisert. Etter dei blir årsavgifta {fee} + mva. "
          "per hytte trekt frå kortet. 12 % + mva. av bookingane Rantio gir deg blir trekt kvar månad, også i dei "
          "gratis månadene. Sluttar du før dei gratis månadene er over, blir det inga årsavgift.",
    "da": "{months} måneder gratis. Der trækkes intet i dag: dit kort gemmes til Rantios fakturaer. De gratis "
          "måneder begynder, når dit sommerhus' annonce går online. Derefter trækkes årsgebyret på {fee} + moms pr. "
          "sommerhus på kortet. 12 % + moms af de bookinger, Rantio skaffer, trækkes hver måned, også i de gratis "
          "måneder. Stopper du, før de gratis måneder er gået, kommer der intet årsgebyr.",
    "is": "{months} mánuðir ókeypis. Ekkert er gjaldfært í dag: kortið þitt er vistað fyrir reikninga Rantio. "
          "Ókeypis mánuðirnir hefjast þegar auglýsing bústaðarins fer í loftið. Eftir þá er árgjaldið {fee} + VSK "
          "á hvern bústað gjaldfært á kortið. 12% + VSK af bókunum sem Rantio útvegar er gjaldfært mánaðarlega, "
          "líka á ókeypis mánuðunum. Ef þú hættir áður en ókeypis mánuðunum lýkur kemur ekkert árgjald.",
    "et": "{months} kuud tasuta. Täna ei võeta midagi: sinu kaart salvestatakse Rantio arvete jaoks. Tasuta kuud "
          "algavad, kui sinu suvemaja kuulutus avaldatakse. Pärast neid võetakse kaardilt aastatasu {fee} + km "
          "suvemaja kohta. Rantio toodud broneeringutelt võetakse 12% + km igakuiselt, ka tasuta kuude ajal. Kui "
          "lõpetad enne tasuta kuude lõppu, aastatasu ei tule.",
    "lv": "{months} mēneši bez maksas. Šodien netiek iekasēts nekas: jūsu karte tiek saglabāta Rantio rēķiniem. "
          "Bezmaksas mēneši sākas, kad jūsu brīvdienu mājas sludinājums tiek publicēts. Pēc tiem no kartes tiek "
          "iekasēta gada maksa {fee} + PVN par katru māju. 12% + PVN no Rantio piesaistītajām rezervācijām tiek "
          "iekasēti katru mēnesi, arī bezmaksas mēnešos. Ja pārtraucat pirms bezmaksas mēnešu beigām, gada maksas "
          "nav.",
    "lt": "{months} mėnesiai nemokamai. Šiandien nieko nenuskaičiuojama: jūsų kortelė išsaugoma Rantio sąskaitoms. "
          "Nemokami mėnesiai prasideda, kai jūsų sodybos skelbimas paskelbiamas. Po jų iš kortelės nuskaičiuojamas "
          "metinis mokestis {fee} + PVM už kiekvieną sodybą. 12 % + PVM nuo Rantio atvestų užsakymų "
          "nuskaičiuojama kas mėnesį, taip pat ir nemokamais mėnesiais. Jei nutrauksite prieš baigiantis "
          "nemokamiems mėnesiams, metinio mokesčio nebus.",
    "de": "{months} Monate kostenlos. Heute wird nichts abgebucht: Deine Karte wird für die Rechnungen von Rantio "
          "hinterlegt. Die kostenlosen Monate beginnen, sobald das Inserat deines Ferienhauses online ist. Danach "
          "wird die Jahresgebühr von {fee} + MwSt. pro Ferienhaus von dieser Karte abgebucht. 12 % + MwSt. der "
          "Buchungen, die Rantio bringt, werden monatlich abgebucht, auch während der kostenlosen Monate. Hörst du "
          "vor dem Ende der kostenlosen Monate auf, fällt keine Jahresgebühr an.",
}


def fee_text(currency: str, lang: str) -> str:
    amount = int(YEARLY_FEES.get(currency, YEARLY_FEES["EUR"]))
    sep = "," if lang == "en" else " " if lang not in ("da", "is", "de") else "."
    number = f"{amount:,}".replace(",", sep)
    if currency == "EUR":
        return f"€{number}" if lang == "en" else f"{number} €"
    return f"{currency} {number}" if lang == "en" else f"{number} {'kr.' if currency in ('DKK', 'ISK') else 'kr'}"


def enabled() -> bool:
    return stripe_api.enabled()


def welcome_url(signup: OwnerSignup, app: bool, **extra) -> str:
    query = {"signup": signup.token, **({"app": "1"} if app else {}), **extra}
    return f"{settings.SITE_URL}/{signup.language}/hosts/welcome?{urlencode(query)}"


def ensure_customer(signup: OwnerSignup) -> str:
    if not signup.stripe_customer_id:
        c = stripe_api.post("/customers", {
            "email": signup.email, "name": signup.name, "phone": signup.phone or None,
            "preferred_locales": [signup.language], "metadata": {"stugora_signup": signup.pk},
        }, idempotency_key=f"signup-customer-{signup.pk}")
        signup.stripe_customer_id = c["id"]
        signup.save(update_fields=["stripe_customer_id"])
    return signup.stripe_customer_id


def checkout(signup: OwnerSignup, app: bool = False) -> str:
    """A Stripe page where the owner saves a card (nothing charged); its address."""
    lang = signup.language if signup.language in TERMS else "en"
    currency = COUNTRY_CURRENCY.get(signup.country, "EUR")
    session = stripe_api.post("/checkout/sessions", {
        "mode": "setup",
        "customer": ensure_customer(signup),
        "currency": currency.lower(),
        "payment_method_types": ["card"],
        "locale": STRIPE_LOCALES.get(lang, "auto"),
        "success_url": welcome_url(signup, app),
        "cancel_url": welcome_url(signup, app, cancelled="1"),
        "custom_text": {"submit": {"message": TERMS[lang].format(months=TRIAL_MONTHS, fee=fee_text(currency, lang))}},
        "metadata": {"stugora_signup": signup.pk},
        "setup_intent_data": {"metadata": {"stugora_signup": signup.pk}},
    })
    signup.stripe_checkout_id = session["id"]
    signup.save(update_fields=["stripe_checkout_id"])
    return session["url"]


def confirm(signup: OwnerSignup) -> bool:
    """Whether the card is saved, asking Stripe if it isn't known yet. The saved card becomes
    the customer's default, so invoices are charged to it."""
    if signup.card_saved_at:
        return True
    if not (signup.stripe_checkout_id and enabled()):
        return False
    session = stripe_api.get(f"/checkout/sessions/{signup.stripe_checkout_id}", {"expand": ["setup_intent"]})
    intent = session.get("setup_intent") or {}
    method = intent.get("payment_method") if isinstance(intent, dict) else None
    if session.get("status") != "complete" or not method:
        return False
    stripe_api.post(f"/customers/{signup.stripe_customer_id}", {"invoice_settings": {"default_payment_method": method}})
    signup.stripe_payment_method = method
    signup.card_saved_at = timezone.now()
    signup.save(update_fields=["stripe_payment_method", "card_saved_at"])
    owner = getattr(signup, "owner", None)
    if owner and not owner.stripe_payment_method:
        owner.stripe_payment_method = method
        owner.stripe_customer_id = owner.stripe_customer_id or signup.stripe_customer_id
        owner.save(update_fields=["stripe_payment_method", "stripe_customer_id"])
    return True

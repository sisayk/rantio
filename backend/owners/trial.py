"""The card step after the sign-up form: free months, then the yearly fee (Settings → Prices).

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
from .models import COUNTRY_CURRENCY, OwnerSignup, Pricing

logger = logging.getLogger(__name__)

# Stripe Checkout's own languages; Icelandic isn't one of them.
STRIPE_LOCALES = {"en": "en", "fi": "fi", "sv": "sv", "nb": "nb", "nn": "nb", "da": "da", "et": "et", "lv": "lv",
                  "lt": "lt", "de": "de", "is": "auto"}

# Shown above Stripe's "Save" button (at most 1,200 characters). {free} is FREE below, {rate} the
# commission and {fee} the yearly fee, all from the admin's Settings → Prices (models.Pricing).
TERMS = {
    "en": "{free}. Nothing is charged today: your card is saved for Rantio's invoices. The free period starts when "
          "your cottage's listing goes live. After it, the yearly fee of {fee} + VAT per cottage is charged to this "
          "card. {rate}% + VAT of the bookings Rantio brings is charged monthly, also during the free period. Stop "
          "before the free period ends and there's no yearly fee.",
    "fi": "{free}. Tänään ei veloiteta mitään: korttisi tallennetaan Rantion laskuja varten. Maksuton jakso alkaa, "
          "kun mökkisi ilmoitus julkaistaan. Sen jälkeen kortilta veloitetaan vuosimaksu {fee} + ALV mökkiä kohden. "
          "Rantion tuomista varauksista veloitetaan {rate} % + ALV kuukausittain, myös maksuttoman jakson aikana. Jos "
          "lopetat ennen kuin maksuton jakso päättyy, vuosimaksua ei tule.",
    "sv": "{free}. Inget dras i dag: ditt kort sparas för Rantios fakturor. Gratisperioden börjar när stugans annons "
          "publiceras. Därefter dras årsavgiften {fee} + moms per stuga från kortet. {rate} % + moms av bokningarna "
          "Rantio ger dig dras varje månad, även under gratisperioden. Slutar du innan gratisperioden är slut blir det "
          "ingen årsavgift.",
    "nb": "{free}. Ingenting trekkes i dag: kortet ditt lagres for Rantios fakturaer. Gratisperioden starter når "
          "hyttas annonse publiseres. Etter den trekkes årsavgiften {fee} + mva. per hytte fra kortet. {rate} % + mva. "
          "av bookingene Rantio gir deg trekkes hver måned, også i gratisperioden. Slutter du før gratisperioden er "
          "over, blir det ingen årsavgift.",
    "nn": "{free}. Ingenting blir trekt i dag: kortet ditt blir lagra for fakturaene frå Rantio. Gratisperioden "
          "byrjar når annonsen for hytta blir publisert. Etter den blir årsavgifta {fee} + mva. per hytte trekt frå "
          "kortet. {rate} % + mva. av bookingane Rantio gir deg blir trekt kvar månad, også i gratisperioden. Sluttar "
          "du før gratisperioden er over, blir det inga årsavgift.",
    "da": "{free}. Der trækkes intet i dag: dit kort gemmes til Rantios fakturaer. Gratisperioden begynder, når dit "
          "sommerhus' annonce går online. Derefter trækkes årsgebyret på {fee} + moms pr. sommerhus på kortet. "
          "{rate} % + moms af de bookinger, Rantio skaffer, trækkes hver måned, også i gratisperioden. Stopper du, før "
          "gratisperioden er slut, kommer der intet årsgebyr.",
    "is": "{free}. Ekkert er gjaldfært í dag: kortið þitt er vistað fyrir reikninga Rantio. Ókeypis tímabilið hefst "
          "þegar auglýsing bústaðarins fer í loftið. Eftir það er árgjaldið {fee} + VSK á hvern bústað gjaldfært á "
          "kortið. {rate}% + VSK af bókunum sem Rantio útvegar er gjaldfært mánaðarlega, líka á ókeypis tímabilinu. "
          "Ef þú hættir áður en ókeypis tímabilinu lýkur kemur ekkert árgjald.",
    "et": "{free}. Täna ei võeta midagi: sinu kaart salvestatakse Rantio arvete jaoks. Tasuta periood algab, kui "
          "sinu suvemaja kuulutus avaldatakse. Pärast seda võetakse kaardilt aastatasu {fee} + km suvemaja kohta. "
          "Rantio toodud broneeringutelt võetakse {rate}% + km igakuiselt, ka tasuta perioodi ajal. Kui lõpetad enne "
          "tasuta perioodi lõppu, aastatasu ei tule.",
    "lv": "{free}. Šodien netiek iekasēts nekas: jūsu karte tiek saglabāta Rantio rēķiniem. Bezmaksas periods sākas, "
          "kad jūsu brīvdienu mājas sludinājums tiek publicēts. Pēc tā no kartes tiek iekasēta gada maksa {fee} + PVN "
          "par katru māju. {rate}% + PVN no Rantio piesaistītajām rezervācijām tiek iekasēti katru mēnesi, arī "
          "bezmaksas periodā. Ja pārtraucat pirms bezmaksas perioda beigām, gada maksas nav.",
    "lt": "{free}. Šiandien nieko nenuskaičiuojama: jūsų kortelė išsaugoma Rantio sąskaitoms. Nemokamas laikotarpis "
          "prasideda, kai jūsų sodybos skelbimas paskelbiamas. Po jo iš kortelės nuskaičiuojamas metinis mokestis "
          "{fee} + PVM už kiekvieną sodybą. {rate} % + PVM nuo Rantio atvestų užsakymų nuskaičiuojama kas mėnesį, "
          "taip pat ir nemokamu laikotarpiu. Jei nutrauksite prieš baigiantis nemokamam laikotarpiui, metinio "
          "mokesčio nebus.",
    "de": "{free}. Heute wird nichts abgebucht: Deine Karte wird für die Rechnungen von Rantio hinterlegt. Die "
          "kostenlose Zeit beginnt, sobald das Inserat deines Ferienhauses online ist. Danach wird die Jahresgebühr "
          "von {fee} + MwSt. pro Ferienhaus von dieser Karte abgebucht. {rate} % + MwSt. der Buchungen, die Rantio "
          "bringt, werden monatlich abgebucht, auch während der kostenlosen Zeit. Hörst du vor dem Ende der "
          "kostenlosen Zeit auf, fällt keine Jahresgebühr an.",
}

# "3 months free": (one, few, other) by the language's plural rule (plural_form below).
FREE = {
    "en": ("{n} month free", "{n} months free", "{n} months free"),
    "fi": ("{n} kuukausi maksutta", "{n} kuukautta maksutta", "{n} kuukautta maksutta"),
    "sv": ("{n} månad gratis", "{n} månader gratis", "{n} månader gratis"),
    "nb": ("{n} måned gratis", "{n} måneder gratis", "{n} måneder gratis"),
    "nn": ("{n} månad gratis", "{n} månader gratis", "{n} månader gratis"),
    "da": ("{n} måned gratis", "{n} måneder gratis", "{n} måneder gratis"),
    "is": ("{n} mánuður ókeypis", "{n} mánuðir ókeypis", "{n} mánuðir ókeypis"),
    "et": ("{n} kuu tasuta", "{n} kuud tasuta", "{n} kuud tasuta"),
    "lv": ("{n} mēnesis bez maksas", "{n} mēneši bez maksas", "{n} mēneši bez maksas"),
    "lt": ("{n} mėnuo nemokamai", "{n} mėnesiai nemokamai", "{n} mėnesių nemokamai"),
    "de": ("{n} Monat kostenlos", "{n} Monate kostenlos", "{n} Monate kostenlos"),
}


def plural_form(lang: str, n: int) -> int:
    """0 for the "one" form, 1 for Lithuanian "few", 2 for the rest (CLDR rules for whole numbers)."""
    if lang in ("is", "lv", "lt"):
        if n % 10 == 1 and n % 100 != 11:
            return 0
        if lang == "lt" and 2 <= n % 10 <= 9 and not 12 <= n % 100 <= 19:
            return 1
        return 2 if lang == "lt" else 1 if lang == "lv" and not (n % 10 == 0 or 11 <= n % 100 <= 19) else 2
    return 0 if n == 1 else 2


def rate_text(rate, lang: str) -> str:
    """12 → "12", 12.5 → "12,5" (or "12.5" in English)."""
    text = f"{rate:f}"
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return text if lang == "en" else text.replace(".", ",")


def terms(lang: str, currency: str) -> str:
    p = Pricing.current()
    free = FREE[lang][plural_form(lang, p.trial_months)].format(n=p.trial_months)
    return TERMS[lang].format(free=free, rate=rate_text(p.commission_rate, lang), fee=fee_text(currency, lang))


def fee_text(currency: str, lang: str) -> str:
    amount = int(Pricing.current().yearly_fee(currency))
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
        # No payment_method_types: Stripe refuses it now; the methods shown are set in the
        # Stripe Dashboard (Settings > Payment methods).
        "locale": STRIPE_LOCALES.get(lang, "auto"),
        "success_url": welcome_url(signup, app),
        "cancel_url": welcome_url(signup, app, cancelled="1"),
        "custom_text": {"submit": {"message": terms(lang, currency)}},
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

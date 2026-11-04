"""Text messages: the owner's sign-in code by SMS, sent through Brevo's transactional SMS.

Off until BREVO_API_KEY is set (an API key from Brevo → SMTP & API → API keys, plus SMS
credits bought in Brevo). Phone numbers are handled in international form (+358401234567).
"""

import json
import logging
import re
import urllib.error
import urllib.request

from django.conf import settings

logger = logging.getLogger(__name__)

BREVO_SMS_URL = "https://api.brevo.com/v3/transactionalSMS/sms"

# Calling codes of the countries Rantio works in, for numbers written the local way (040…).
CALLING_CODES = {"FI": "358", "SE": "46", "NO": "47", "DK": "45", "IS": "354", "EE": "372", "LV": "371", "LT": "370"}


def enabled() -> bool:
    return bool(settings.BREVO_API_KEY)


def normalize(raw: str, country: str = "FI") -> str:
    """'+358 40 123 4567', '00358401234567' or (in Finland) '040 123 4567' → '+358401234567'; '' if it isn't a number."""
    s = re.sub(r"[\s().-]", "", raw or "")
    if s.startswith("00"):
        s = "+" + s[2:]
    elif s.startswith("0") and country in CALLING_CODES:
        s = "+" + CALLING_CODES[country] + s[1:]
    elif s and not s.startswith("+") and country in CALLING_CODES and not s.startswith(CALLING_CODES[country]):
        s = "+" + CALLING_CODES[country] + s
    elif s and not s.startswith("+"):
        s = "+" + s
    return s if re.fullmatch(r"\+[1-9]\d{6,14}", s) else ""


def send(to: str, text: str) -> None:
    """Sends one SMS; raises if Brevo refuses it (the caller decides what the visitor sees)."""
    req = urllib.request.Request(
        BREVO_SMS_URL,
        data=json.dumps(
            {"sender": settings.SMS_SENDER, "recipient": to.lstrip("+"), "content": text, "type": "transactional"}
        ).encode(),
        headers={"api-key": settings.BREVO_API_KEY, "Content-Type": "application/json", "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 (fixed https URL)
        res.read()


STATS_URL = "https://api.brevo.com/v3/transactionalSMS/statistics/aggregatedReport?days=7"


def check_key() -> tuple[bool, str]:
    """Uses the key once (reading last week's SMS totals), which keeps it from expiring: Brevo
    turns off keys unused for 90 days. (True, "") when Brevo accepts it, else (False, why)."""
    req = urllib.request.Request(STATS_URL, headers={"api-key": settings.BREVO_API_KEY, "Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=15) as res:  # noqa: S310 (fixed https URL)
            res.read()
        return True, ""
    except urllib.error.HTTPError as e:
        return False, f"Brevo answered {e.code}"
    except OSError as e:
        return False, f"Brevo couldn't be reached ({e})"

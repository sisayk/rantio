"""The Mökki monitor: the box in the cottage sends readings, Rantio keeps them, works out alerts
and tells the host on their phone (and by email for the serious ones).

The box (nRF9151, LTE-M) posts to POST /api/monitor/readings/ with the header
    Authorization: Device <serial>:<secret>
and a JSON body: one reading, or {"readings": [...]} for ones it kept while offline. A reading:
    {"at": "2026-11-05T12:00:00Z" (optional, else now), "temp": 21.5, "sauna": 23.0,
     "humidity": 45, "leak": false, "door": false, "mains": true, "battery": 87, "signal": -95,
     "fw": "0.3.1"}
Every field is optional. The answer tells the box how often to report: {"ok": true, "interval": 900}.
See docs/monitor-device-api.md.

Alerts (each opens once and closes when it's over, so the host isn't told twice):
  frost    inside at or below the host's frost limit (default 5 °C)
  leak     the leak sensor wet
  power    mains power gone (the box runs on its battery)
  sauna    the sauna hot (60 °C+) for longer than the host's limit, or 1 hour in an empty cottage
  door     the door opened while nobody is booked (the calendar says the cottage is empty)
  battery  on battery and 15 % or less
  offline  nothing heard for 3 hours (checked every 15 minutes by manage.py monitor check)
  arrival  guests arrive today or tomorrow and it's well below the wished-for temperature
"""

from __future__ import annotations

import hashlib
import hmac
import logging
import secrets
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal, InvalidOperation

from django.conf import settings
from django.core.cache import cache
from django.core.mail import send_mail
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import app
from .models import Cottage, MonitorAlert, MonitorDevice, MonitorReading
from .monitor_texts import ALERTS
from .portal import IsOwner

logger = logging.getLogger(__name__)

INTERVAL = 900  # seconds between reports the box is asked for
OFFLINE_AFTER = timedelta(hours=3)
SAUNA_HOT = Decimal("60")
SAUNA_COOL = Decimal("50")
SAUNA_EMPTY_AFTER = timedelta(hours=1)
BATTERY_LOW, BATTERY_OK = 15, 25
KEEP_READINGS = timedelta(days=180)
EMAILED = {MonitorAlert.Kind.FROST, MonitorAlert.Kind.LEAK, MonitorAlert.Kind.POWER, MonitorAlert.Kind.DOOR, MonitorAlert.Kind.OFFLINE}
CLAIM_TRIES = 10  # wrong claim codes an owner may enter in an hour

K = MonitorAlert.Kind


def _hash(value: str) -> str:
    return hashlib.sha256(value.strip().upper().encode()).hexdigest()


# ---------- making boxes ----------

def _serial() -> str:
    alphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"  # no 0/O, 1/I/L
    while True:
        s = "MM-" + "".join(secrets.choice(alphabet) for _ in range(6))
        if not MonitorDevice.objects.filter(serial=s).exists():
            return s


def new_device() -> tuple[MonitorDevice, str, str]:
    """A new box: returns it with its claim code (for the sticker) and its secret (for the firmware).
    Neither can be shown again."""
    code = "-".join("".join(secrets.choice("23456789ABCDEFGHJKMNPQRSTUVWXYZ") for _ in range(4)) for _ in range(2))
    secret = secrets.token_urlsafe(24)
    d = MonitorDevice.objects.create(serial=_serial(), claim_code_hash=_hash(code), secret_hash=hashlib.sha256(secret.encode()).hexdigest())
    return d, code, secret


# ---------- the calendar ----------

def occupied(c: Cottage | None, now: datetime | None = None) -> bool:
    """Is anyone meant to be there today: a booking, the owner's own dates, or a departure day."""
    if c is None:
        return False
    from . import calendar

    today = timezone.localdate(now or timezone.now())
    return any(e.busy and e.start <= today <= e.end for e in calendar.entries([c], today - timedelta(days=60), today + timedelta(days=1), requests=False))


# ---------- telling the host ----------

def _lang(d: MonitorDevice) -> str:
    lang = (d.owner.language if d.owner else "en") or "en"
    return lang if lang in ALERTS else "en"


def _deg(value, lang: str) -> str:
    if value is None:
        return "–"
    text = f"{Decimal(value):.1f}"
    return (text if lang == "en" else text.replace(".", ",")) + " °C"


def _text(d: MonitorDevice, key: str, **vars) -> tuple[str, str]:
    lang = _lang(d)
    title, body = ALERTS[lang].get(key) or ALERTS["en"][key]
    vars.setdefault("cottage", d.cottage.name if d.cottage else (d.name or d.serial))
    return title.format(**vars), body.format(**vars)


def _tell(d: MonitorDevice, key: str, *, email: bool = False, **vars) -> None:
    if not d.owner:
        return
    title, body = _text(d, key, **vars)
    app.notify(d.owner, title, body, {"type": "monitor", "id": d.pk})
    if email and d.owner.email:
        def send():
            try:
                send_mail(title, body, settings.DEFAULT_FROM_EMAIL, [d.owner.email])
            except Exception:
                logger.exception("Could not email a monitor alert to owner %s", d.owner_id)
        transaction.on_commit(send)


def _open(d: MonitorDevice, kind: str) -> MonitorAlert | None:
    return d.alerts.filter(kind=kind, ended_at__isnull=True).first()


def _start(d: MonitorDevice, kind: str, value: str, key: str | None = None, **vars) -> None:
    if _open(d, kind):
        return
    MonitorAlert.objects.create(device=d, kind=kind, value=value[:60])
    _tell(d, key or kind, email=kind in EMAILED, value=value, **vars)


def _end(d: MonitorDevice, kind: str, key: str | None = None, **vars) -> None:
    a = _open(d, kind)
    if not a:
        return
    a.ended_at = timezone.now()
    a.save(update_fields=["ended_at"])
    if key:
        _tell(d, key, **vars)


# ---------- the rules ----------

def _hot_since(d: MonitorDevice, now: datetime) -> datetime | None:
    """When the sauna's current hot spell began (the first hot reading after the last cool one)."""
    cool = d.readings.filter(at__lte=now).exclude(temp_sauna__gte=SAUNA_HOT).order_by("-at").values_list("at", flat=True).first()
    hot = d.readings.filter(at__lte=now, temp_sauna__gte=SAUNA_HOT)
    if cool:
        hot = hot.filter(at__gt=cool)
    return hot.order_by("at").values_list("at", flat=True).first()


def evaluate(d: MonitorDevice, r: MonitorReading, now: datetime | None = None) -> None:
    """Opens and closes alerts from the newest reading."""
    if not d.owner:
        return
    now = now or timezone.now()
    lang = _lang(d)
    empty = not occupied(d.cottage, now)
    if r.temp_inside is not None:
        if r.temp_inside <= d.frost_limit:
            _start(d, K.FROST, _deg(r.temp_inside, lang))
        elif r.temp_inside > d.frost_limit + 1:
            _end(d, K.FROST, "frost_end", value=_deg(r.temp_inside, lang))
    if r.leak is True:
        _start(d, K.LEAK, "wet")
    elif r.leak is False:
        _end(d, K.LEAK, "leak_end")
    if r.mains is False:
        _start(d, K.POWER, f"{r.battery} %" if r.battery is not None else "–")
    elif r.mains is True:
        _end(d, K.POWER, "power_end")
    if r.temp_sauna is not None:
        if r.temp_sauna >= SAUNA_HOT:
            since = _hot_since(d, now) or now
            if empty and now - since >= SAUNA_EMPTY_AFTER:
                _start(d, K.SAUNA, _deg(r.temp_sauna, lang), "sauna_empty")
            elif now - since >= timedelta(hours=d.sauna_hours):
                _start(d, K.SAUNA, _deg(r.temp_sauna, lang), hours=d.sauna_hours)
        elif r.temp_sauna < SAUNA_COOL:
            _end(d, K.SAUNA, "sauna_end", value=_deg(r.temp_sauna, lang))
    if r.door_open is True and empty:
        _start(d, K.DOOR, "open")
    elif r.door_open is False:
        _end(d, K.DOOR)
    if r.battery is not None:
        if r.battery <= BATTERY_LOW and r.mains is not True:
            _start(d, K.BATTERY, f"{r.battery} %")
        elif r.battery >= BATTERY_OK or r.mains is True:
            _end(d, K.BATTERY)


def _when(d: MonitorDevice, at: datetime) -> str:
    local = timezone.localtime(at)
    return local.strftime("%d.%m. %H:%M" if _lang(d) != "en" else "%d %b %H:%M")


def check(now: datetime | None = None) -> dict:
    """Every 15 minutes: boxes gone quiet, guests arriving to a cold cottage, old readings away."""
    from . import calendar

    now = now or timezone.now()
    counts = {"offline": 0, "arrival": 0}
    for d in MonitorDevice.objects.filter(owner__isnull=False).select_related("owner", "cottage"):
        if d.last_seen_at and now - d.last_seen_at >= OFFLINE_AFTER and not _open(d, K.OFFLINE):
            _start(d, K.OFFLINE, d.last_seen_at.isoformat(), when=_when(d, d.last_seen_at))
            counts["offline"] += 1
        temp = (d.last or {}).get("temp")
        if not d.cottage or temp is None:
            continue
        today = timezone.localdate(now)
        for e in calendar.entries([d.cottage], today, today + timedelta(days=2), requests=False):
            if e.kind != "booking" or e.start not in (today, today + timedelta(days=1)):
                continue
            stay = f"booking:{e.id}"
            if Decimal(str(temp)) >= d.arrival_temp - 3 or d.alerts.filter(kind=K.ARRIVAL, value=stay).exists():
                continue
            lang = _lang(d)
            MonitorAlert.objects.create(device=d, kind=K.ARRIVAL, value=stay, ended_at=now)
            when = e.start.strftime("%d.%m." if lang != "en" else "%d %b")
            _tell(d, "arrival", when=when, temp=_deg(temp, lang), wanted=_deg(d.arrival_temp, lang))
            counts["arrival"] += 1
    MonitorReading.objects.filter(at__lt=now - KEEP_READINGS).delete()
    return counts


# ---------- readings coming in ----------

FIELDS = {"temp": "temp_inside", "sauna": "temp_sauna", "humidity": "humidity", "leak": "leak", "door": "door_open",
          "mains": "mains", "battery": "battery", "signal": "signal"}


def _device_for(request) -> MonitorDevice | None:
    header = request.headers.get("Authorization", "")
    if not header.startswith("Device ") or ":" not in header:
        return None
    serial, secret = header[7:].strip().split(":", 1)
    d = MonitorDevice.objects.select_related("owner", "cottage").filter(serial=serial.strip().upper()).first()
    if not d or not hmac.compare_digest(d.secret_hash, hashlib.sha256(secret.strip().encode()).hexdigest()):
        return None
    return d


def _clean(row: dict, now: datetime) -> dict | None:
    if not isinstance(row, dict):
        return None
    at = parse_datetime(str(row.get("at") or "")) if row.get("at") else now
    if at is None:
        return None
    if timezone.is_naive(at):
        at = timezone.make_aware(at, dt_timezone.utc)
    if at > now + timedelta(minutes=5) or at < now - timedelta(days=7):
        return None
    out = {"at": at}
    for key, field in FIELDS.items():
        v = row.get(key)
        if v is None:
            continue
        try:
            if field in ("leak", "door_open", "mains"):
                out[field] = bool(v)
            elif field in ("temp_inside", "temp_sauna"):
                t = Decimal(str(v)).quantize(Decimal("0.1"))
                if Decimal("-60") <= t <= Decimal("150"):
                    out[field] = t
            elif field == "humidity":
                out[field] = max(0, min(100, int(v)))
            elif field == "battery":
                out[field] = max(0, min(100, int(v)))
            elif field == "signal":
                out[field] = max(-160, min(0, int(v)))
        except (InvalidOperation, TypeError, ValueError):
            continue
    return out


def _last_dict(r: MonitorReading) -> dict:
    return {
        "at": r.at.isoformat(),
        "temp": float(r.temp_inside) if r.temp_inside is not None else None,
        "sauna": float(r.temp_sauna) if r.temp_sauna is not None else None,
        "humidity": r.humidity, "leak": r.leak, "door": r.door_open, "mains": r.mains, "battery": r.battery, "signal": r.signal,
    }


class ReadingsView(APIView):
    """POST from the box itself (see the module's docstring). No session, no CSRF: the device secret."""

    authentication_classes: list = []
    permission_classes: list = []

    def post(self, request):
        d = _device_for(request)
        if not d:
            return Response({"error": "unknown_device"}, status=status.HTTP_401_UNAUTHORIZED)
        # A box sends every 15 minutes; a burst is a fault or a stolen secret.
        if not cache.add(f"monitor:rate:{d.pk}:{timezone.now():%Y%m%d%H%M}", 1, 120):
            if cache.incr(f"monitor:rate:{d.pk}:{timezone.now():%Y%m%d%H%M}") > 10:
                return Response({"error": "too_often"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        body = request.data if isinstance(request.data, dict) else {}
        rows = body.get("readings") if isinstance(body.get("readings"), list) else [body]
        now = timezone.now()
        clean = [c for c in (_clean(r, now) for r in rows[:200]) if c]
        if not clean:
            return Response({"error": "no_readings"}, status=status.HTTP_400_BAD_REQUEST)
        clean.sort(key=lambda c: c["at"])
        saved = [MonitorReading(device=d, **c) for c in clean]
        MonitorReading.objects.bulk_create(saved)
        newest = saved[-1]
        back = d.last_seen_at and now - d.last_seen_at >= OFFLINE_AFTER
        d.last_seen_at, d.last = now, _last_dict(newest)
        if fw := str(body.get("fw") or "")[:30]:
            d.firmware = fw
        d.save(update_fields=["last_seen_at", "last", "firmware"])
        if back or _open(d, K.OFFLINE):
            _end(d, K.OFFLINE, "offline_end")
        evaluate(d, newest, now)
        return Response({"ok": True, "interval": INTERVAL, "saved": len(saved)})


# ---------- the host's side ----------

def _alert_row(a: MonitorAlert) -> dict:
    return {"id": a.pk, "kind": a.kind, "started_at": a.started_at.isoformat(), "ended_at": a.ended_at.isoformat() if a.ended_at else None, "value": a.value}


def device_row(d: MonitorDevice, *, now: datetime | None = None) -> dict:
    now = now or timezone.now()
    return {
        "id": d.pk,
        "serial": d.serial,
        "name": d.name,
        "cottage": {"id": d.cottage_id, "name": d.cottage.name} if d.cottage else None,
        "online": bool(d.last_seen_at and now - d.last_seen_at < OFFLINE_AFTER),
        "last_seen_at": d.last_seen_at.isoformat() if d.last_seen_at else None,
        "last": d.last or {},
        "firmware": d.firmware,
        "occupied": occupied(d.cottage, now),
        "alerts": [_alert_row(a) for a in d.alerts.filter(ended_at__isnull=True)],
        "settings": {"frost_limit": float(d.frost_limit), "arrival_temp": float(d.arrival_temp), "sauna_hours": d.sauna_hours},
    }


def history(d: MonitorDevice, hours: int = 48, now: datetime | None = None) -> list[dict]:
    """One point per hour: the average inside temperature and the hottest sauna reading."""
    now = now or timezone.now()
    since = now - timedelta(hours=hours)
    buckets: dict[datetime, list[MonitorReading]] = {}
    for r in d.readings.filter(at__gte=since).order_by("at"):
        buckets.setdefault(r.at.replace(minute=0, second=0, microsecond=0), []).append(r)
    out = []
    for hour, rows in sorted(buckets.items()):
        temps = [r.temp_inside for r in rows if r.temp_inside is not None]
        saunas = [r.temp_sauna for r in rows if r.temp_sauna is not None]
        out.append({
            "at": hour.isoformat(),
            "temp": round(float(sum(temps) / len(temps)), 1) if temps else None,
            "sauna": float(max(saunas)) if saunas else None,
        })
    return out


def _mine(request, pk) -> MonitorDevice:
    return get_object_or_404(MonitorDevice.objects.select_related("cottage", "owner"), pk=pk, owner=request.user.owner)


def _cottage(request, value) -> Cottage | None | bool:
    """The host's cottage by id; None to unlink; False if it isn't theirs."""
    if value in (None, ""):
        return None
    try:
        return Cottage.objects.get(pk=int(value), owner=request.user.owner)
    except (Cottage.DoesNotExist, TypeError, ValueError):
        return False


class MonitorsView(APIView):
    """GET the host's boxes; POST {serial, code, cottage} connects a new one (the code is on its sticker)."""

    permission_classes = [IsOwner]

    def get(self, request):
        now = timezone.now()
        return Response([device_row(d, now=now) for d in request.user.owner.monitors.select_related("cottage")])

    def post(self, request):
        o = request.user.owner
        tries_key = f"monitor:claim:{o.pk}:{timezone.now():%Y%m%d%H}"
        if (cache.get(tries_key) or 0) >= CLAIM_TRIES:
            return Response({"error": "too_many_tries"}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        serial = str(request.data.get("serial") or "").strip().upper().replace(" ", "")
        if serial and not serial.startswith("MM-"):
            serial = "MM-" + serial.removeprefix("MM")
        code = str(request.data.get("code") or "").strip().upper().replace(" ", "")
        if len(code) == 8 and "-" not in code:
            code = code[:4] + "-" + code[4:]
        d = MonitorDevice.objects.filter(serial=serial).first()
        if not d or not hmac.compare_digest(d.claim_code_hash, _hash(code)):
            cache.add(tries_key, 0, 3600)
            cache.incr(tries_key)
            return Response({"error": "wrong_code"}, status=status.HTTP_400_BAD_REQUEST)
        if d.owner_id and d.owner_id != o.pk:
            return Response({"error": "taken"}, status=status.HTTP_409_CONFLICT)
        cottage = _cottage(request, request.data.get("cottage"))
        if cottage is False:
            return Response({"error": "not_your_cottage"}, status=status.HTTP_400_BAD_REQUEST)
        d.owner, d.cottage, d.claimed_at = o, cottage, timezone.now()
        d.save(update_fields=["owner", "cottage", "claimed_at"])
        return Response(device_row(d), status=status.HTTP_201_CREATED)


class MonitorView(APIView):
    """GET one box with its last 48 hours and alerts; PATCH name, cottage and limits; DELETE disconnects it."""

    permission_classes = [IsOwner]

    def get(self, request, pk):
        d = _mine(request, pk)
        row = device_row(d)
        row["history"] = history(d)
        row["recent_alerts"] = [_alert_row(a) for a in d.alerts.filter(started_at__gte=timezone.now() - timedelta(days=30))[:50]]
        return Response(row)

    def patch(self, request, pk):
        d = _mine(request, pk)
        data, fields, errors = request.data, [], {}
        if "name" in data:
            d.name = str(data.get("name") or "").strip()[:60]
            fields.append("name")
        if "cottage" in data:
            c = _cottage(request, data.get("cottage"))
            if c is False:
                errors["cottage"] = ["invalid"]
            else:
                d.cottage = c
                fields.append("cottage")
        for key, low, high in (("frost_limit", -10, 15), ("arrival_temp", 5, 28)):
            if key in data:
                try:
                    v = Decimal(str(data.get(key))).quantize(Decimal("0.5"))
                    if not low <= v <= high:
                        raise InvalidOperation
                    setattr(d, key, v)
                    fields.append(key)
                except (InvalidOperation, TypeError, ValueError):
                    errors[key] = ["invalid"]
        if "sauna_hours" in data:
            try:
                h = int(data.get("sauna_hours"))
                if not 1 <= h <= 12:
                    raise ValueError
                d.sauna_hours = h
                fields.append("sauna_hours")
            except (TypeError, ValueError):
                errors["sauna_hours"] = ["invalid"]
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)
        if fields:
            d.save(update_fields=fields)
        return Response(device_row(d))

    def delete(self, request, pk):
        """Disconnect: the box can be given to someone else; its readings and alerts go."""
        d = _mine(request, pk)
        d.readings.all().delete()
        d.alerts.all().delete()
        d.owner, d.cottage, d.name, d.last, d.claimed_at = None, None, "", {}, None
        d.save(update_fields=["owner", "cottage", "name", "last", "claimed_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

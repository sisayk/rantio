"""The Rantio admin dashboard (UNFOLD["DASHBOARD_CALLBACK"]), laid out like Bona's.

Read-only counts and sums for /admin/: what needs someone today, the main numbers,
three small charts and recent activity. Money is in euros; bookings in kronor are
converted at the day's ECB rate.
"""

from __future__ import annotations

import datetime as dt
from collections import Counter
from decimal import Decimal

from django.contrib.admin.models import LogEntry
from django.urls import reverse
from django.utils import timezone

from config.admin_nav import BADGE_LINKS, badge_count


def _url(name: str, query: str = "") -> str:
    return reverse(f"admin:owners_{name}_changelist") + (f"?{query}" if query else "")


def _eur(v: Decimal | float) -> str:
    return f"€{v:,.0f}".replace(",", " ")


def _line(values: list[float], width=400, height=90, pad=6) -> tuple[str, str]:
    """An SVG line and the area under it, in a 400×90 box."""
    if not values:
        return "", ""
    top = max(values) or 1
    step = (width - 2 * pad) / max(len(values) - 1, 1)
    pts = [(pad + i * step, pad + (height - 2 * pad) * (1 - v / top)) for i, v in enumerate(values)]
    line = "M " + " L ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    area = f"{line} L {pts[-1][0]:.1f},{height} L {pts[0][0]:.1f},{height} Z"
    return line, area


def _bars(values: list[int], labels: list[str], titles: list[str], width=400, height=90, gap=6):
    top = max(values) or 1
    w = (width - gap * (len(values) - 1)) / len(values)
    out = []
    for i, v in enumerate(values):
        h = max(v / top * (height - 4), 2 if v else 0)
        out.append({"x": f"{i * (w + gap):.1f}", "y": f"{height - h:.1f}", "w": f"{w:.1f}", "h": f"{h:.1f}",
                    "label": labels[i], "title": titles[i]})
    return out


def _ago(when: dt.datetime, now: dt.datetime) -> str:
    s = int((now - when).total_seconds())
    if s < 3600:
        return f"{max(s // 60, 1)} min ago"
    if s < 86400:
        return f"{s // 3600} h ago"
    return f"{s // 86400} d ago"


def dashboard_callback(request, context):
    from owners import rates as fx
    from owners.models import Booking, Conversation, Cottage, ExchangeRate, Message, Owner, OwnerSignup

    now = timezone.now()
    today = timezone.localdate()
    month_start = today.replace(day=1)
    last_month_start = (month_start - dt.timedelta(days=1)).replace(day=1)
    days30 = today - dt.timedelta(days=30)

    # ---- money in euros ----------------------------------------------------
    per_eur, rate_day = fx.current() if Cottage.objects.exclude(country__in=["FI", "EE", "LV", "LT"]).exists() else ({}, None)

    def eur(amount: Decimal, cottage: Cottage) -> Decimal:
        return fx.convert(amount, cottage.currency, "EUR", per_eur) if cottage.currency != "EUR" else amount

    stays = Booking.objects.filter(cancelled=False).select_related("cottage", "cottage__owner")

    # ---- counts -------------------------------------------------------------
    owners = Owner.objects.count()
    pilots = Owner.objects.filter(is_pilot=True).count()
    cottages = Cottage.objects.count()
    live = Cottage.objects.filter(status=Cottage.Status.LIVE).count()
    setup = badge_count("setup")
    paused = Cottage.objects.filter(status=Cottage.Status.PAUSED).count()
    signups_new = badge_count("signups")
    signups_total = OwnerSignup.objects.count()
    team_waiting = badge_count("team_inbox")

    this_month = list(stays.filter(check_in__year=today.year, check_in__month=today.month))
    last_month = list(stays.filter(check_in__gte=last_month_start, check_in__lt=month_start))
    staying_now = stays.filter(check_in__lte=today, check_out__gt=today).count()
    arriving_week = stays.filter(check_in__gte=today, check_in__lt=today + dt.timedelta(days=7)).count()
    cancelled_30 = Booking.objects.filter(cancelled=True, check_in__gte=days30).count()

    last30 = list(stays.filter(check_in__gte=days30, check_in__lte=today))
    commission_30 = sum((eur(b.commission, b.cottage) for b in last30), Decimal(0))
    payout_30 = sum((eur(b.owner_payout, b.cottage) for b in last30), Decimal(0))
    year_stays = list(stays.filter(check_in__year=today.year))
    commission_year = sum((eur(b.commission, b.cottage) for b in year_stays), Decimal(0))

    fees_due = []
    for c in Cottage.objects.filter(listing_started_on__isnull=False).select_related("owner"):
        n = c.listing_year_on(today)
        if n:
            nxt = c.listing_year_starts_on(n + 1)
            if nxt <= today + dt.timedelta(days=30):
                fees_due.append((c, nxt, c.yearly_fee(n + 1)))

    open_threads = Conversation.objects.filter(archived=False).count()
    msgs_week = Message.objects.filter(created_at__gte=now - dt.timedelta(days=7)).count()

    newest_rate = ExchangeRate.objects.order_by("-fetched_at").first()
    rates_stale = per_eur and (not newest_rate or newest_rate.fetched_at < now - dt.timedelta(days=3))

    # ---- alerts: what someone should do today --------------------------------
    alerts = []
    if signups_new:
        alerts.append({"tone": "warn", "title": f"{signups_new} new owner sign-up{'s' if signups_new > 1 else ''} to contact",
                       "body": "Owners who filled in the rantio.fi form and have not heard from us yet.",
                       "link": _url("ownersignup", BADGE_LINKS["signups"]), "cta": "Open sign-ups"})
    if team_waiting:
        alerts.append({"tone": "danger", "title": f"{team_waiting} guest{'s' if team_waiting > 1 else ''} waiting for an answer",
                       "body": "Enquiries about example cottages with no owner yet: the team answers these.",
                       "link": _url("conversation", BADGE_LINKS["team_inbox"]), "cta": "Answer"})
    if setup:
        alerts.append({"tone": "info", "title": f"{setup} cottage{'s' if setup > 1 else ''} still being set up",
                       "body": "Intake received or listings in progress; not live on the sites yet.",
                       "link": _url("cottage", BADGE_LINKS["setup"]), "cta": "View"})
    if fees_due:
        alerts.append({"tone": "info", "title": f"{len(fees_due)} yearly fee{'s' if len(fees_due) > 1 else ''} due within 30 days",
                       "body": ", ".join(f"{c.name} ({d:%-d %b})" for c, d, _ in fees_due[:4]),
                       "link": _url("cottage"), "cta": "Cottages"})
    if rates_stale:
        alerts.append({"tone": "warn", "title": "Exchange rates are more than 3 days old",
                       "body": "The ECB could not be reached; kronor prices use the last rates we have.",
                       "link": _url("exchangerate"), "cta": "Rates"})
    if not alerts:
        alerts.append({"tone": "ok", "title": "All clear", "body": "Nobody is waiting on the team right now.",
                       "link": "", "cta": ""})

    # ---- KPI cards ---------------------------------------------------------
    def trend(now_n, before_n, word="last month"):
        if not before_n:
            return ("flat", f"{now_n} so far") if now_n else ("flat", "none yet")
        pct = round((now_n - before_n) / before_n * 100)
        return ("up" if pct > 0 else "down" if pct < 0 else "flat", f"{abs(pct)}% vs {word}")

    b_dir, b_trend = trend(len(this_month), len(last_month))
    kpis = [
        {"label": "Owners", "value": owners, "dir": "flat", "trend": f"{pilots} pilot{'s' if pilots != 1 else ''}",
         "tone": "green", "icon": "person", "link": _url("owner")},
        {"label": "Live cottages", "value": live, "dir": "flat", "trend": f"{cottages} in all, {setup} in set-up",
         "tone": "blue", "icon": "cottage", "link": _url("cottage", "status__exact=live")},
        {"label": "Stays this month", "value": len(this_month), "dir": b_dir, "trend": b_trend,
         "tone": "violet", "icon": "event", "link": _url("booking")},
        {"label": "Commission, 30 days", "value": _eur(commission_30), "dir": "flat", "trend": f"{_eur(commission_year)} this year",
         "tone": "orange", "icon": "payments", "link": _url("booking")},
        {"label": "Guests waiting", "value": team_waiting, "dir": "flat", "trend": f"{open_threads} open conversations",
         "tone": "rose", "icon": "forum", "link": _url("conversation", BADGE_LINKS["team_inbox"])},
    ]

    # ---- charts --------------------------------------------------------------
    weeks = [today - dt.timedelta(weeks=i) for i in range(11, -1, -1)]
    signup_weeks = [OwnerSignup.objects.filter(created_at__date__gt=w - dt.timedelta(weeks=1), created_at__date__lte=w).count()
                    for w in weeks]
    commission_weeks = []
    for w in weeks:
        start = w - dt.timedelta(weeks=1)
        commission_weeks.append(float(sum((eur(b.commission, b.cottage)
                                           for b in stays.filter(check_in__gt=start, check_in__lte=w)), Decimal(0))))
    month_labels, seen = [], set()
    for i, w in enumerate(weeks):
        if w.month not in seen:
            seen.add(w.month)
            month_labels.append({"label": f"{w:%b}", "pct": round(2 + i / 11 * 96)})
    days = [today + dt.timedelta(days=i) for i in range(14)]
    arrivals = Counter(stays.filter(check_in__gte=today, check_in__lt=today + dt.timedelta(days=14)).values_list("check_in", flat=True))
    arrival_values = [arrivals.get(d, 0) for d in days]
    signup_line, signup_area = _line([float(v) for v in signup_weeks])
    commission_line, commission_area = _line(commission_weeks)

    # ---- breakdowns ----------------------------------------------------------
    by_channel = Counter((b.channel, b.get_channel_display()) for b in year_stays)
    by_country = Counter((c.country, c.get_country_display()) for c in Cottage.objects.all())

    # ---- recent activity -----------------------------------------------------
    activity = []
    for s in OwnerSignup.objects.order_by("-created_at")[:5]:
        activity.append((s.created_at, {"icon": "how_to_reg", "tone": "green", "title": f"{s.name} signed up",
                                        "sub": f"{s.get_country_display()} · {s.cottage_count} cottage(s)",
                                        "link": reverse("admin:owners_ownersignup_change", args=[s.pk])}))
    for m in Message.objects.select_related("conversation", "conversation__cottage").filter(sender="guest").order_by("-created_at")[:6]:
        c = m.conversation
        activity.append((m.created_at, {"icon": "forum", "tone": "blue", "title": f"{c.guest_name} wrote",
                                        "sub": c.cottage.name if c.cottage else (c.listing_slug or "Rantio"),
                                        "link": reverse("admin:owners_conversation_change", args=[c.pk])}))
    for b in Booking.objects.select_related("cottage").order_by("-created_at")[:5]:
        activity.append((b.created_at, {"icon": "event", "tone": "orange", "title": f"Stay booked on {b.get_channel_display()}",
                                        "sub": f"{b.cottage.name} · {b.check_in:%-d %b}–{b.check_out:%-d %b}",
                                        "link": reverse("admin:owners_booking_change", args=[b.pk])}))
    for e in LogEntry.objects.select_related("user", "content_type").order_by("-action_time")[:5]:
        verb = {1: "added", 2: "changed", 3: "deleted"}.get(e.action_flag, "edited")
        activity.append((e.action_time, {"icon": "edit", "tone": "amber", "title": f"{e.user.get_username()} {verb} {e.object_repr}",
                                         "sub": str(e.content_type.name) if e.content_type_id else "", "link": ""}))
    activity.sort(key=lambda a: a[0], reverse=True)
    activity = [{**a, "ago": _ago(t, now)} for t, a in activity[:9]]

    local = timezone.localtime(now)
    context.update({
        "st_now": local,
        "st_date_long": f"{local:%A, %-d %B %Y}",
        "st_week": local.isocalendar().week,
        "st_alerts": alerts,
        "st_kpis": kpis,
        "st_queues": [
            {"label": "New owner sign-ups", "icon": "how_to_reg", "n": signups_new, "link": _url("ownersignup", BADGE_LINKS["signups"])},
            {"label": "Guests waiting for the team", "icon": "forum", "n": team_waiting, "link": _url("conversation", BADGE_LINKS["team_inbox"])},
            {"label": "Cottages in set-up", "icon": "cottage", "n": setup, "link": _url("cottage", BADGE_LINKS["setup"])},
        ],
        "st_signups": {"now": signup_weeks[-1], "line": signup_line, "area": signup_area, "total": signups_total},
        "st_commission": {"now": _eur(commission_weeks[-1]), "line": commission_line, "area": commission_area,
                          "payout": _eur(payout_30), "rate_day": rate_day},
        "st_month_labels": month_labels,
        "st_arrivals": {"today": arrival_values[0], "total": sum(arrival_values),
                        "bars": _bars(arrival_values, [f"{d:%-d}" for d in days],
                                      [f"{d:%a %-d %b}: {v} arrival{'s' if v != 1 else ''}" for d, v in zip(days, arrival_values)])},
        "st_panels": {
            "owners": [
                ("Owners", owners, _url("owner")),
                ("Pilot owners", pilots, _url("owner", "is_pilot__exact=1")),
                ("Sign-ups, all", signups_total, _url("ownersignup")),
                ("Sign-ups to contact", signups_new, _url("ownersignup", BADGE_LINKS["signups"])),
                ("Cottages live", live, _url("cottage", "status__exact=live")),
                ("Cottages in set-up", setup, _url("cottage", BADGE_LINKS["setup"])),
                ("Cottages paused", paused, _url("cottage", "status__exact=paused")),
            ],
            "stays": [
                ("Staying now", staying_now, _url("booking")),
                ("Arriving in 7 days", arriving_week, _url("booking")),
                ("Stays this month", len(this_month), _url("booking")),
                ("Stays last month", len(last_month), _url("booking")),
                ("Cancelled, 30 days", cancelled_30, _url("booking", "cancelled__exact=1")),
                ("Owner payouts, 30 days", _eur(payout_30), _url("booking")),
                ("Commission, 30 days", _eur(commission_30), _url("booking")),
            ],
            "guests": [
                ("Open conversations", open_threads, _url("conversation", "archived__exact=0")),
                ("Waiting for the team", team_waiting, _url("conversation", BADGE_LINKS["team_inbox"])),
                ("Messages, 7 days", msgs_week, _url("conversation")),
            ],
        },
        "st_channels": [{"code": k[0], "name": k[1], "n": n} for k, n in by_channel.most_common(8)],
        "st_countries": [{"code": k[0], "name": k[1], "n": n} for k, n in by_country.most_common(8)],
        "st_activity": activity,
    })
    return context

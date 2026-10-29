"""Sidebar for the Stugora admin (UNFOLD["SIDEBAR"]["navigation"]), built like Bona's.

Grouped by the job being done rather than by Django app; each person sees only what
they may open; the queues that need someone carry a count. Anything registered but
not listed here still shows under "Other".

Import-safe from settings.py: no model imports at the top.
"""

from __future__ import annotations

from django.urls import NoReverseMatch, reverse

# (title, icon, (app_label, model_name, querystring), badge key or None)
GROUPS = [
    ("Owners", [
        ("Sign-ups", "how_to_reg", ("owners", "ownersignup", ""), "signups"),
        ("Owners", "person", ("owners", "owner", ""), None),
        ("Cottages", "cottage", ("owners", "cottage", ""), "setup"),
    ]),
    ("Stays", [
        ("Bookings", "event", ("owners", "booking", ""), None),
        ("Booking emails", "mark_email_read", ("owners", "inboundemail", ""), "booking_emails"),
    ]),
    ("Guests", [
        ("Conversations", "forum", ("owners", "conversation", ""), "team_inbox"),
    ]),
    ("Website", [
        ("Homepage slides", "slideshow", ("owners", "heroslide", ""), None),
    ]),
    ("Money", [
        ("Invoices", "receipt_long", ("owners", "invoice", ""), "draft_invoices"),
        ("Exchange rates", "currency_exchange", ("owners", "exchangerate", ""), None),
    ]),
    ("People & access", [
        ("Admin users", "admin_panel_settings", ("auth", "user", ""), None),
        ("Groups (roles)", "security", ("auth", "group", ""), None),
        ("Owner sign-in codes", "pin", ("owners", "logincode", ""), None),
    ]),
]


# ---------- badges: one COUNT each, never breaking the page ----------------

def _signups():
    from owners.models import OwnerSignup

    return OwnerSignup.objects.filter(status=OwnerSignup.Status.NEW).count()


def _setup():
    from owners.models import Cottage

    return Cottage.objects.filter(status__in=[Cottage.Status.INTAKE, Cottage.Status.LISTING]).count()


def _team_inbox():
    """Guests waiting for the team: enquiries about example cottages that have no owner yet."""
    from django.db.models import OuterRef, Subquery

    from owners.models import Conversation, Message

    last = Message.objects.filter(conversation=OuterRef("pk")).order_by("-created_at").values("sender")[:1]
    return (
        Conversation.objects.filter(cottage__isnull=True, archived=False)
        .annotate(last_sender=Subquery(last))
        .filter(last_sender=Message.Sender.GUEST)
        .count()
    )


def _booking_emails():
    from owners.models import InboundEmail

    return InboundEmail.objects.filter(status__in=[InboundEmail.Status.REVIEW, InboundEmail.Status.CONFLICT]).count()


def _draft_invoices():
    from owners.models import Invoice

    return Invoice.objects.filter(status=Invoice.Status.DRAFT).count()


BADGES = {"signups": _signups, "setup": _setup, "team_inbox": _team_inbox, "booking_emails": _booking_emails,
          "draft_invoices": _draft_invoices}

BADGE_LINKS = {
    "signups": "status__exact=new",
    "setup": "status__in=intake,listing",
    "team_inbox": "cottage__isnull=True&archived__exact=0",
    "booking_emails": "status__in=review,conflict",
    "draft_invoices": "status__exact=draft",
}


def badge_count(key: str) -> int:
    try:
        return BADGES[key]() or 0
    except Exception:
        return 0


def _url(app, model, query):
    try:
        u = reverse(f"admin:{app}_{model}_changelist")
    except NoReverseMatch:
        return None
    return u + (f"?{query}" if query else "")


def navigation(request):
    from django.apps import apps
    from django.contrib import admin

    user = getattr(request, "user", None)
    registered = {(m._meta.app_label, m._meta.model_name) for m in admin.site._registry}
    listed = set()

    def allowed(app, model):
        if user is None or not user.is_active or not user.is_staff:
            return False
        return user.has_perm(f"{app}.view_{model}") or user.has_perm(f"{app}.change_{model}")

    out = [{
        "title": "Overview",
        "separator": False,
        "collapsible": False,
        "items": [{"title": "Dashboard", "icon": "space_dashboard", "link": reverse("admin:index")}],
    }]
    for title, items in GROUPS:
        group = []
        for label, icon, (app, model, query), badge in items:
            listed.add((app, model))
            if (app, model) not in registered or not allowed(app, model):
                continue
            url = _url(app, model, query)
            if not url:
                continue
            item = {"title": label, "icon": icon, "link": url}
            # Only with something to count: unfold prints whatever the callback returns.
            if badge and badge_count(badge):
                item["badge"] = f"config.admin_nav.badge_{badge}"
                item["badge_variant"] = "primary"
            group.append(item)
        if group:
            out.append({"title": title, "separator": True, "collapsible": True, "items": group})

    extra = []
    for app, model in sorted(registered - listed):
        if allowed(app, model) and (url := _url(app, model, "")):
            name = str(apps.get_model(app, model)._meta.verbose_name_plural)
            extra.append({"title": name[:1].upper() + name[1:], "icon": "folder", "link": url})
    if extra:
        out.append({"title": "Other", "separator": True, "collapsible": True, "items": extra})
    return out


def _make_badge(key):
    def badge(request):
        n = badge_count(key)
        return None if not n else ("999+" if n > 999 else str(n))

    badge.__name__ = f"badge_{key}"
    return badge


for _k in BADGES:
    globals()[f"badge_{_k}"] = _make_badge(_k)

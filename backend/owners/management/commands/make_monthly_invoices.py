"""Make last month's commission invoices (run on the 1st of each month), and send them with --send.

In a normal terminal (local):
  backend/.venv/bin/python backend/manage.py make_monthly_invoices            # last month, drafts
  backend/.venv/bin/python backend/manage.py make_monthly_invoices --month 2026-11 --send
"""

from datetime import date

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from owners import stripe_api
from owners.invoicing import build_all, previous_month


class Command(BaseCommand):
    help = "Build one commission invoice per owner for a month; --send sends the drafts through Stripe."

    def add_arguments(self, parser):
        parser.add_argument("--month", help="YYYY-MM (default: last month)")
        parser.add_argument("--send", action="store_true", help="Send drafts through Stripe (needs STRIPE_SECRET_KEY).")

    def handle(self, *args, month=None, send=False, **options):
        if month:
            try:
                year, mon = (int(x) for x in month.split("-"))
                first = date(year, mon, 1)
            except ValueError as e:
                raise CommandError("--month must look like 2026-11") from e
        else:
            first = previous_month(timezone.localdate())
        invoices = build_all(first)
        lines = [f"{i.number}  {i.owner.name}: {i.total} € ({i.get_status_display()})" for i in invoices]
        if send:
            if not stripe_api.enabled():
                raise CommandError("STRIPE_SECRET_KEY is not set; the invoices stay drafts in the admin.")
            for i in invoices:
                try:
                    stripe_api.send(i)
                except stripe_api.StripeError as e:
                    lines.append(f"! {i.number} not sent: {e}")
        summary = "\n".join(lines) or "Nothing to invoice."
        self.stdout.write(summary)
        if invoices and settings.SIGNUP_NOTIFY_EMAILS:
            send_mail(f"Rantio invoices for {first:%m/%Y}", summary + f"\n\n{settings.ADMIN_URL}/owners/invoice/",
                      settings.DEFAULT_FROM_EMAIL, settings.SIGNUP_NOTIFY_EMAILS, fail_silently=True)

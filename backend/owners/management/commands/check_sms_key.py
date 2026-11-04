"""Weekly: use the Brevo SMS key once so it doesn't expire, and say so if Brevo refuses it.

Brevo turns off API keys that go 90 days unused; with few owners signing in by SMS that could
happen quietly. Run by stugora-sms-key.timer. In a normal terminal on the server:
  stugora-manage check_sms_key
"""

from django.conf import settings
from django.core.mail import send_mail
from django.core.management.base import BaseCommand

from owners import sms


class Command(BaseCommand):
    help = "Use the Brevo SMS key once (keeps it active); email the team if Brevo refuses it."

    def handle(self, *args, **options):
        if not sms.enabled():
            self.stdout.write("SMS sign-in is off (no BREVO_API_KEY); nothing to check.")
            return
        ok, why = sms.check_key()
        if ok:
            self.stdout.write("Brevo accepts the SMS key.")
            return
        self.stderr.write(f"The Brevo SMS key didn't work: {why}")
        if settings.SIGNUP_NOTIFY_EMAILS:
            send_mail(
                "Rantio: SMS sign-in codes may have stopped",
                f"The weekly check of the Brevo SMS key failed: {why}.\n\n"
                "If Brevo turned the key off or it was deleted, make a new one (Brevo → SMTP & API → API keys, "
                "Transactional SMS: Read/write) and run on the Mac, in a normal terminal:\n"
                "  bash ~/stugora/deploy/set-sms.sh\n\n"
                "Also check the SMS credits in Brevo → My plan.",
                settings.DEFAULT_FROM_EMAIL, settings.SIGNUP_NOTIFY_EMAILS, fail_silently=True,
            )

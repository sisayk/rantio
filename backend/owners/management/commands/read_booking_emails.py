"""Read new booking emails from the bookings@ mailbox over IMAP (run every few minutes).

In a normal terminal (local):  backend/.venv/bin/python backend/manage.py read_booking_emails
"""

import imaplib

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from owners.booking_emails import ingest


class Command(BaseCommand):
    help = "Read unread booking emails from the forwarding mailbox and block their dates."

    def handle(self, *args, **options):
        host, user, password = (settings.BOOKING_EMAIL_IMAP_HOST, settings.BOOKING_EMAIL_IMAP_USER,
                                settings.BOOKING_EMAIL_IMAP_PASSWORD)
        if not (host and user and password):
            raise CommandError("Set BOOKING_EMAIL_IMAP_HOST, BOOKING_EMAIL_IMAP_USER and BOOKING_EMAIL_IMAP_PASSWORD.")
        counts = {}
        with imaplib.IMAP4_SSL(host) as box:
            box.login(user, password)
            box.select(settings.BOOKING_EMAIL_IMAP_FOLDER)
            _, found = box.search(None, "UNSEEN")
            for num in found[0].split():
                _, data = box.fetch(num, "(BODY.PEEK[])")
                raw = next((part[1] for part in data if isinstance(part, tuple)), None)
                if raw is None:
                    continue
                email = ingest(raw)  # stored even when unclear, so it's safe to mark it read
                box.store(num, "+FLAGS", "\\Seen")
                counts[email.status] = counts.get(email.status, 0) + 1
        self.stdout.write(", ".join(f"{k}: {v}" for k, v in sorted(counts.items())) or "No new emails.")

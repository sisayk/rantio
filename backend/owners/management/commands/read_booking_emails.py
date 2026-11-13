"""Read new booking emails from the bookings@ mailbox over IMAP (run every few minutes).

In a normal terminal (local):  backend/.venv/bin/python backend/manage.py read_booking_emails
"""

import imaplib
import logging

from django.db import InterfaceError, OperationalError

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from owners.booking_emails import ingest


logger = logging.getLogger(__name__)


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
                try:
                    email = ingest(raw)  # stored even when unclear, so it's safe to mark it read
                    status = email.status
                except (OperationalError, InterfaceError):
                    raise  # the database is away: the email stays unread for the next run
                except Exception:
                    # One unreadable email must not be met again every five minutes with every
                    # email after it left unread: it's marked read and reported, to be looked at.
                    logger.exception("Booking email %s couldn't be read; marked as read", num.decode(errors="replace"))
                    status = "failed"
                box.store(num, "+FLAGS", "\\Seen")
                counts[status] = counts.get(status, 0) + 1
        self.stdout.write(", ".join(f"{k}: {v}" for k, v in sorted(counts.items())) or "No new emails.")

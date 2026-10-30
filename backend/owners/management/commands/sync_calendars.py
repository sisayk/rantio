"""Reads every booking site's calendar link, so their bookings close the dates everywhere.

Run it every 15 minutes from cron, in a normal terminal on the server:
    */15 * * * * cd /srv/stugora/backend && .venv/bin/python manage.py sync_calendars
"""

from django.core.management.base import BaseCommand

from owners.calendar import sync_all


class Command(BaseCommand):
    help = "Read the booking sites' calendar links (iCal) into each cottage's calendar."

    def handle(self, *args, **options):
        ok, failed = sync_all()
        self.stdout.write(f"Calendars read: {ok}, failed: {failed}")

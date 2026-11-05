"""Beds24 by hand.

    manage.py beds24 check            # does the connection work?
    manage.py beds24 push 12          # send cottage 12 and its prices
    manage.py beds24 push 12 --dry-run   # show what would be sent, send nothing
    manage.py beds24                  # daily: fresh prices for every cottage already in Beds24
                                      # (this also keeps the refresh token in use)
"""

import json

from django.core.management.base import BaseCommand, CommandError

from owners import beds24
from owners.models import Cottage


class Command(BaseCommand):
    help = "Check the Beds24 connection, or send a cottage and its prices to Beds24."

    def add_arguments(self, parser):
        parser.add_argument("action", nargs="?", default="daily", choices=["check", "push", "daily"])
        parser.add_argument("cottage", nargs="?", type=int)
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, action, cottage=None, dry_run=False, **_):
        try:
            if action == "check":
                self.stdout.write(beds24.check())
                return
            if action == "daily":
                if not beds24.enabled():
                    self.stdout.write("Beds24 isn't connected; nothing to do.")
                    return
                self.stdout.write(beds24.check())
                for c in Cottage.objects.filter(beds24_room_id__isnull=False):
                    try:
                        self.stdout.write(f"{c.name}: {beds24.push_prices(c)} price runs")
                    except beds24.Beds24Error as e:
                        c.beds24_error = str(e)[:500]
                        c.save(update_fields=["beds24_error"])
                        self.stderr.write(f"{c.name}: {e}")
                return
            if not cottage:
                raise CommandError("Which cottage? Give its id, e.g. beds24 push 12")
            c = Cottage.objects.get(pk=cottage)
            if dry_run:
                ranges = beds24.price_ranges(c)
                self.stdout.write(json.dumps({"property": beds24.property_payload(c), "prices": ranges[:6], "price_runs": len(ranges)}, indent=2, ensure_ascii=False))
                return
            self.stdout.write(beds24.sync(c))
        except Cottage.DoesNotExist as e:
            raise CommandError(f"No cottage {cottage}.") from e
        except beds24.Beds24Error as e:
            raise CommandError(str(e)) from e

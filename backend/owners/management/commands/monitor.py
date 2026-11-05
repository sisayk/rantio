"""Mökki monitor by hand.

    manage.py monitor new --count 5     # make boxes: prints serial, claim code (sticker) and secret (firmware)
    manage.py monitor check             # every 15 min: quiet boxes, cold cottages before arrivals
    manage.py monitor                   # the same as check (for the timer)
"""

from django.core.management.base import BaseCommand

from owners import monitor


class Command(BaseCommand):
    help = "Make Mökki monitor boxes, or run the 15-minute check."

    def add_arguments(self, parser):
        parser.add_argument("action", nargs="?", default="check", choices=["new", "check"])
        parser.add_argument("--count", type=int, default=1)

    def handle(self, action, count=1, **_):
        if action == "new":
            self.stdout.write("serial      claim code (sticker)   secret (firmware, keep private)")
            for _ in range(max(1, min(count, 100))):
                d, code, secret = monitor.new_device()
                self.stdout.write(f"{d.serial}   {code}              {secret}")
            self.stdout.write("The claim code and secret are shown only now.")
            return
        self.stdout.write(f"Monitor check: {monitor.check()}")

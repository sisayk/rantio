from django.core.management.base import BaseCommand

from owners import reviews


class Command(BaseCommand):
    help = "Email guests whose stay through a Rantio booking link ended, asking them to rate it."

    def handle(self, *args, **options):
        sent = reviews.ask_for_reviews()
        self.stdout.write(f"Asked {sent} guest(s) for a review.")

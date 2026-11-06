"""The owner vault (owners/vault.py): which key each stored tax number is under, and moving them
onto the newest key. Never prints a decrypted value; only counts, key ids and owner ids.

    stugora-manage vault status             counts per key, and the owners whose value can't be opened
    stugora-manage vault reseal             what reseal would do (changes nothing)
    stugora-manage vault reseal --commit    re-encrypt every readable value with the newest VAULT_KEYS key
"""

from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from owners import vault
from owners.models import Owner


class Command(BaseCommand):
    help = "Status of the encrypted owner details, and re-encrypting them with the newest key."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["status", "reseal"])
        parser.add_argument("--commit", action="store_true", help="reseal: save the changes (without it, a dry run)")

    def handle(self, action, commit=False, **options):
        current = vault.current_id()
        rows = Owner.objects.exclude(tax_id_sealed="").values_list("pk", "tax_id_sealed")
        if action == "status":
            counts, unreadable = Counter(), []
            for pk, token in rows:
                kid = vault.which_key(token)
                counts[kid] += 1
                if kid == "unreadable":
                    unreadable.append(pk)
            self.stdout.write(f"Newest key: {current or 'none (VAULT_KEYS is empty: the legacy SECRET_KEY-derived key encrypts)'}")
            for kid, n in sorted(counts.items()):
                label = "newest key" if kid == current else "legacy (SECRET_KEY)" if kid == "legacy" else "CAN'T BE OPENED" if kid == "unreadable" else "older key"
                self.stdout.write(f"  {kid:<10} {n:>5}  {label}")
            if not counts:
                self.stdout.write("  No tax numbers stored.")
            if unreadable:
                self.stdout.write(self.style.ERROR(
                    f"{len(unreadable)} can't be opened (owner ids {', '.join(map(str, unreadable))}). Usually a key was "
                    "removed from VAULT_KEYS or DJANGO_SECRET_KEY changed: put the old key back. Nothing was changed."
                ))
            return

        if current is None:
            raise CommandError("VAULT_KEYS is empty: add a key first (DEPLOY.md, 'Tax numbers: the encryption key').")
        todo = [(pk, token) for pk, token in rows if vault.needs_reseal(token)]
        skipped = [pk for pk, token in rows if vault.which_key(token) == "unreadable"]
        self.stdout.write(f"{len(todo)} to move onto key {current}; {len(skipped)} can't be opened and stay as they are.")
        if skipped:
            self.stdout.write(self.style.WARNING(f"Can't be opened: owner ids {', '.join(map(str, skipped))}"))
        if not commit:
            self.stdout.write("Dry run: nothing saved. Add --commit to re-encrypt.")
            return
        with transaction.atomic():
            for pk, token in todo:
                fresh = vault.reseal(token)
                # Only if nobody changed the value meanwhile.
                Owner.objects.filter(pk=pk, tax_id_sealed=token).update(tax_id_sealed=fresh)
        self.stdout.write(self.style.SUCCESS(f"Re-encrypted {len(todo)} with key {current}."))

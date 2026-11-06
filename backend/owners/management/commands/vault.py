"""The owner vault (owners/vault.py): which key each stored value (tax number, bank account, date
of birth, beneficial owners) is under, and moving them
onto the newest key. Never prints a decrypted value; only counts, key ids and owner ids.

    stugora-manage vault status             counts per key, and the owners whose value can't be opened
    stugora-manage vault reseal             what reseal would do (changes nothing)
    stugora-manage vault reseal --commit    re-encrypt every readable value with the newest VAULT_KEYS key
"""

from collections import Counter

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import TextField
from django.db.models.functions import Cast

from owners import vault
from owners.models import Owner


class Command(BaseCommand):
    help = "Status of the encrypted owner details, and re-encrypting them with the newest key."

    def add_arguments(self, parser):
        parser.add_argument("action", choices=["status", "reseal"])
        parser.add_argument("--commit", action="store_true", help="reseal: save the changes (without it, a dry run)")

    def handle(self, action, commit=False, **options):
        current = vault.current_id()
        columns = vault.sealed_columns(Owner)
        # The stored (encrypted) text of every column, without the fields opening it.
        rows = {
            name: list(Owner.objects.annotate(raw=Cast(name, TextField())).exclude(raw="").exclude(raw__isnull=True)
                       .values_list("pk", "raw"))
            for name in columns
        }
        if action == "status":
            self.stdout.write(f"Newest key: {current or 'none (VAULT_KEYS is empty: the legacy SECRET_KEY-derived key encrypts)'}")
            unreadable = []
            for name in columns:
                counts = Counter()
                for pk, token in rows[name]:
                    kid = vault.which_key(token)
                    counts[kid] += 1
                    if kid == "unreadable":
                        unreadable.append((name, pk))
                self.stdout.write(f"{name}:")
                for kid, n in sorted(counts.items()):
                    label = "newest key" if kid == current else "legacy (SECRET_KEY)" if kid == "legacy" else "CAN'T BE OPENED" if kid == "unreadable" else "older key"
                    self.stdout.write(f"  {kid:<10} {n:>5}  {label}")
                if not counts:
                    self.stdout.write("  Nothing stored.")
            if unreadable:
                owners = sorted({pk for _name, pk in unreadable})
                self.stdout.write(self.style.ERROR(
                    f"{len(unreadable)} can't be opened (owner ids {', '.join(map(str, owners))}). Usually a key was "
                    "removed from VAULT_KEYS or DJANGO_SECRET_KEY changed: put the old key back. Nothing was changed."
                ))
            return

        if current is None:
            raise CommandError("VAULT_KEYS is empty: add a key first (DEPLOY.md, 'Tax numbers: the encryption key').")
        todo = [(name, pk, token) for name in columns for pk, token in rows[name] if vault.needs_reseal(token)]
        skipped = sorted({pk for name in columns for pk, token in rows[name] if vault.which_key(token) == "unreadable"})
        self.stdout.write(f"{len(todo)} to move onto key {current}; values of {len(skipped)} owners can't be opened and stay as they are.")
        if skipped:
            self.stdout.write(self.style.WARNING(f"Can't be opened: owner ids {', '.join(map(str, skipped))}"))
        if not commit:
            self.stdout.write("Dry run: nothing saved. Add --commit to re-encrypt.")
            return
        sealed = {f.attname for f in Owner._meta.concrete_fields if isinstance(f, vault.SealedField)}
        # An encrypted field is given its stored text as Locked, so it is written as it is.
        as_stored = lambda name, text: vault.Locked(text) if name in sealed else text  # noqa: E731
        with transaction.atomic():
            for name, pk, token in todo:
                fresh = vault.reseal(token)
                # Only if nobody changed the value meanwhile.
                Owner.objects.filter(pk=pk, **{name: as_stored(name, token)}).update(**{name: as_stored(name, fresh)})
        self.stdout.write(self.style.SUCCESS(f"Re-encrypted {len(todo)} with key {current}."))

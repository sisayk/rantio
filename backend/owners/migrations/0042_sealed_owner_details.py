"""Owner.payout_iban, .date_of_birth and .beneficial_owners stored encrypted (owners/vault.py).

The columns become plain text first, then every stored value is sealed with the vault's current
key, then the fields become the vault's own (no database change in that last step). Backwards
opens them again."""

from django.db import migrations, models

import owners.vault

FIELDS = ("payout_iban", "date_of_birth", "beneficial_owners")


def _is_sealed(raw: str) -> bool:
    try:
        owners.vault.unseal(raw)
    except owners.vault.Unreadable:
        return False
    return True


def seal_all(apps, schema_editor):
    Owner = apps.get_model("owners", "Owner")
    for row in Owner.objects.values("pk", *FIELDS):
        update = {}
        for name in FIELDS:
            raw = row[name]
            if raw is None or raw == "" or raw.strip() in ("[]", "null"):
                update[name] = None if name == "date_of_birth" else ""
            elif not _is_sealed(raw):
                update[name] = owners.vault.seal(raw)
        if update:
            Owner.objects.filter(pk=row["pk"]).update(**update)


def open_all(apps, schema_editor):
    Owner = apps.get_model("owners", "Owner")
    for row in Owner.objects.values("pk", *FIELDS):
        update = {}
        for name in FIELDS:
            raw = row[name]
            if raw:
                update[name] = owners.vault.unseal(raw)  # Unreadable stops the migration: nothing lost
            elif name == "beneficial_owners":
                update[name] = "[]"
        if update:
            Owner.objects.filter(pk=row["pk"]).update(**update)


class Migration(migrations.Migration):
    dependencies = [("owners", "0041_heroslide_kind_help")]

    operations = [
        migrations.AlterField("owner", "payout_iban", models.TextField(blank=True)),
        migrations.AlterField("owner", "date_of_birth", models.TextField(null=True, blank=True)),
        migrations.AlterField("owner", "beneficial_owners", models.TextField(blank=True, default="")),
        migrations.RunPython(seal_all, open_all),
        migrations.AlterField(
            "owner", "payout_iban",
            owners.vault.SealedCharField(blank=True, max_length=34, help_text="Bank account (IBAN) the owner is paid to (stored encrypted)."),
        ),
        migrations.AlterField(
            "owner", "date_of_birth", owners.vault.SealedDateField(blank=True, null=True, help_text="Stored encrypted."),
        ),
        migrations.AlterField(
            "owner", "beneficial_owners",
            owners.vault.SealedJSONField(
                blank=True, default=list,
                help_text='People owning 25 % or more: [{"name", "date_of_birth", "country", "share"}]. Stored encrypted.',
            ),
        ),
    ]

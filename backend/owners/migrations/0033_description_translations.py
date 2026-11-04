from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("owners", "0032_accounts_for_everyone"),
    ]

    operations = [
        migrations.AddField(
            model_name="cottage",
            name="descriptions_auto",
            field=models.JSONField(
                blank=True, default=dict,
                help_text='Languages Claude translated, each mapped to the language it was translated from, {"sv": "en"}. '
                "Languages the owner wrote are never here and are never overwritten.",
            ),
        ),
        migrations.AddField(
            model_name="cottage",
            name="translating",
            field=models.JSONField(
                blank=True, default=dict,
                help_text='While translations are being written: {"job": "…", "from": "en", "langs": ["sv", …], "started": "…"}. '
                'Afterwards {"failed": ["…"]} if some languages couldn\'t be done, else empty.',
            ),
        ),
    ]

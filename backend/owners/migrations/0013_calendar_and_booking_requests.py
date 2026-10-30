# Master calendar (owner blocks and booking sites' iCal calendars), calendar and
# booking-request links per cottage, and booking requests on conversations.

import secrets

import django.db.models.deletion
from django.db import migrations, models

import owners.models

CHANNELS = [
    ("airbnb", "Airbnb"), ("booking", "Booking.com"), ("vrbo", "Vrbo"), ("expedia", "Expedia"),
    ("google", "Google Vacation Rentals"), ("holidu", "Holidu"), ("hometogo", "HomeToGo"),
    ("direct", "Stugora direct"), ("nettimokki", "Nettimökki"), ("owner", "Owner's own booking"),
]


def fill_tokens(apps, schema_editor):
    Cottage = apps.get_model("owners", "Cottage")
    for c in Cottage.objects.all():
        c.calendar_token = secrets.token_urlsafe(18)
        c.booking_link_token = secrets.token_urlsafe(18)
        c.save(update_fields=["calendar_token", "booking_link_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("owners", "0012_booking_emails_invoices"),
    ]

    operations = [
        migrations.AddField(
            model_name="cottage", name="calendar_token",
            field=models.CharField(max_length=32, null=True, editable=False),
        ),
        migrations.AddField(
            model_name="cottage", name="booking_link_token",
            field=models.CharField(max_length=32, null=True, editable=False),
        ),
        migrations.RunPython(fill_tokens, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="cottage", name="calendar_token",
            field=models.CharField(
                max_length=32, unique=True, default=owners.models.new_link_token, editable=False,
                help_text="Key in the cottage's calendar link (iCal) that the booking sites read.",
            ),
        ),
        migrations.AlterField(
            model_name="cottage", name="booking_link_token",
            field=models.CharField(
                max_length=32, unique=True, default=owners.models.new_link_token, editable=False,
                help_text="Key in the booking-request link the owner shares with their own guests.",
            ),
        ),
        migrations.AddField(
            model_name="cottage", name="booking_requests_open",
            field=models.BooleanField(
                default=True, help_text="Whether guests with the booking link can send a booking request."
            ),
        ),
        migrations.AddField(
            model_name="conversation", name="request_status",
            field=models.CharField(
                max_length=10, blank=True, default="",
                choices=[("pending", "Waiting for the owner"), ("accepted", "Accepted"), ("declined", "Declined")],
                help_text="Set when the guest asked to book through the owner's booking link.",
            ),
        ),
        migrations.AddField(
            model_name="conversation", name="guest_phone", field=models.CharField(max_length=40, blank=True),
        ),
        migrations.AddField(
            model_name="conversation", name="children", field=models.PositiveSmallIntegerField(default=0),
        ),
        migrations.CreateModel(
            name="CalendarFeed",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("channel", models.CharField(max_length=12, choices=CHANNELS)),
                ("url", models.URLField(max_length=1000)),
                ("last_synced_at", models.DateTimeField(null=True, blank=True)),
                ("last_error", models.CharField(max_length=300, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("cottage", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="feeds", to="owners.cottage")),
            ],
            options={
                "ordering": ["cottage", "channel"],
                "constraints": [models.UniqueConstraint(fields=("cottage", "channel"), name="feed_one_per_channel")],
            },
        ),
        migrations.CreateModel(
            name="CalendarBlock",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uid", models.CharField(max_length=255, blank=True, help_text="The event's id in the site's calendar.")),
                ("start", models.DateField()),
                ("end", models.DateField()),
                ("note", models.CharField(max_length=200, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("cottage", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="blocks", to="owners.cottage")),
                ("feed", models.ForeignKey(null=True, blank=True, on_delete=django.db.models.deletion.CASCADE, related_name="blocks", to="owners.calendarfeed")),
            ],
            options={
                "ordering": ["start"],
                "constraints": [
                    models.CheckConstraint(condition=models.Q(end__gt=models.F("start")), name="block_end_after_start"),
                    models.UniqueConstraint(fields=("feed", "uid"), condition=models.Q(feed__isnull=False), name="block_unique_uid_per_feed"),
                ],
            },
        ),
    ]

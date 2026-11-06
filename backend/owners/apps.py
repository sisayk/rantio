from django.apps import AppConfig


class OwnersConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "owners"

    def ready(self):
        from . import alerts  # noqa: F401  (connects the booking-alert signal)
        from . import checks  # noqa: F401  (registers the vault's system checks)

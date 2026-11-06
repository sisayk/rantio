"""System checks for the owner vault (owners/vault.py): run by `manage.py check`, and deploy.sh
runs `check --deploy`, which stops a deploy on an error before the new code goes live."""

from django.conf import settings
from django.core.checks import Error, Tags, Warning, register
from django.core.exceptions import ImproperlyConfigured

from . import vault


@register()
def vault_keys_valid(app_configs, **kwargs):
    try:
        vault.vault_keys()
    except ImproperlyConfigured as err:
        return [Error(str(err), hint="Each entry must be a key made with Fernet.generate_key(); see DEPLOY.md.", id="owners.E010")]
    return []


@register(Tags.security, deploy=True)
def vault_key_separate(app_configs, **kwargs):
    if getattr(settings, "VAULT_KEYS", None):
        return []
    return [Warning(
        "Owners' tax numbers, bank accounts and dates of birth are encrypted with a key derived from DJANGO_SECRET_KEY, so changing "
        "DJANGO_SECRET_KEY without listing the old one in DJANGO_SECRET_KEY_FALLBACKS makes them unreadable.",
        hint="Set VAULT_KEYS and run `stugora-manage vault reseal --commit` (DEPLOY.md, 'Tax numbers: the encryption key').",
        id="owners.W010",
    )]

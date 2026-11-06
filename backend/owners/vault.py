"""Encryption for the owner details that identify a person (the tax number: in Finland the
henkilötunnus), so a copy of the database or a backup alone doesn't reveal them.

Keys
  VAULT_KEYS (in /srv/stugora/.env): Fernet keys, comma-separated, newest first. The first one
  encrypts; all of them decrypt. Its own key, so rotating DJANGO_SECRET_KEY never touches it.
  Without VAULT_KEYS, values are encrypted with a key derived from SECRET_KEY, as before. That is
  the "legacy" key: still read (also from DJANGO_SECRET_KEY_FALLBACKS), so nothing stored before
  VAULT_KEYS existed is lost when it is added.

Stored form
  "v2:<key id>:<Fernet token>"  encrypted with a VAULT_KEYS key; the id says which one.
  "<Fernet token>"              legacy, encrypted with the SECRET_KEY-derived key.

Reading never fails quietly: a value no configured key opens raises Unreadable (key missing or
changed, or the value damaged), so the account page and the admin can say so instead of treating
the number as never given. `manage.py vault status` counts values per key, `vault reseal --commit`
moves them all onto the newest key (DEPLOY.md, "Tax numbers: the encryption key").
Never log or print a decrypted value; the key id and the owner's id are enough to find a problem.
"""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured

PREFIX = "v2"


class Unreadable(Exception):
    """A stored value that none of the configured keys opens. The message never contains the value."""


def key_id(key: str | bytes) -> str:
    raw = key.encode() if isinstance(key, str) else key
    return hashlib.sha256(b"rantio-vault-id:" + raw).hexdigest()[:8]


def _legacy_key(secret: str) -> bytes:
    return base64.urlsafe_b64encode(hashlib.sha256(f"rantio-owner-vault:{secret}".encode()).digest())


def vault_keys() -> list[tuple[str, Fernet]]:
    """(id, key) for every VAULT_KEYS entry, newest first. A malformed entry is a configuration error."""
    out = []
    for n, key in enumerate(getattr(settings, "VAULT_KEYS", []) or [], start=1):
        try:
            out.append((key_id(key), Fernet(key)))
        except (ValueError, TypeError) as err:
            raise ImproperlyConfigured(f"VAULT_KEYS entry {n} is not a Fernet key") from err
    return out


def legacy_keys() -> list[Fernet]:
    """The SECRET_KEY-derived keys: the current SECRET_KEY first, then DJANGO_SECRET_KEY_FALLBACKS."""
    secrets = [settings.SECRET_KEY, *(getattr(settings, "SECRET_KEY_FALLBACKS", []) or [])]
    return [Fernet(_legacy_key(s)) for s in secrets if s]


def current_id() -> str | None:
    """The id of the key new values are encrypted with; None while only the legacy key exists."""
    keys = vault_keys()
    return keys[0][0] if keys else None


def seal(value: str) -> str:
    if not value:
        return ""
    keys = vault_keys()
    if keys:
        kid, f = keys[0]
        return f"{PREFIX}:{kid}:{f.encrypt(value.encode()).decode()}"
    return legacy_keys()[0].encrypt(value.encode()).decode()


def unseal(token: str) -> str:
    """The stored value in clear; "" for nothing stored. Raises Unreadable rather than returning ""."""
    if not token:
        return ""
    if token.startswith(PREFIX + ":"):
        parts = token.split(":", 2)
        if len(parts) != 3 or not parts[1] or not parts[2]:
            raise Unreadable("malformed value")
        kid, body = parts[1], parts[2]
        f = dict(vault_keys()).get(kid)
        if f is None:
            raise Unreadable(f"encrypted with key {kid}, which is not in VAULT_KEYS")
        try:
            return f.decrypt(body.encode()).decode()
        except InvalidToken as err:
            raise Unreadable(f"damaged value (key {kid} is configured but doesn't open it)") from err
    for f in legacy_keys():
        try:
            return f.decrypt(token.encode()).decode()
        except InvalidToken:
            continue
    raise Unreadable("legacy value that neither SECRET_KEY nor DJANGO_SECRET_KEY_FALLBACKS opens, or a damaged value")


def which_key(token: str) -> str:
    """For `vault status`: "empty", "legacy", "unreadable" or the key id. Opens the value, never returns it."""
    if not token:
        return "empty"
    try:
        unseal(token)
    except Unreadable:
        return "unreadable"
    return token.split(":", 2)[1] if token.startswith(PREFIX + ":") else "legacy"


def needs_reseal(token: str) -> bool:
    """Readable, but not under the newest key (only once VAULT_KEYS is set)."""
    kid = current_id()
    return bool(token) and kid is not None and which_key(token) not in ("empty", "unreadable", kid)


def reseal(token: str) -> str:
    """The same value encrypted with the newest key. Raises Unreadable if it can't be opened."""
    return seal(unseal(token))

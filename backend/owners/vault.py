"""Encryption for the few owner details that identify a person (tax number), so a copy of the
database alone doesn't reveal them. The key comes from SECRET_KEY: changing SECRET_KEY makes the
stored values unreadable (owners would type them again)."""

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings


def _fernet() -> Fernet:
    key = hashlib.sha256(f"rantio-owner-vault:{settings.SECRET_KEY}".encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def seal(value: str) -> str:
    return _fernet().encrypt(value.encode()).decode() if value else ""


def unseal(token: str) -> str:
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode()).decode()
    except InvalidToken:
        return ""

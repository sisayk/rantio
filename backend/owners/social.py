"""Signing owners in with Google or Apple.

The website and the app get an ID token from Google or Apple (a JWT the provider signed)
and send it here. We check its signature against the provider's published keys, that it
was made for one of our apps (the audience) and that it hasn't expired, then find the
owner: by the account's id if they've signed in this way before, otherwise by its
verified email address. No passwords or provider secrets are involved.

Only owners Rantio already has can sign in; an unknown account gets "no_owner".
"""

import logging

import jwt
from django.conf import settings

from .models import Owner

logger = logging.getLogger(__name__)

PROVIDERS = {
    "google": {
        "keys": "https://www.googleapis.com/oauth2/v3/certs",
        "issuers": ["https://accounts.google.com", "accounts.google.com"],
        "audiences": lambda: settings.GOOGLE_CLIENT_IDS,
        "field": "google_sub",
    },
    "apple": {
        "keys": "https://appleid.apple.com/auth/keys",
        "issuers": ["https://appleid.apple.com"],
        "audiences": lambda: settings.APPLE_AUDIENCES,
        "field": "apple_sub",
    },
}
_clients: dict[str, jwt.PyJWKClient] = {}


class SignInError(Exception):
    """Why the token didn't sign anyone in: 'invalid_token', 'no_email' or 'no_owner'."""


def enabled(provider: str) -> bool:
    return bool(PROVIDERS[provider]["audiences"]())


def _claims(provider: str, token: str) -> dict:
    p = PROVIDERS[provider]
    client = _clients.setdefault(provider, jwt.PyJWKClient(p["keys"], cache_keys=True, lifespan=6 * 3600))
    try:
        key = client.get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token, key, algorithms=["RS256"], audience=p["audiences"](), options={"require": ["exp", "iat", "sub"]},
            leeway=60,
        )
    except jwt.PyJWTError as error:
        logger.info("Rejected a %s sign-in token: %s", provider, error)
        raise SignInError("invalid_token") from error
    if claims.get("iss") not in p["issuers"]:
        raise SignInError("invalid_token")
    return claims


def owner_for(provider: str, token: str, lang: str = "en") -> Owner:
    claims = _claims(provider, token)
    field = PROVIDERS[provider]["field"]
    owner = Owner.objects.filter(**{field: claims["sub"]}).first()
    if owner:
        return owner
    email = (claims.get("email") or "").strip()
    # Google sends a boolean, Apple a boolean or the string "true".
    if not email or str(claims.get("email_verified", "")).lower() != "true":
        raise SignInError("no_email")
    owner = Owner.objects.filter(email__iexact=email).first()
    if not owner:  # someone new: Google or Apple has checked the address, so it's their account
        from .login import new_account

        owner = new_account(email, name=str(claims.get("name") or ""), lang=lang)
    setattr(owner, field, claims["sub"])  # next time the account id finds them, even if the email changes
    owner.save(update_fields=[field])
    return owner

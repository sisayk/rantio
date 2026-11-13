"""Small counters in the cache for things that must not be done too often: sending email to an
address nobody has proven, calls to a paid API, fetching a web address an owner typed.

The per-IP throttles (settings.REST_FRAMEWORK) stop one visitor; these stop one account, one
conversation or everyone together, whatever addresses the requests come from.
"""

from django.core.cache import cache


def allow(key: str, limit: int, seconds: int) -> bool:
    """True for the first `limit` calls with this key in a window of `seconds` (from the first call)."""
    key = f"limit:{key}"
    cache.add(key, 0, seconds)
    try:
        return cache.incr(key) <= limit
    except ValueError:  # expired between the two lines
        cache.set(key, 1, seconds)
        return True

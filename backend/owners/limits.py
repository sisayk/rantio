"""Small counters in the cache for things that must not be done too often: sending email to an
address nobody has proven, calls to a paid API, fetching a web address an owner typed.

The per-IP throttles (settings.REST_FRAMEWORK) stop one visitor; these stop one account, one
conversation or everyone together, whatever addresses the requests come from.

The count is stored with the moment its window ends and written back with the time that is left:
cache.incr() can't be used, because Django's database cache (production) gives an incremented key
the default five-minute life, so windows would slide and never end.
"""

import time

from django.core.cache import cache


def _now() -> float:
    return time.time()


def count(key: str, seconds: int) -> int:
    """Counts this call; returns how many there have been in the current window of `seconds`
    (which starts at the first call and ends on time, however many calls follow)."""
    key, now = f"limit:{key}", _now()
    n, end = cache.get(key) or (0, now + seconds)
    if end <= now:
        n, end = 0, now + seconds
    cache.set(key, (n + 1, end), max(1, int(end - now) + 1))
    return n + 1


def used(key: str) -> int:
    """How many calls the current window has had, without counting one."""
    n, end = cache.get(f"limit:{key}") or (0, 0)
    return n if end > _now() else 0


def allow(key: str, limit: int, seconds: int) -> bool:
    """True for the first `limit` calls in a window of `seconds`. Refused calls aren't counted."""
    if used(key) >= limit:
        return False
    return count(key, seconds) <= limit


def forget(key: str) -> None:
    cache.delete(f"limit:{key}")

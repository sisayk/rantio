"""Serves the admin stylesheet (config/admin_assets/stugora-admin.css) from Django,
so it ships with the code and needs no collectstatic. Same approach as Bona."""

import hashlib
from functools import lru_cache
from pathlib import Path

from django.http import HttpResponse, HttpResponseNotModified

CSS_PATH = Path(__file__).resolve().parent / "admin_assets" / "stugora-admin.css"


@lru_cache(maxsize=1)
def _load(mtime):
    body = CSS_PATH.read_bytes()
    return body, hashlib.sha1(body).hexdigest()[:12]


def css_and_version():
    return _load(CSS_PATH.stat().st_mtime_ns)


def admin_css_url(request=None):
    """UNFOLD["STYLES"] entry. The URL carries a content hash, so a changed file gets a new URL."""
    _, v = css_and_version()
    return f"/admin/_assets/stugora-admin.css?v={v}"


def admin_css(request):
    body, v = css_and_version()
    etag = f'"{v}"'
    if request.headers.get("If-None-Match") == etag:
        return HttpResponseNotModified()
    resp = HttpResponse(body, content_type="text/css; charset=utf-8")
    resp["ETag"] = etag
    resp["Cache-Control"] = "public, max-age=31536000, immutable" if request.GET.get("v") == v else "no-cache"
    resp["X-Content-Type-Options"] = "nosniff"
    return resp

"""Serves the admin's own files (config/admin_assets/: stylesheet, Rantio mark, favicons)
from Django, so they ship with the code and need no collectstatic. Same approach as Bona."""

import hashlib
from functools import lru_cache
from pathlib import Path

from django.http import Http404, HttpResponse, HttpResponseNotModified

ASSETS = Path(__file__).resolve().parent / "admin_assets"
TYPES = {
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
}


@lru_cache(maxsize=32)
def _load(name: str, mtime: int):
    body = (ASSETS / name).read_bytes()
    return body, hashlib.sha1(body).hexdigest()[:12]


def _file(name: str):
    path = ASSETS / name
    if "/" in name or name.startswith(".") or path.suffix not in TYPES or not path.is_file():
        raise Http404
    return _load(name, path.stat().st_mtime_ns)


def asset_url(name: str) -> str:
    """The URL carries a content hash, so a changed file gets a new URL."""
    _, v = _file(name)
    return f"/admin/_assets/{name}?v={v}"


def admin_css_url(request=None):
    """UNFOLD["STYLES"] entry."""
    return asset_url("rantio-admin.css")


def admin_asset(request, name: str):
    body, v = _file(name)
    etag = f'"{v}"'
    if request.headers.get("If-None-Match") == etag:
        return HttpResponseNotModified()
    resp = HttpResponse(body, content_type=TYPES[Path(name).suffix])
    resp["ETag"] = etag
    resp["Cache-Control"] = "public, max-age=31536000, immutable" if request.GET.get("v") == v else "no-cache"
    resp["X-Content-Type-Options"] = "nosniff"
    return resp

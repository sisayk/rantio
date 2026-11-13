"""The listing description in every language: the owner writes it in one (or a few) and Claude
translates it into the rest.

Languages the owner wrote are theirs and are never overwritten. Translated ones are listed in
Cottage.descriptions_auto with the language they came from; once the owner edits one, it becomes theirs.
Translating runs after the save, in a thread of the web process, one Claude call per language, and
each language is saved as soon as it is done, so the editor can show them arriving. If the process
stops half way (a deploy), the job goes stale after STALE and the owner can start it again.
"""

import logging
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta

from django.conf import settings
from django.db import close_old_connections, transaction
from django.utils import timezone

from . import assistant, limits
from .models import Cottage, Language

logger = logging.getLogger(__name__)

LANGS = list(Language.values)
STALE = timedelta(minutes=5)
AT_ONCE = 4  # Claude calls in parallel for one cottage


def enabled() -> bool:
    return bool(settings.ANTHROPIC_API_KEY)


def owner_languages(texts: dict, auto: dict) -> list[str]:
    return [lang for lang in LANGS if texts.get(lang) and lang not in auto]


def preferred(langs) -> str | None:
    """English first (most guests read it, and it translates best), then the site's order."""
    langs = set(langs)
    return next((lang for lang in LANGS if lang in langs), None)


def plan(c: Cottage, source: str) -> str | None:
    """Mark every language the owner hasn't written as waiting for a translation from `source`.
    Sets c.translating and returns the job id, or None when there is nothing to do; the caller saves
    and then calls start() once the save has committed."""
    texts, auto = c.descriptions or {}, c.descriptions_auto or {}
    own = owner_languages(texts, auto)
    if not enabled() or source not in own:
        return None
    langs = [lang for lang in LANGS if lang not in own]
    if not langs:
        c.translating = {}
        return None
    # Each job is up to ten calls to a paid API: a ceiling per cottage per day (a normal day of
    # editing is a handful), so a script saving two texts in turn can't run up a bill.
    if c.pk and not limits.allow(f"translate:{c.pk}", 30, 24 * 3600):
        logger.warning("Translation limit reached for cottage %s", c.pk)
        return None
    job = uuid.uuid4().hex
    c.translating = {"job": job, "from": source, "langs": langs, "started": timezone.now().isoformat()}
    return job


def state(c: Cottage) -> dict:
    """What the editor shows: languages still on their way, and ones that couldn't be done."""
    t = c.translating or {}
    if t.get("job"):
        try:
            started = datetime.fromisoformat(t["started"])
        except (KeyError, ValueError):
            started = None
        if started and timezone.now() - started < STALE:
            return {"pending": list(t.get("langs", [])), "failed": list(t.get("failed", [])), "from": t.get("from")}
        return {"pending": [], "failed": list(t.get("langs", [])) + list(t.get("failed", [])), "from": t.get("from")}
    return {"pending": [], "failed": list(t.get("failed", [])), "from": t.get("from")}


def start(pk: int, job: str) -> None:
    if settings.TRANSLATE_IN_BACKGROUND:
        threading.Thread(target=_run_in_thread, args=(pk, job), name=f"translate-{pk}", daemon=True).start()
    else:
        run(pk, job)


def _run_in_thread(pk: int, job: str) -> None:
    try:
        run(pk, job)
    finally:
        close_old_connections()


def run(pk: int, job: str) -> None:
    c = Cottage.objects.filter(pk=pk).first()
    t = (c.translating or {}) if c else {}
    if t.get("job") != job:
        return
    source, langs = t["from"], list(t["langs"])
    text = (c.descriptions or {}).get(source, "")
    if not text:
        return _finish(pk, job, langs)
    with ThreadPoolExecutor(max_workers=AT_ONCE) as pool:
        work = {pool.submit(assistant.translate_description, text, source, lang): lang for lang in langs}
        for done in as_completed(work):
            lang = work[done]
            try:
                result = done.result()
            except (assistant.NotConfigured, assistant.DraftFailed):
                result = None
            if not _save(pk, job, source, text, lang, result):
                for rest in work:
                    rest.cancel()  # a newer edit started another job; this one stops
                return


def _save(pk: int, job: str, source: str, text: str, lang: str, result: str | None) -> bool:
    with transaction.atomic():
        c = Cottage.objects.select_for_update().filter(pk=pk).first()
        t = dict(c.translating or {}) if c else {}
        if t.get("job") != job:
            return False
        texts, auto = dict(c.descriptions or {}), dict(c.descriptions_auto or {})
        # The owner may have written this language, or changed the original, since the job started.
        if result and texts.get(source) == text and lang not in owner_languages(texts, auto):
            texts[lang], auto[lang] = result.strip(), source
            c.descriptions, c.descriptions_auto = texts, auto
            c.description_en, c.description_fi = texts.get("en", ""), texts.get("fi", "")
        elif not result:
            t["failed"] = [*t.get("failed", []), lang]
        t["langs"] = [x for x in t.get("langs", []) if x != lang]
        c.translating = t if t["langs"] else ({"failed": t["failed"], "from": source} if t.get("failed") else {})
        c.save(update_fields=["descriptions", "descriptions_auto", "description_en", "description_fi", "translating"])
    return True


def _finish(pk: int, job: str, failed: list[str]) -> None:
    with transaction.atomic():
        c = Cottage.objects.select_for_update().filter(pk=pk).first()
        if c and (c.translating or {}).get("job") == job:
            c.translating = {"failed": failed} if failed else {}
            c.save(update_fields=["translating"])

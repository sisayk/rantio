"""Puts the aurora cabin video on the live homepage as the first slide.

Slides uploaded in the admin live in the database and MEDIA_ROOT of the machine they
were uploaded on, so the ones made on the Mac never reached rantio.fi. This copies the
video and its still (owners/hero_seed/) into MEDIA_ROOT and adds the slide, once.
"""

from pathlib import Path

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.db import migrations

SEED = Path(__file__).resolve().parent.parent / "hero_seed"
TITLE = "Aurora cabin, realistic 3D"


def _store(name: str) -> str:
    path = f"hero/{name}"
    if not default_storage.exists(path):
        path = default_storage.save(path, ContentFile((SEED / name).read_bytes()))
    return path


def add(apps, schema_editor):
    HeroSlide = apps.get_model("owners", "HeroSlide")
    if HeroSlide.objects.filter(title=TITLE).exists():  # already there (the Mac has it)
        return
    for s in HeroSlide.objects.all():
        s.order += 1
        s.save(update_fields=["order"])
    HeroSlide.objects.create(
        title=TITLE, kind="video",
        video=_store("rantio-aurora-cabin.mp4"), image=_store("rantio-aurora-cabin.jpg"),
        video_seconds="6.00", seconds=7, focus="right center", order=0, active=True,
        alt="Red log cabin among snowy spruces under moving northern lights, a family of four grilling outside",
    )


def remove(apps, schema_editor):
    apps.get_model("owners", "HeroSlide").objects.filter(title=TITLE, video="hero/rantio-aurora-cabin.mp4").delete()


class Migration(migrations.Migration):
    dependencies = [("owners", "0027_agoda")]
    operations = [migrations.RunPython(add, remove)]

"""The homepage's original lake photo as the first slide, so adding slides keeps it."""

from django.db import migrations

ORIGINAL = ("https://images.unsplash.com/photo-1698701680003-5272b37f57c0"
            "?w=2400&h=1100&fit=crop&crop=entropy&auto=format&q=75")


def add(apps, schema_editor):
    HeroSlide = apps.get_model("owners", "HeroSlide")
    if HeroSlide.objects.filter(image_url=ORIGINAL).exists():
        return
    for s in HeroSlide.objects.all():
        s.order += 1
        s.save(update_fields=["order"])
    HeroSlide.objects.create(
        title="Original lake photo", kind="image", image_url=ORIGINAL, order=0, active=True, seconds=7,
        alt="Red cottages by a calm lake among autumn trees", focus="center",
    )


def remove(apps, schema_editor):
    apps.get_model("owners", "HeroSlide").objects.filter(image_url=ORIGINAL).delete()


class Migration(migrations.Migration):
    dependencies = [("owners", "0010_slide_image_url")]
    operations = [migrations.RunPython(add, remove)]

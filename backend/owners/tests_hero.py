import shutil
import struct
import tempfile

from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from . import media_checks
from .models import HeroSlide

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64


def mp4(seconds: float, version=0) -> bytes:
    """The smallest file the checker reads: ftyp, then moov with an mvhd box."""
    ftyp = struct.pack(">I4s4sI", 16, b"ftyp", b"isom", 512)
    if version == 0:
        body = bytes([0, 0, 0, 0]) + struct.pack(">IIII", 0, 0, 1000, int(seconds * 1000)) + b"\x00" * 80
    else:
        body = bytes([1, 0, 0, 0]) + struct.pack(">QQIQ", 0, 0, 600, int(seconds * 600)) + b"\x00" * 80
    mvhd = struct.pack(">I4s", 8 + len(body), b"mvhd") + body
    moov = struct.pack(">I4s", 8 + len(mvhd), b"moov") + mvhd
    mdat = struct.pack(">I4s", 16, b"mdat") + b"\x00" * 8
    return ftyp + mdat + moov  # moov at the end, as many phones write it


class MediaCheckTests(TestCase):
    def test_reads_video_length(self):
        self.assertAlmostEqual(media_checks.mp4_seconds(mp4(14.5)), 14.5)
        self.assertAlmostEqual(media_checks.mp4_seconds(mp4(9, version=1)), 9)
        self.assertIsNone(media_checks.mp4_seconds(b"not a video at all"))

    def test_recognises_images_by_content(self):
        self.assertEqual(media_checks.image_type(PNG), "png")
        self.assertEqual(media_checks.image_type(b"\xff\xd8\xff\xe0rest"), "jpeg")
        self.assertIsNone(media_checks.image_type(b"<svg></svg>"))


class HeroAdminTests(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        # Start from the original lake photo alone (migration 0028 adds the aurora video).
        HeroSlide.objects.exclude(image_url__startswith="https://images.unsplash.com/").delete()
        HeroSlide.objects.update(order=0)
        self.client.force_login(User.objects.create_superuser("admin", "", "pw-for-tests-only"))

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)

    def post(self, **data):
        base = {"title": "Lake", "kind": "image", "alt": "", "focus": "center", "seconds": 7, "active": "on"}
        return self.client.post("/admin/owners/heroslide/add/", {**base, **data})

    def test_adds_a_photo_slide(self):
        res = self.post(image=SimpleUploadedFile("lake.png", PNG, "image/png"))
        self.assertEqual(res.status_code, 302, res.content[:2000])
        slide = HeroSlide.objects.get(title="Lake")
        self.assertTrue(slide.image.name.startswith("hero/"))
        self.assertEqual(slide.order, 1)

    def test_adds_a_video_and_stores_its_length(self):
        res = self.post(kind="video", video=SimpleUploadedFile("lake.mp4", mp4(12), "video/mp4"))
        self.assertEqual(res.status_code, 302)
        self.assertEqual(float(HeroSlide.objects.get(title="Lake").video_seconds), 12.0)

    def test_a_video_added_while_photo_is_selected_makes_a_video_slide(self):
        # The kind field still says "Photo" (its default) when the video is chosen.
        res = self.post(video=SimpleUploadedFile("lake.mp4", mp4(10), "video/mp4"))
        self.assertEqual(res.status_code, 302, res.content[:2000])
        slide = HeroSlide.objects.get(title="Lake")
        self.assertEqual((slide.kind, float(slide.video_seconds)), ("video", 10.0))

    def test_a_video_slide_with_only_a_photo_becomes_a_photo_slide(self):
        res = self.post(kind="video", image=SimpleUploadedFile("lake.png", PNG, "image/png"))
        self.assertEqual(res.status_code, 302, res.content[:2000])
        self.assertEqual(HeroSlide.objects.get(title="Lake").kind, "image")

    def test_add_page_shows_both_upload_boxes(self):
        res = self.client.get("/admin/owners/heroslide/add/")
        self.assertContains(res, 'name="video"')
        self.assertContains(res, 'name="image"')
        self.assertNotContains(res, "vr.style.display")

    def test_refuses_a_long_video(self):
        res = self.post(kind="video", video=SimpleUploadedFile("long.mp4", mp4(31), "video/mp4"))
        self.assertEqual(res.status_code, 200)
        self.assertContains(res, "31 seconds long")
        self.assertFalse(HeroSlide.objects.filter(title="Lake").exists())

    def test_refuses_a_file_that_is_not_a_photo(self):
        res = self.post(image=SimpleUploadedFile("x.png", b"<svg onload=alert(1)>", "image/png"))
        self.assertContains(res, "Use a JPG, PNG or WebP photo.")

    def test_api_lists_active_slides_in_order(self):
        self.post(title="B", image=SimpleUploadedFile("b.png", PNG, "image/png"))
        self.post(title="A", kind="video", video=SimpleUploadedFile("a.mp4", mp4(8), "video/mp4"))
        HeroSlide.objects.create(title="Off", image="hero/off.png", active=False)
        slides = APIClient().get("/api/hero/").json()["slides"]
        # The site's original lake photo comes first (migration 0011), then the uploads.
        self.assertEqual([s["kind"] for s in slides], ["image", "image", "video"])
        self.assertTrue(slides[0]["src"].startswith("https://images.unsplash.com/"))
        self.assertTrue(slides[1]["src"].startswith("/media/hero/"))
        self.assertEqual(slides[2]["seconds"], 8.0)

    def test_photo_address_instead_of_upload(self):
        res = self.post(title="Web photo", image_url="https://images.unsplash.com/photo-1?w=10")
        self.assertEqual(res.status_code, 302)
        self.assertEqual(HeroSlide.objects.get(title="Web photo").image_url, "https://images.unsplash.com/photo-1?w=10")

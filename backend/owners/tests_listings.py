import os
import shutil
import tempfile
from datetime import timedelta
from decimal import Decimal

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.utils import timezone

from . import login as owner_login
from .models import Booking, CalendarFeed, Conversation, Cottage, CottageChange, CottagePhoto
from .tests_calendar import make_cottage

PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 64


class ListingTests(TestCase):
    def setUp(self):
        self.media = tempfile.mkdtemp()
        self.override = override_settings(MEDIA_ROOT=self.media)
        self.override.enable()
        self.c = make_cottage()
        self.other = make_cottage(email="someone@example.fi")
        self.client.force_login(owner_login.user_for(self.c.owner))
        self.base = f"/api/owner/cottages/{self.c.pk}/"

    def tearDown(self):
        self.override.disable()
        shutil.rmtree(self.media, ignore_errors=True)

    def upload(self, data=PNG, name="lake.png", kind="", cottage=None):
        url = f"/api/owner/cottages/{(cottage or self.c).pk}/photos/"
        body = {"file": SimpleUploadedFile(name, data)}
        if kind:
            body["kind"] = kind
        return self.client.post(url, body)

    def test_lists_only_own_cottages(self):
        res = self.client.get("/api/owner/cottages/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual([c["id"] for c in res.json()["cottages"]], [self.c.pk])
        self.assertEqual(self.client.get(f"/api/owner/cottages/{self.other.pk}/").status_code, 404)

    def test_needs_sign_in(self):
        self.client.logout()
        self.assertIn(self.client.get("/api/owner/cottages/").status_code, (401, 403))

    def test_updates_details_and_keeps_old_flags_in_step_with_amenities(self):
        res = self.client.patch(
            self.base,
            {
                "name": " Rantahuvila ", "max_guests": 8, "descriptions": {"en": "By the lake."},
                "amenities": ["lake", "woodSauna", "boat", "boat"], "price_per_night": "175.50",
            },
            content_type="application/json",
        )
        self.assertEqual(res.status_code, 200, res.content)
        body = res.json()
        self.assertEqual(body["name"], "Rantahuvila")
        self.assertEqual(body["amenities"], ["lake", "woodSauna", "boat"])
        self.assertEqual(body["price_per_night"], "175.50")
        self.c.refresh_from_db()
        self.assertTrue(self.c.has_sauna)
        self.assertTrue(self.c.has_lake_or_sea_access)
        self.assertEqual(self.c.max_guests, 8)

    def test_rejects_unknown_amenities_and_bad_numbers(self):
        res = self.client.patch(self.base, {"amenities": ["helipad"], "max_guests": 0}, content_type="application/json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("amenities", res.json())
        self.assertIn("max_guests", res.json())

    def test_cannot_edit_someone_elses_cottage(self):
        res = self.client.patch(f"/api/owner/cottages/{self.other.pk}/", {"name": "Mine"}, content_type="application/json")
        self.assertEqual(res.status_code, 404)
        self.assertEqual(self.upload(cottage=self.other).status_code, 404)

    def test_adds_photos_first_is_cover_and_checks_the_file(self):
        first = self.upload(kind="sauna")
        self.assertEqual(first.status_code, 201, first.content)
        self.assertEqual(first.json()["kind"], "sauna")
        self.assertEqual(self.upload(JPEG, "inside.jpeg").status_code, 201)
        self.assertEqual(self.upload(b"<svg onload=alert(1)>", "x.png").json(), {"file": ["not_image"]})
        detail = self.client.get(self.base).json()
        self.assertEqual(detail["photo_count"], 2)
        self.assertEqual(detail["cover"], detail["photos"][0]["url"])
        self.assertTrue(detail["photos"][1]["url"].endswith(".jpg"))

    def test_reorders_changes_room_and_deletes_with_file(self):
        a = self.upload().json()["id"]
        b = self.upload().json()["id"]
        res = self.client.post(f"{self.base}photos/order/", {"ids": [b, a]}, content_type="application/json")
        self.assertEqual([p["id"] for p in res.json()["photos"]], [b, a])
        self.assertEqual(self.client.post(f"{self.base}photos/order/", {"ids": [a]}, content_type="application/json").status_code, 400)
        res = self.client.patch(f"{self.base}photos/{a}/", {"kind": "bedroom"}, content_type="application/json")
        self.assertEqual(res.json()["kind"], "bedroom")
        path = CottagePhoto.objects.get(pk=b).image.path
        self.assertTrue(os.path.exists(path))
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.client.delete(f"{self.base}photos/{b}/").status_code, 204)
        self.assertFalse(os.path.exists(path))
        self.assertEqual(list(CottagePhoto.objects.values_list("pk", "position")), [(a, 0)])

    # ---------- the full editor ----------

    def patch(self, data, cottage=None):
        url = f"/api/owner/cottages/{(cottage or self.c).pk}/"
        return self.client.patch(url, data, content_type="application/json")

    def test_descriptions_merge_per_language_and_mirror_the_old_fields(self):
        self.assertEqual(self.patch({"descriptions": {"en": "By the lake.", "fi": "Järven rannalla."}}).status_code, 200)
        res = self.patch({"descriptions": {"sv": "Vid sjön."}})
        self.assertEqual(res.json()["descriptions"], {"en": "By the lake.", "fi": "Järven rannalla.", "sv": "Vid sjön."})
        res = self.patch({"descriptions": {"fi": ""}})
        self.assertEqual(set(res.json()["descriptions"]), {"en", "sv"})
        self.c.refresh_from_db()
        self.assertEqual((self.c.description_en, self.c.description_fi), ("By the lake.", ""))
        self.assertEqual(self.patch({"descriptions": {"de": "Am See."}}).status_code, 400)

    def test_saves_every_section_and_reads_it_back(self):
        data = {
            "property_type": "villa", "bathrooms": 2, "floor_area": 120, "floors": 2, "host_languages": ["fi", "en", "fi"],
            "address": "Rantatie 5", "latitude": "61.842100", "longitude": "28.965000", "show_exact_location": False,
            "nearby": [{"kind": "grocery", "name": "K-Market", "distance_km": "4.5"}],
            "amenities": ["woodSauna", "boat", "firewood"],
            "amenity_notes": {"boat": {"note": "Ask before using it after dark", "fee": None}, "firewood": {"note": "", "fee": "0"},
                              "lake": {"note": "not ticked, dropped", "fee": None}},
            "weekend_price": "190.00", "max_nights": 21, "pet_fee": "20.00", "weekly_discount": 10,
            "seasonal_prices": [{"name": "Midsummer", "start": "06-19", "end": "06-26", "price": "260.00"}],
            "check_in_from": "16:00", "check_out_by": "12:00", "pets_allowed": True, "quiet_hours": "22–7",
            "arrival_instructions": "Key in the box by the shed.", "access_details": "Code 4412",
        }
        res = self.patch(data)
        self.assertEqual(res.status_code, 200, res.content)
        self.client.logout()
        self.client.force_login(owner_login.user_for(self.c.owner))  # still there after signing in again
        body = self.client.get(self.base).json()
        self.assertEqual(body["host_languages"], ["fi", "en"])
        self.assertEqual(body["nearby"][0]["distance_km"], "4.5")
        self.assertEqual(body["amenity_notes"], {"boat": {"note": "Ask before using it after dark", "fee": None},
                                                 "firewood": {"note": "", "fee": "0.00"}})
        self.assertIn("pets", body["amenities"])  # the guest filter follows the house rule
        self.assertEqual((body["check_in_from"], body["latitude"]), ("16:00", 61.8421))
        self.assertEqual(body["access_details"], "Code 4412")
        self.assertTrue(CottageChange.objects.filter(cottage=self.c, action="edit").exists())

    def test_rejects_bad_editor_values(self):
        res = self.patch({"max_nights": 1, "min_nights": 3, "amenity_notes": {}, "min_age": 12,
                          "seasonal_prices": [{"name": "x", "start": "13-01", "end": "01-01", "price": "1"}]})
        self.assertEqual(res.status_code, 400)
        self.assertTrue({"min_age", "seasonal_prices"} <= set(res.json()))
        self.assertIn("max_nights", self.patch({"max_nights": 1, "min_nights": 3}).json())

    def test_preview_hides_private_details_and_rounds_the_location(self):
        self.patch({"address": "Rantatie 5", "access_details": "Code 4412", "arrival_instructions": "Key under the mat",
                    "latitude": "61.842123", "longitude": "28.965432"})
        body = self.client.get(f"{self.base}preview/").json()
        text = str(body)
        for secret in ("Rantatie 5", "4412", "Key under the mat"):
            self.assertNotIn(secret, text)
        self.assertEqual((body["latitude"], body["longitude"]), (61.84, 28.97))
        self.assertIn("busy", body)
        self.assertEqual(self.client.get(f"/api/owner/cottages/{self.other.pk}/preview/").status_code, 404)

    def make_publishable(self):
        self.upload()
        self.patch({"descriptions": {"en": "By the lake."}})

    def test_publish_needs_the_essentials_and_pause_relist_round_trip(self):
        self.c.status = Cottage.Status.INTAKE
        self.c.save()
        res = self.client.post(f"{self.base}status/", {"action": "publish"}, content_type="application/json")
        self.assertEqual(res.status_code, 400)
        self.assertEqual(res.json()["missing"], ["cover", "description"])
        self.make_publishable()
        res = self.client.post(f"{self.base}status/", {"action": "publish"}, content_type="application/json")
        self.assertEqual(res.json()["status"], "live")
        res = self.client.post(f"{self.base}status/", {"action": "pause"}, content_type="application/json")
        self.assertEqual(res.json()["status"], "paused")
        self.assertEqual(self.client.post(f"{self.base}status/", {"action": "pause"}, content_type="application/json").status_code, 409)
        res = self.client.post(f"{self.base}status/", {"action": "relist"}, content_type="application/json")
        self.assertEqual(res.json()["status"], "live")

    def test_pausing_keeps_stays_and_archiving_waits_for_them(self):
        today = timezone.localdate()
        stay = Booking.objects.create(cottage=self.c, channel="airbnb", check_in=today + timedelta(days=5),
                                      check_out=today + timedelta(days=8), owner_payout=Decimal("400"))
        self.client.post(f"{self.base}status/", {"action": "pause"}, content_type="application/json")
        stay.refresh_from_db()
        self.assertFalse(stay.cancelled)
        res = self.client.post(f"{self.base}status/", {"action": "archive"}, content_type="application/json")
        self.assertEqual((res.status_code, res.json()["reason"], res.json()["count"]), (409, "future_bookings", 1))

    def test_delete_needs_the_name_and_never_takes_bookings_or_messages(self):
        url = self.base
        self.assertEqual(self.client.delete(url, {"confirm": "wrong"}, content_type="application/json").status_code, 400)
        today = timezone.localdate()
        Booking.objects.create(cottage=self.c, channel="nettimokki", check_in=today - timedelta(days=40),
                               check_out=today - timedelta(days=37), owner_payout=Decimal("300"))
        res = self.client.delete(url, {"confirm": "Järvihuvila"}, content_type="application/json")
        self.assertEqual((res.status_code, res.json()["reason"]), (409, "has_bookings"))
        draft = self.client.post("/api/owner/cottages/", {"name": "Uusi mökki"}, content_type="application/json").json()
        Conversation.objects.create(cottage_id=draft["id"], guest_name="Anna", token="t" * 30)
        res = self.client.delete(f"/api/owner/cottages/{draft['id']}/", {"confirm": "Uusi mökki"}, content_type="application/json")
        self.assertEqual(res.json()["reason"], "has_messages")
        empty = self.client.post("/api/owner/cottages/", {"name": "Tyhjä"}, content_type="application/json").json()
        res = self.client.delete(f"/api/owner/cottages/{empty['id']}/", {"confirm": "Tyhjä"}, content_type="application/json")
        self.assertEqual(res.status_code, 204)
        self.assertEqual(self.client.delete(f"/api/owner/cottages/{self.other.pk}/", {"confirm": "Järvihuvila"},
                                            content_type="application/json").status_code, 404)

    def test_new_draft_and_duplicate_belong_to_the_owner_without_private_details(self):
        res = self.client.post("/api/owner/cottages/", {"name": "Saunamökki"}, content_type="application/json")
        self.assertEqual((res.status_code, res.json()["status"], res.json()["completeness"] < 50), (201, "intake", True))
        self.upload(kind="sauna")
        self.patch({"access_details": "Code 4412", "descriptions": {"en": "By the lake."}})
        copy = self.client.post(f"{self.base}duplicate/", content_type="application/json").json()
        self.assertEqual((copy["name"], copy["status"], copy["photo_count"]), ("Järvihuvila (2)", "intake", 1))
        self.assertEqual((copy["access_details"], copy["descriptions"]["en"]), ("", "By the lake."))
        clone = Cottage.objects.get(pk=copy["id"])
        self.assertEqual(clone.owner, self.c.owner)
        self.assertNotEqual(clone.calendar_token, self.c.calendar_token)
        self.assertNotEqual(clone.photos.get().image.name, self.c.photos.get().image.name)
        self.assertEqual(self.client.post(f"/api/owner/cottages/{self.other.pk}/duplicate/").status_code, 404)

    def test_replacing_a_photo_keeps_its_place_and_removes_the_old_file_after(self):
        a = self.upload(kind="sauna", ).json()["id"]
        self.client.patch(f"{self.base}photos/{a}/", {"caption": "Wood-fired"}, content_type="application/json")
        old = CottagePhoto.objects.get(pk=a).image.path
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client.post(f"{self.base}photos/{a}/replace/", {"file": SimpleUploadedFile("n.jpg", JPEG)})
        self.assertEqual(res.status_code, 200, res.content)
        self.assertEqual((res.json()["id"], res.json()["kind"], res.json()["caption"]), (a, "sauna", "Wood-fired"))
        self.assertFalse(os.path.exists(old))
        res = self.client.post(f"{self.base}photos/{a}/replace/", {"file": SimpleUploadedFile("x.png", b"nope")})
        self.assertEqual(res.status_code, 400)
        self.assertTrue(os.path.exists(CottagePhoto.objects.get(pk=a).image.path))  # a failed replace keeps the photo

    def test_channel_states_come_from_the_calendar_links(self):
        now = timezone.now()
        CalendarFeed.objects.create(cottage=self.c, channel="airbnb", url="https://a.example/x.ics", last_synced_at=now)
        CalendarFeed.objects.create(cottage=self.c, channel="booking", url="https://b.example/x.ics", last_error="404")
        CalendarFeed.objects.create(cottage=self.c, channel="vrbo", url="https://v.example/x.ics",
                                    last_synced_at=now - timedelta(hours=5))
        row = self.client.get("/api/owner/cottages/").json()["cottages"][0]
        states = {ch["channel"]: ch["state"] for ch in row["channels"]}
        self.assertEqual(states, {"airbnb": "connected", "booking": "failed", "vrbo": "attention", "agoda": "not_connected",
                                  "nettimokki": "not_connected"})
        self.assertTrue(row["attention"])

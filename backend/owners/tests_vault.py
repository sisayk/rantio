import io

from cryptography.fernet import Fernet
from django.contrib.admin.sites import site
from django.core.checks import run_checks
from django.core.management import CommandError, call_command
from django.test import SimpleTestCase, TestCase, override_settings

from . import login as owner_login
from . import vault
from datetime import date

from django.db.models import TextField
from django.db.models.functions import Cast

from .models import Owner
from .profile import masked_tax_id
from .tests_calendar import make_cottage

HETU = "131052-308T"
A, B = Fernet.generate_key().decode(), Fernet.generate_key().decode()


@override_settings(SECRET_KEY="secret-1", SECRET_KEY_FALLBACKS=[], VAULT_KEYS=[])
class VaultTests(SimpleTestCase):
    def test_legacy_values_round_trip_and_hide_the_number(self):
        token = vault.seal(HETU)
        self.assertNotIn("131052", token)
        self.assertFalse(token.startswith("v2:"))
        self.assertEqual(vault.unseal(token), HETU)
        self.assertEqual(vault.seal(""), "")
        self.assertEqual(vault.unseal(""), "")

    def test_a_vault_key_names_itself_in_the_value(self):
        with self.settings(VAULT_KEYS=[A]):
            token = vault.seal(HETU)
            self.assertTrue(token.startswith(f"v2:{vault.key_id(A)}:"))
            self.assertNotIn(HETU, token)
            self.assertEqual(vault.unseal(token), HETU)

    def test_values_from_before_vault_keys_stay_readable(self):
        old = vault.seal(HETU)  # legacy, from SECRET_KEY
        with self.settings(VAULT_KEYS=[A]):
            self.assertEqual(vault.unseal(old), HETU)
            self.assertTrue(vault.needs_reseal(old))
            fresh = vault.reseal(old)
            self.assertTrue(fresh.startswith(f"v2:{vault.key_id(A)}:"))
            self.assertFalse(vault.needs_reseal(fresh))

    def test_changing_secret_key_needs_the_old_one_as_a_fallback(self):
        old = vault.seal(HETU)
        with self.settings(SECRET_KEY="secret-2"):
            with self.assertRaises(vault.Unreadable):
                vault.unseal(old)
        with self.settings(SECRET_KEY="secret-2", SECRET_KEY_FALLBACKS=["secret-1"]):
            self.assertEqual(vault.unseal(old), HETU)

    def test_with_its_own_key_secret_key_can_change_freely(self):
        with self.settings(VAULT_KEYS=[A]):
            token = vault.seal(HETU)
        with self.settings(VAULT_KEYS=[A], SECRET_KEY="secret-2"):
            self.assertEqual(vault.unseal(token), HETU)

    def test_rotating_the_vault_key(self):
        with self.settings(VAULT_KEYS=[A]):
            old = vault.seal(HETU)
        with self.settings(VAULT_KEYS=[B, A]):
            self.assertEqual(vault.unseal(old), HETU)
            self.assertTrue(vault.needs_reseal(old))
            fresh = vault.reseal(old)
        with self.settings(VAULT_KEYS=[B]):
            self.assertEqual(vault.unseal(fresh), HETU)

    def test_a_missing_key_is_an_error_not_an_empty_value(self):
        with self.settings(VAULT_KEYS=[A]):
            token = vault.seal(HETU)
        with self.settings(VAULT_KEYS=[B]):
            with self.assertRaises(vault.Unreadable) as caught:
                vault.unseal(token)
            self.assertIn(vault.key_id(A), str(caught.exception))
            self.assertNotIn(HETU, str(caught.exception))
            self.assertEqual(vault.which_key(token), "unreadable")
            self.assertFalse(vault.needs_reseal(token))

    def test_damaged_values_are_errors(self):
        with self.settings(VAULT_KEYS=[A]):
            token = vault.seal(HETU)
            broken = token[:-6] + ("A" if token[-6] != "A" else "B") + token[-5:]
            for bad in (broken, "v2:", "v2:abc", f"v2:{vault.key_id(A)}:", "not-a-token"):
                with self.subTest(bad=bad), self.assertRaises(vault.Unreadable):
                    vault.unseal(bad)

    def test_a_malformed_key_stops_the_deploy_check(self):
        with self.settings(VAULT_KEYS=["not-a-key"]):
            ids = [m.id for m in run_checks()]
            self.assertIn("owners.E010", ids)
        with self.settings(VAULT_KEYS=[A]):
            self.assertNotIn("owners.E010", [m.id for m in run_checks()])

    def test_the_deploy_check_warns_without_a_vault_key(self):
        self.assertIn("owners.W010", [m.id for m in run_checks(include_deployment_checks=True)])
        with self.settings(VAULT_KEYS=[A]):
            self.assertNotIn("owners.W010", [m.id for m in run_checks(include_deployment_checks=True)])

    def test_masking_never_shows_the_identifying_part(self):
        self.assertEqual(masked_tax_id(HETU), "131052-••••")
        self.assertNotIn("308T", masked_tax_id(HETU))
        self.assertEqual(masked_tax_id("198112189876"), "•••••76")
        self.assertEqual(masked_tax_id(""), "")


@override_settings(SECRET_KEY="secret-1", SECRET_KEY_FALLBACKS=[], VAULT_KEYS=[A])
class VaultInTheAppTests(TestCase):
    def setUp(self):
        self.o = make_cottage().owner
        self.client.force_login(owner_login.user_for(self.o))

    def details(self):
        return self.client.get("/api/owner/me/").json()["details"]

    def save_tax_id(self, tin=HETU):
        res = self.client.patch("/api/owner/me/", {"details": {"tax_country": "FI", "tax_id": tin}}, content_type="application/json")
        self.assertEqual(res.status_code, 200, res.content)
        self.o.refresh_from_db()

    def test_the_account_shows_the_number_masked(self):
        self.save_tax_id()
        d = self.details()
        self.assertEqual((d["tax_id"], d["has_tax_id"], d["tax_id_unreadable"]), ("131052-••••", True, False))
        self.assertNotIn("tax_id", d["missing"])

    def test_an_unreadable_number_is_flagged_not_treated_as_missing(self):
        self.save_tax_id()
        stored = self.o.tax_id_sealed
        with self.settings(VAULT_KEYS=[B]), self.assertLogs("owners.profile", "ERROR") as logs:
            d = self.details()
            self.assertEqual((d["tax_id"], d["has_tax_id"], d["tax_id_unreadable"]), ("•••••", True, True))
            self.assertNotIn("tax_id", d["missing"])  # the owner isn't asked again for a key mistake
            self.assertNotIn("308T", "".join(logs.output))
            # The page sends the mask back unchanged: the stored value stays.
            self.client.patch("/api/owner/me/", {"details": {"tax_id": d["tax_id"]}}, content_type="application/json")
        self.o.refresh_from_db()
        self.assertEqual(self.o.tax_id_sealed, stored)
        self.assertEqual(self.details()["tax_id"], "131052-••••")  # the key back: readable again

    def test_the_admin_shows_it_masked_or_says_it_cant_be_read(self):
        self.save_tax_id()
        admin = site._registry[Owner]
        self.assertEqual(admin.tax_number(self.o), "131052-••••")
        with self.settings(VAULT_KEYS=[B]), self.assertLogs("owners.profile", "ERROR"):
            self.assertIn("Can't be decrypted", admin.tax_number(self.o))

    def run_vault(self, *args):
        out = io.StringIO()
        call_command("vault", *args, stdout=out)
        return out.getvalue()

    def test_status_and_reseal_move_values_without_printing_them(self):
        with self.settings(VAULT_KEYS=[]):
            self.save_tax_id()  # legacy
        self.assertIn("legacy", self.run_vault("status"))
        dry = self.run_vault("reseal")
        self.assertIn("2 to move", dry)  # the tax number, and the date of birth it filled in
        self.o.refresh_from_db()
        self.assertFalse(self.o.tax_id_sealed.startswith("v2:"))  # a dry run changes nothing
        done = self.run_vault("reseal", "--commit")
        self.o.refresh_from_db()
        self.assertTrue(self.o.tax_id_sealed.startswith(f"v2:{vault.key_id(A)}:"))
        self.assertEqual(vault.unseal(self.o.tax_id_sealed), HETU)
        status = self.run_vault("status")
        self.assertIn("newest key", status)
        for text in (dry, done, status):
            self.assertNotIn("308T", text)
            self.assertNotIn("131052", text)

    def test_status_names_the_owners_whose_value_cant_be_opened(self):
        self.save_tax_id()
        with self.settings(VAULT_KEYS=[B]):
            out = self.run_vault("status")
            self.assertIn("CAN'T BE OPENED", out)
            self.assertIn(str(self.o.pk), out)
            self.assertIn("0 to move", self.run_vault("reseal", "--commit"))
        self.o.refresh_from_db()
        self.assertTrue(self.o.tax_id_sealed.startswith(f"v2:{vault.key_id(A)}:"))  # left untouched

    def test_reseal_needs_a_vault_key(self):
        with self.settings(VAULT_KEYS=[]), self.assertRaises(CommandError):
            self.run_vault("reseal")


IBAN = "FI2112345600000785"
PEOPLE = [{"name": "Aino Virtanen", "date_of_birth": "1970-05-01", "country": "FI", "share": 60}]


@override_settings(SECRET_KEY="secret-1", SECRET_KEY_FALLBACKS=[], VAULT_KEYS=[A])
class SealedFieldTests(TestCase):
    """The bank account, the date of birth and the beneficial owners: encrypted in the database,
    in clear for the code, and never erased by a save when a key is missing."""

    def setUp(self):
        self.o = make_cottage().owner
        self.o.payout_iban, self.o.date_of_birth, self.o.beneficial_owners = IBAN, date(1983, 7, 2), PEOPLE
        self.o.save()
        self.client.force_login(owner_login.user_for(self.o))

    def stored(self, name):
        return Owner.objects.annotate(raw=Cast(name, TextField())).values_list("raw", flat=True).get(pk=self.o.pk)

    def details(self):
        return self.client.get("/api/owner/me/").json()["details"]

    def test_stored_encrypted_read_in_clear(self):
        for name, clear in (("payout_iban", IBAN), ("date_of_birth", "1983-07-02"), ("beneficial_owners", "Virtanen")):
            raw = self.stored(name)
            self.assertTrue(raw.startswith(f"v2:{vault.key_id(A)}:"), name)
            self.assertNotIn(clear, raw)
        o = Owner.objects.get(pk=self.o.pk)
        self.assertEqual((o.payout_iban, o.date_of_birth, o.beneficial_owners), (IBAN, date(1983, 7, 2), PEOPLE))
        self.assertEqual(Owner.objects.filter(pk=self.o.pk, payout_iban="").count(), 0)

    def test_nothing_stored_stays_empty(self):
        o = make_cottage(email="tyhja@example.fi").owner
        self.assertEqual((self.stored_of(o, "payout_iban"), self.stored_of(o, "date_of_birth"), self.stored_of(o, "beneficial_owners")), ("", None, ""))
        o = Owner.objects.get(pk=o.pk)
        self.assertEqual((o.payout_iban, o.date_of_birth, o.beneficial_owners), ("", None, []))

    def stored_of(self, o, name):
        return Owner.objects.annotate(raw=Cast(name, TextField())).values_list("raw", flat=True).get(pk=o.pk)

    def test_the_account_still_shows_them(self):
        d = self.details()
        self.assertEqual((d["payout_iban"], d["has_payout"], d["date_of_birth"]), ("FI•• •••• 0785", True, "1983-07-02"))
        self.assertEqual(d["beneficial_owners"][0]["name"], "Aino Virtanen")

    def test_a_missing_key_never_erases_them(self):
        before = {name: self.stored(name) for name in ("payout_iban", "date_of_birth", "beneficial_owners")}
        with self.settings(VAULT_KEYS=[B]), self.assertLogs("owners.vault", "ERROR") as logs:
            d = self.details()
            self.assertEqual((d["payout_iban"], d["has_payout"], d["date_of_birth"], d["beneficial_owners"]), ("•••••", True, "", []))
            self.assertNotIn("payout", d["missing"])  # not asked again for an operator's mistake
            # The page sends back what it shows; other details change; then a full save.
            res = self.client.patch("/api/owner/me/", {"details": {
                "payout_iban": d["payout_iban"], "date_of_birth": "", "beneficial_owners": [], "city": "Savonlinna",
            }}, content_type="application/json")
            self.assertEqual(res.status_code, 200, res.content)
            o = Owner.objects.get(pk=self.o.pk)
            self.assertTrue(vault.is_locked(o.payout_iban))
            o.save()
            for text in ("FI21", "0785", "1983", "Virtanen"):
                self.assertNotIn(text, "".join(logs.output))
        self.assertEqual({name: self.stored(name) for name in before}, before)
        o = Owner.objects.get(pk=self.o.pk)
        self.assertEqual((o.payout_iban, o.date_of_birth, o.city), (IBAN, date(1983, 7, 2), "Savonlinna"))

    def test_a_new_value_replaces_one_that_cant_be_opened(self):
        with self.settings(VAULT_KEYS=[B]), self.assertLogs("owners.vault", "ERROR"):
            res = self.client.patch("/api/owner/me/", {"details": {"payout_iban": "FI49 5000 9420 0287 30"}}, content_type="application/json")
            self.assertEqual(res.status_code, 200, res.content)
            self.assertEqual(Owner.objects.get(pk=self.o.pk).payout_iban, "FI4950009420028730")

    def admin_form(self, o, changes=None):
        from django.contrib.auth.models import User
        from django.test import RequestFactory

        request = RequestFactory().get("/")
        request.user = User.objects.create_superuser("staff", "staff@rantio.fi", "x")
        form_class = site._registry[Owner].get_form(request, o)
        initial = form_class(instance=o).initial
        data = {**{k: v for k, v in initial.items() if v is not None}, **(changes or {})}
        for name in ("beneficial_owners", "reservations_contact"):
            if isinstance(data.get(name), (list, dict)):
                import json
                data[name] = json.dumps(data[name])
        return form_class(data=data, files={}, instance=o), initial

    def test_the_admin_shows_them_in_clear_for_payouts(self):
        o = Owner.objects.get(pk=self.o.pk)
        form, initial = self.admin_form(o)
        self.assertEqual((initial["payout_iban"], initial["date_of_birth"]), (IBAN, date(1983, 7, 2)))
        self.assertIn("Virtanen", form["beneficial_owners"].value())

    def test_the_admin_form_keeps_what_it_cant_open(self):
        with self.settings(VAULT_KEYS=[B]), self.assertLogs("owners.vault", "ERROR"):
            o = Owner.objects.get(pk=self.o.pk)
            form, initial = self.admin_form(o, {"city": "Punkaharju"})
            self.assertEqual(initial["payout_iban"], "")  # shown empty, not as "•••••"
            self.assertTrue(form.is_valid(), form.errors)
            form.save()
        o = Owner.objects.get(pk=self.o.pk)
        self.assertEqual((o.payout_iban, o.date_of_birth, o.beneficial_owners, o.city), (IBAN, date(1983, 7, 2), PEOPLE, "Punkaharju"))

    def test_status_and_reseal_cover_them(self):
        with self.settings(VAULT_KEYS=[B, A]):
            dry = self.run_vault("reseal")
            self.assertIn("3 to move", dry)
            self.run_vault("reseal", "--commit")
            status = self.run_vault("status")
            for name in ("payout_iban", "date_of_birth", "beneficial_owners"):
                self.assertTrue(self.stored(name).startswith(f"v2:{vault.key_id(B)}:"), name)
                self.assertIn(name, status)
            self.assertNotIn("older key", status)
            o = Owner.objects.get(pk=self.o.pk)
            self.assertEqual((o.payout_iban, o.date_of_birth, o.beneficial_owners), (IBAN, date(1983, 7, 2), PEOPLE))
        for text in (dry, status):
            self.assertNotIn("0785", text)

    def run_vault(self, *args):
        out = io.StringIO()
        call_command("vault", *args, stdout=out)
        return out.getvalue()

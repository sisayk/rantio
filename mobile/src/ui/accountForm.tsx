// The owner's details as one form, shared by the Account settings pages. Each page shows its part and saves the whole.
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import { ApiError, ownerApi, type OwnerDetails } from "@/api";
import { ACCOUNT } from "@/i18n/messages/account";
import { useSession } from "@/state/session";
import { useT } from "@/text/i18n";

export type SettingsSection = "personal" | "security" | "payments" | "business" | "taxes" | "notifications";
export type Missing = OwnerDetails["missing"][number];

/** Which page fills in each thing the booking sites still need. */
export const SECTION_OF: Record<Missing, SettingsSection> = {
  legal_name: "personal",
  date_of_birth: "personal",
  address: "personal",
  phone: "personal",
  emergency: "personal",
  payout: "payments",
  tax_id: "taxes",
  company_name: "business",
  business_type: "business",
  business_id: "business",
  legal_rep: "business",
  beneficial_owners: "business",
};

/** A profile saved by an older app (or server) lacks the newer lists; give them safe empty values. */
export function withDefaults(d: OwnerDetails | null | undefined): OwnerDetails | null {
  if (!d) return null;
  return {
    ...d,
    missing: d.missing ?? [],
    beneficial_owners: d.beneficial_owners ?? [],
    reservations_contact: d.reservations_contact ?? {},
    postal_same: d.postal_same ?? true,
  };
}

export function useAccountForm() {
  const { lang } = useT();
  const t = ACCOUNT[lang].profile;
  const d = ACCOUNT[lang].details;
  const { owner, refresh } = useSession();
  const [name, setName] = useState(owner?.name ?? "");
  const [phone, setPhone] = useState(owner?.phone ?? "");
  const [det, setDetState] = useState<OwnerDetails | null>(withDefaults(owner?.details));
  const [iban, setIban] = useState("");
  const [tin, setTin] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fresh, setFresh] = useState(false);

  // The saved profile can be from an older version; read the current one once on opening.
  useFocusEffect(
    useCallback(() => {
      if (fresh || !owner) return;
      ownerApi
        .me()
        .then((me) => {
          setFresh(true);
          if (me.details) setDetState(withDefaults(me.details));
        })
        .catch(() => {});
    }, [fresh, owner]),
  );

  const setDet = (next: OwnerDetails) => {
    setDetState(next);
    setSaved(false);
  };

  const save = async () => {
    setBusy(true);
    setError("");
    setSaved(false);
    setFieldErrors({});
    try {
      let details: Partial<OwnerDetails> | undefined;
      if (det) {
        // Read-only parts and the masked numbers stay out; a new IBAN or tax number only if typed.
        const { has_payout: _a, payout_iban: _b, has_tax_id: _c, tax_id: _d, missing: _e, ...rest } = det;
        void [_a, _b, _c, _d, _e];
        details = { ...rest, ...(iban.trim() ? { payout_iban: iban } : {}), ...(tin.trim() ? { tax_id: tin } : {}) };
      }
      const me = await ownerApi.updateMe({ name: name.trim(), phone: phone.trim(), details });
      if (me.details) setDetState(withDefaults(me.details));
      setIban("");
      setTin("");
      await refresh();
      setSaved(true);
    } catch (e) {
      const body = e instanceof ApiError ? e.body : {};
      const code = String((body.phone as string[] | undefined)?.[0] ?? "");
      const bad: Record<string, string> = {};
      for (const [k, v] of Object.entries((body.details ?? {}) as Record<string, string[]>)) {
        bad[k] = v[0] === "required" ? d.errors.required : v[0] === "too_long" ? d.errors.too_long : d.errors.invalid;
      }
      if (code) bad.phone = code === "taken" ? t.phoneTaken : t.invalidPhone;
      setFieldErrors(bad);
      setError(Object.keys(bad).length ? d.errors.invalid : t.failed);
    } finally {
      setBusy(false);
    }
  };

  return { owner, name, setName, phone, setPhone, det, setDet, iban, setIban, tin, setTin, fieldErrors, busy, error, saved, save, refresh };
}

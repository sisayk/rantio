"use client";

/* eslint-disable @next/next/no-img-element -- the owner's own photo, served by Django */
import { useCallback, useEffect, useState } from "react";
import type { Messages } from "@/i18n";
import { countryName, fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { ACCOUNT } from "@/i18n/messages/account";
import { paths } from "@/i18n/paths";
import { preparePhoto } from "@/lib/imagePrep";
import { type OwnerDetails, type OwnerMe, ownerApi, type PaymentMethod, SignedOut } from "@/lib/ownerApi";
import { forgetOwnerSession } from "@/lib/useOwnerSession";
import HostingHeader from "./HostingHeader";
import o from "./owner.module.css";
import s from "./listing/editor.module.css";

const COUNTRIES = ["FI", "SE", "NO", "DK", "IS", "EE", "LV", "LT", "DE", "AT", "CH", "NL", "BE", "FR", "ES", "IT", "PL", "GB", "IE", "US"];
const BRANDS: Record<string, string> = { visa: "Visa", mastercard: "Mastercard", amex: "American Express" };
type Errors = Record<string, string>;

/** Hosting → Account: photo, name and phone, a person or a company, address, the bank account the owner
 *  is paid to, the payment method Rantio's fees are charged to, and deleting the account. */
export default function OwnerAccount({ lang, t, languageButton }: { lang: Lang; t: Messages["dashboard"]; languageButton: React.ReactNode }) {
  const a = ACCOUNT[lang];
  const p = a.profile;
  const d = a.details;
  const [me, setMe] = useState<OwnerMe | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [det, setDet] = useState<OwnerDetails | null>(null);
  const [iban, setIban] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [payment, setPayment] = useState<{ available: boolean; method: PaymentMethod | null } | null>(null);
  const [paying, setPaying] = useState(false);
  const [problem, setProblem] = useState("");

  const signedOut = useCallback(() => window.location.replace(paths.hostingLogin(lang)), [lang]);

  const take = useCallback((m: OwnerMe) => {
    setMe(m);
    setName(m.name);
    setPhone(m.phone);
    setDet(m.details);
    setIban("");
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      ownerApi.me().then(take, (e) => (e instanceof SignedOut ? signedOut() : setProblem(p.failed)));
      ownerApi.paymentMethod().then(setPayment, () => setPayment({ available: false, method: null }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [take, signedOut, p.failed]);

  if (!me || !det) {
    return (
      <div className={o.page}>
        <HostingHeader lang={lang} t={t} languageButton={languageButton} active="account" />
        <main className={o.main}>
          <p className={s.hint}>{problem || "…"}</p>
        </main>
      </div>
    );
  }

  const set = <K extends keyof OwnerDetails>(k: K, v: OwnerDetails[K]) => {
    setDet({ ...det, [k]: v });
    setSaved(false);
  };
  const err = (k: string) => (errors[k] ? <em className={s.error}>{errors[k]}</em> : null);
  const errText = (code: string) => (code === "taken" ? p.phoneTaken : code === "required" ? d.errors.required : code === "too_long" ? d.errors.too_long : d.errors.invalid);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!det) return;
    setSaving(true);
    setErrors({});
    setSaved(false);
    try {
      const { has_payout: _skip, payout_iban: _masked, ...rest } = det;
      void _skip;
      void _masked;
      const details: Partial<OwnerDetails> = { ...rest, ...(iban.trim() ? { payout_iban: iban } : {}) };
      take(await ownerApi.updateMe({ name: name.trim(), phone: phone.trim(), details }));
      setSaved(true);
    } catch (e) {
      if (e instanceof SignedOut) return signedOut();
      const body = ((e as { body?: Record<string, unknown> }).body ?? {}) as Record<string, unknown>;
      const out: Errors = {};
      for (const [k, v] of Object.entries((body.details ?? {}) as Record<string, string[]>)) out[k] = errText(String(v[0]));
      if (Array.isArray(body.phone)) out.phone = errText(String(body.phone[0]));
      if (Array.isArray(body.name)) out.name = d.errors.required;
      setErrors(Object.keys(out).length ? out : { form: p.failed });
    } finally {
      setSaving(false);
    }
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    setPhotoBusy(true);
    try {
      // Drawn again in the browser: smaller, and without the camera's GPS data.
      const ready = await preparePhoto(file);
      await ownerApi.setProfilePhoto(ready.blob, ready.name);
      take(await ownerApi.me());
    } catch (e) {
      if (e instanceof SignedOut) return signedOut();
      setProblem(p.failed);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    try {
      await ownerApi.removeProfilePhoto();
      take(await ownerApi.me());
    } catch {
      setProblem(p.failed);
    } finally {
      setPhotoBusy(false);
    }
  }

  async function changePayment() {
    setPaying(true);
    try {
      window.location.assign((await ownerApi.newPaymentPage()).url);
    } catch (e) {
      if (e instanceof SignedOut) return signedOut();
      setProblem(p.failed);
      setPaying(false);
    }
  }

  async function remove() {
    if (!window.confirm(`${a.title}\n\n${a.body}`)) return;
    try {
      await ownerApi.deleteAccount();
      forgetOwnerSession();
      window.alert(a.done);
      window.location.assign(paths.home(lang));
    } catch {
      setProblem(a.error);
    }
  }

  const m = payment?.method;
  const methodLine = m
    ? m.kind === "bank"
      ? fill(lang, p.bank, { last4: m.last4 })
      : fill(lang, p.card, { brand: BRANDS[m.brand] ?? (m.brand ? m.brand[0].toUpperCase() + m.brand.slice(1) : "Card"), last4: m.last4 })
    : p.none;
  const initials = me.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className={o.page}>
      <HostingHeader lang={lang} t={t} languageButton={languageButton} active="account" ownerName={me.name} />
      <main className={o.main} style={{ maxWidth: 760 }}>
        <h1 style={{ margin: "8px 0 20px" }}>{p.title}</h1>
        {problem ? (
          <p className={s.error} role="alert">
            {problem}
          </p>
        ) : null}

        <form onSubmit={save} style={{ display: "grid", gap: 20 }} noValidate>
          <section className={s.panel} aria-labelledby="acc-profile">
            <h2 id="acc-profile">{p.edit}</h2>
            <div className={s.row} style={{ gap: 18 }}>
              {me.photo ? (
                <img src={me.photo} alt={p.photo} width={88} height={88} style={{ width: 88, height: 88, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <span aria-hidden="true" style={{ width: 88, height: 88, borderRadius: "50%", background: "#1d4c3c", color: "#fff", display: "grid", placeItems: "center", fontSize: 32, fontWeight: 700 }}>
                  {initials || "?"}
                </span>
              )}
              <div className={s.row}>
                <label className={s.button} style={{ cursor: "pointer" }}>
                  {photoBusy ? "…" : me.photo ? p.changePhoto : p.addPhoto}
                  <input type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => void pickPhoto(e.target.files?.[0])} />
                </label>
                {me.photo ? (
                  <button type="button" className={s.ghost} onClick={() => void removePhoto()} disabled={photoBusy}>
                    {p.removePhoto}
                  </button>
                ) : null}
              </div>
            </div>
            <label className={s.field}>
              <span>{p.name}</span>
              <input className={s.input} value={name} maxLength={120} autoComplete="name" onChange={(e) => (setName(e.target.value), setSaved(false))} aria-invalid={!!errors.name} />
              {err("name")}
            </label>
            <label className={s.field}>
              <span>{p.phone}</span>
              <input className={s.input} value={phone} maxLength={40} type="tel" autoComplete="tel" onChange={(e) => (setPhone(e.target.value), setSaved(false))} aria-invalid={!!errors.phone} />
              {err("phone") ?? <small className={s.hint}>{p.phoneHint}</small>}
            </label>
            <div className={s.field}>
              <span>{p.email}</span>
              <strong style={{ fontWeight: 500 }}>{me.email}</strong>
              <small className={s.hint}>{p.emailHint}</small>
            </div>
          </section>

          <section className={s.panel} aria-labelledby="acc-details">
            <h2 id="acc-details">{d.who}</h2>
            <div className={s.row} role="radiogroup" aria-label={d.who}>
              {(["private", "company"] as const).map((k) => (
                <label key={k} className={s.button} style={{ cursor: "pointer", ...(det.account_type === k ? { background: "#1d2a2e", color: "#fff" } : {}) }}>
                  <input type="radio" name="account_type" checked={det.account_type === k} onChange={() => set("account_type", k)} style={{ marginRight: 8 }} />
                  {d[k]}
                </label>
              ))}
            </div>
            {det.account_type === "company" ? (
              <>
                <label className={s.field}>
                  <span>{d.companyName}</span>
                  <input className={s.input} value={det.company_name} maxLength={160} autoComplete="organization" onChange={(e) => set("company_name", e.target.value)} aria-invalid={!!errors.company_name} />
                  {err("company_name")}
                </label>
                <div className={s.row} style={{ alignItems: "start" }}>
                  <label className={s.field} style={{ flex: 1, minWidth: 200 }}>
                    <span>{d.businessId}</span>
                    <input className={s.input} value={det.business_id} maxLength={30} placeholder="1234567-8" onChange={(e) => set("business_id", e.target.value)} aria-invalid={!!errors.business_id} />
                    {err("business_id")}
                  </label>
                  <label className={s.field} style={{ flex: 1, minWidth: 200 }}>
                    <span>
                      {d.vatId} <i className={s.hint}>({d.optional})</i>
                    </span>
                    <input className={s.input} value={det.vat_id} maxLength={20} placeholder="FI12345678" onChange={(e) => set("vat_id", e.target.value)} aria-invalid={!!errors.vat_id} />
                    {err("vat_id")}
                  </label>
                </div>
              </>
            ) : null}
            <div className={s.group}>
              <h3>{d.address}</h3>
              <label className={s.field}>
                <span>{d.street}</span>
                <input className={s.input} value={det.address_line} maxLength={200} autoComplete="street-address" onChange={(e) => set("address_line", e.target.value)} aria-invalid={!!errors.address_line} />
                {err("address_line")}
              </label>
              <div className={s.row} style={{ alignItems: "start" }}>
                <label className={s.field} style={{ width: 140 }}>
                  <span>{d.postal}</span>
                  <input className={s.input} value={det.postal_code} maxLength={20} autoComplete="postal-code" onChange={(e) => set("postal_code", e.target.value)} />
                </label>
                <label className={s.field} style={{ flex: 1, minWidth: 180 }}>
                  <span>{d.city}</span>
                  <input className={s.input} value={det.city} maxLength={100} autoComplete="address-level2" onChange={(e) => set("city", e.target.value)} />
                </label>
                <label className={s.field} style={{ flex: 1, minWidth: 180 }}>
                  <span>{d.country}</span>
                  <select className={s.input} value={det.address_country} onChange={(e) => set("address_country", e.target.value)}>
                    <option value="">–</option>
                    {COUNTRIES.map((c) => (
                      <option key={c} value={c}>
                        {countryName(lang, c)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>

          <section className={s.panel} aria-labelledby="acc-payout">
            <h2 id="acc-payout">{d.payout}</h2>
            <p className={s.panelLead}>{d.payoutLead}</p>
            <label className={s.field}>
              <span>{d.holder}</span>
              <input className={s.input} value={det.payout_holder} maxLength={160} autoComplete="name" onChange={(e) => set("payout_holder", e.target.value)} />
            </label>
            <div className={s.row} style={{ alignItems: "start" }}>
              <label className={s.field} style={{ flex: 2, minWidth: 240 }}>
                <span>{d.iban}</span>
                <input
                  className={s.input}
                  value={iban}
                  maxLength={42}
                  placeholder={det.has_payout ? det.payout_iban : "FI00 1234 5600 0007 85"}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => (setIban(e.target.value.toUpperCase()), setSaved(false))}
                  aria-invalid={!!errors.payout_iban}
                />
                {err("payout_iban") ?? (det.has_payout ? <small className={s.hint}>{fill(lang, d.ibanSaved, { iban: det.payout_iban })}</small> : null)}
              </label>
              <label className={s.field} style={{ flex: 1, minWidth: 140 }}>
                <span>
                  {d.bic} <i className={s.hint}>({d.optional})</i>
                </span>
                <input className={s.input} value={det.payout_bic} maxLength={11} autoComplete="off" onChange={(e) => set("payout_bic", e.target.value.toUpperCase())} aria-invalid={!!errors.payout_bic} />
                {err("payout_bic")}
              </label>
            </div>
          </section>

          <div className={s.row}>
            <button type="submit" className={o.primary} disabled={saving || !name.trim()}>
              {saving ? "…" : saved ? `✓ ${p.saved}` : p.save}
            </button>
            {errors.form ? <span className={s.error}>{errors.form}</span> : null}
          </div>
        </form>

        {me.is_host && payment?.available ? (
          <section className={s.panel} aria-labelledby="acc-pay" style={{ marginTop: 20 }}>
            <h2 id="acc-pay">{p.payment}</h2>
            <p className={s.panelLead}>{p.paymentLead}</p>
            <p style={{ margin: 0, fontWeight: 600 }}>
              {methodLine}
              {m?.exp_month && m.exp_year ? (
                <span className={s.hint} style={{ fontWeight: 400 }}>
                  {" · "}
                  {fill(lang, p.expires, { month: String(m.exp_month).padStart(2, "0"), year: String(m.exp_year).slice(-2) })}
                </span>
              ) : null}
            </p>
            <div>
              <button type="button" className={s.button} disabled={paying} onClick={() => void changePayment()}>
                {m ? p.change : p.add}
              </button>
            </div>
          </section>
        ) : null}

        <div style={{ marginTop: 32 }}>
          <button type="button" className={s.ghost} style={{ color: "#b42318" }} onClick={() => void remove()}>
            {a.delete}
          </button>
        </div>
      </main>
    </div>
  );
}

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
  const h = a.host;
  const [me, setMe] = useState<OwnerMe | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [det, setDet] = useState<OwnerDetails | null>(null);
  const [iban, setIban] = useState("");
  const [tin, setTin] = useState("");
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
    setTin("");
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
      // Read-only parts and the masked numbers stay out; a new IBAN or tax number only if typed.
      const { has_payout: _a, payout_iban: _b, has_tax_id: _c, tax_id: _d, missing: _e, ...rest } = det;
      void [_a, _b, _c, _d, _e];
      const details: Partial<OwnerDetails> = { ...rest, ...(iban.trim() ? { payout_iban: iban } : {}), ...(tin.trim() ? { tax_id: tin } : {}) };
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
        {me.is_host ? (
          <section className={s.panel} aria-labelledby="acc-ready" style={{ marginBottom: 20, background: det.missing.length ? "#fbefdc" : "#e4efe9" }}>
            <h2 id="acc-ready">{h.readyTitle}</h2>
            <p className={s.panelLead}>{h.readyLead}</p>
            {det.missing.length ? (
              <p style={{ margin: 0 }}>
                <strong>{h.stillNeeded}</strong> {det.missing.map((k) => h.missing[k]).join(", ")}
              </p>
            ) : (
              <p style={{ margin: 0, fontWeight: 600 }}>✓ {h.ready}</p>
            )}
          </section>
        ) : null}
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
            {det.account_type === "company" ? (
              <>
                <div className={s.row} style={{ alignItems: "start" }}>
                  <label className={s.field} style={{ flex: 1, minWidth: 200 }}>
                    <span>{h.businessType}</span>
                    <select className={s.input} value={det.business_type} onChange={(e) => set("business_type", e.target.value as OwnerDetails["business_type"])} aria-invalid={!!errors.business_type}>
                      <option value="">–</option>
                      {(Object.keys(h.types) as (keyof typeof h.types)[]).map((k) => (
                        <option key={k} value={k}>
                          {h.types[k]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={s.field} style={{ flex: 1, minWidth: 200 }}>
                    <span>
                      {h.tradingName} <i className={s.hint}>({d.optional})</i>
                    </span>
                    <input className={s.input} value={det.trading_name} maxLength={160} onChange={(e) => set("trading_name", e.target.value)} />
                  </label>
                </div>
                <label className={s.field}>
                  <span>
                    {h.website} <i className={s.hint}>({d.optional})</i>
                  </span>
                  <input className={s.input} value={det.website} maxLength={300} type="url" placeholder="https://" onChange={(e) => set("website", e.target.value)} aria-invalid={!!errors.website} />
                  {err("website")}
                </label>
                <div className={s.group}>
                  <h3>{h.legalRep}</h3>
                  <p className={s.hint} style={{ margin: 0 }}>{h.legalRepLead}</p>
                  <div className={s.row} style={{ alignItems: "start" }}>
                    <label className={s.field} style={{ flex: 2, minWidth: 200 }}>
                      <span>{h.legalRepName}</span>
                      <input className={s.input} value={det.legal_rep_name} maxLength={160} onChange={(e) => set("legal_rep_name", e.target.value)} />
                    </label>
                    <label className={s.field} style={{ flex: 1, minWidth: 140 }}>
                      <span>{h.legalRepRole}</span>
                      <input className={s.input} value={det.legal_rep_role} maxLength={80} onChange={(e) => set("legal_rep_role", e.target.value)} />
                    </label>
                  </div>
                </div>
                <div className={s.group}>
                  <h3>{h.owners}</h3>
                  <p className={s.hint} style={{ margin: 0 }}>{h.ownersLead}</p>
                  {det.beneficial_owners.map((bo, i) => (
                    <div key={i} className={s.row} style={{ alignItems: "end" }}>
                      <label className={s.field} style={{ flex: 2, minWidth: 180 }}>
                        <span>{h.ownerName}</span>
                        <input className={s.input} value={bo.name} maxLength={160} onChange={(e) => set("beneficial_owners", det.beneficial_owners.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                      </label>
                      <label className={s.field} style={{ width: 160 }}>
                        <span>{h.dob}</span>
                        <input className={s.input} type="date" value={bo.date_of_birth} onChange={(e) => set("beneficial_owners", det.beneficial_owners.map((x, j) => (j === i ? { ...x, date_of_birth: e.target.value } : x)))} />
                      </label>
                      <label className={s.field} style={{ width: 100 }}>
                        <span>{h.ownerShare}</span>
                        <input className={s.input} inputMode="decimal" value={bo.share ?? ""} onChange={(e) => set("beneficial_owners", det.beneficial_owners.map((x, j) => (j === i ? { ...x, share: e.target.value === "" ? null : Number(e.target.value.replace(",", ".")) } : x)))} />
                      </label>
                      <button type="button" className={s.ghost} onClick={() => set("beneficial_owners", det.beneficial_owners.filter((_, j) => j !== i))}>
                        {h.removeOwner}
                      </button>
                    </div>
                  ))}
                  {errors.beneficial_owners ? <em className={s.error}>{errors.beneficial_owners}</em> : null}
                  {det.beneficial_owners.length < 10 ? (
                    <div>
                      <button type="button" className={s.button} onClick={() => set("beneficial_owners", [...det.beneficial_owners, { name: "", date_of_birth: "", country: det.address_country || "FI", share: null }])}>
                        + {h.addOwner}
                      </button>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <div className={s.group}>
                  <h3>{h.legal}</h3>
                  <p className={s.hint} style={{ margin: 0 }}>{h.legalLead}</p>
                  <div className={s.row} style={{ alignItems: "start" }}>
                    <label className={s.field} style={{ flex: 1, minWidth: 180 }}>
                      <span>{h.firstName}</span>
                      <input className={s.input} value={det.legal_first_name} maxLength={80} autoComplete="given-name" onChange={(e) => set("legal_first_name", e.target.value)} />
                    </label>
                    <label className={s.field} style={{ flex: 1, minWidth: 180 }}>
                      <span>{h.lastName}</span>
                      <input className={s.input} value={det.legal_last_name} maxLength={80} autoComplete="family-name" onChange={(e) => set("legal_last_name", e.target.value)} />
                    </label>
                    <label className={s.field} style={{ width: 180 }}>
                      <span>{h.dob}</span>
                      <input className={s.input} type="date" value={det.date_of_birth} autoComplete="bday" onChange={(e) => set("date_of_birth", e.target.value)} aria-invalid={!!errors.date_of_birth} />
                      {err("date_of_birth")}
                    </label>
                  </div>
                </div>
                <div className={s.group}>
                  <h3>{h.tax}</h3>
                  <p className={s.hint} style={{ margin: 0 }}>{h.taxLead}</p>
                  <div className={s.row} style={{ alignItems: "start" }}>
                    <label className={s.field} style={{ flex: 2, minWidth: 220 }}>
                      <span>{h.tax}</span>
                      <input
                        className={s.input}
                        value={tin}
                        maxLength={30}
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={det.has_tax_id ? det.tax_id : "131052-308T"}
                        onChange={(e) => (setTin(e.target.value.toUpperCase()), setSaved(false))}
                        aria-invalid={!!errors.tax_id}
                      />
                      {err("tax_id") ?? <small className={s.hint}>{det.has_tax_id ? fill(lang, h.taxSaved, { tin: det.tax_id }) : h.taxSecure}</small>}
                    </label>
                    <label className={s.field} style={{ flex: 1, minWidth: 160 }}>
                      <span>{h.taxCountry}</span>
                      <select className={s.input} value={det.tax_country || det.address_country} onChange={(e) => set("tax_country", e.target.value)}>
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
                <div className={s.group}>
                  <h3>{h.emergency}</h3>
                  <p className={s.hint} style={{ margin: 0 }}>{h.emergencyLead}</p>
                  <div className={s.row} style={{ alignItems: "start" }}>
                    <label className={s.field} style={{ flex: 1, minWidth: 200 }}>
                      <span>{h.emergencyName}</span>
                      <input className={s.input} value={det.emergency_name} maxLength={120} onChange={(e) => set("emergency_name", e.target.value)} />
                    </label>
                    <label className={s.field} style={{ flex: 1, minWidth: 200 }}>
                      <span>{h.emergencyPhone}</span>
                      <input className={s.input} type="tel" value={det.emergency_phone} maxLength={40} onChange={(e) => set("emergency_phone", e.target.value)} aria-invalid={!!errors.emergency_phone} />
                      {err("emergency_phone")}
                    </label>
                  </div>
                </div>
              </>
            )}
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
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={det.postal_same} onChange={(e) => set("postal_same", e.target.checked)} />
                {h.postalSame}
              </label>
              {!det.postal_same ? (
                <>
                  <h3>{h.postal}</h3>
                  <label className={s.field}>
                    <span>{d.street}</span>
                    <input className={s.input} value={det.postal_line} maxLength={200} onChange={(e) => set("postal_line", e.target.value)} />
                  </label>
                  <div className={s.row} style={{ alignItems: "start" }}>
                    <label className={s.field} style={{ width: 140 }}>
                      <span>{d.postal}</span>
                      <input className={s.input} value={det.postal_postal_code} maxLength={20} onChange={(e) => set("postal_postal_code", e.target.value)} />
                    </label>
                    <label className={s.field} style={{ flex: 1, minWidth: 180 }}>
                      <span>{d.city}</span>
                      <input className={s.input} value={det.postal_city} maxLength={100} onChange={(e) => set("postal_city", e.target.value)} />
                    </label>
                    <label className={s.field} style={{ flex: 1, minWidth: 180 }}>
                      <span>{d.country}</span>
                      <select className={s.input} value={det.postal_country} onChange={(e) => set("postal_country", e.target.value)}>
                        <option value="">–</option>
                        {COUNTRIES.map((c) => (
                          <option key={c} value={c}>
                            {countryName(lang, c)}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : null}
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

          <section className={s.panel} aria-labelledby="acc-contact">
            <h2 id="acc-contact">{h.reservations}</h2>
            <p className={s.panelLead}>{h.reservationsLead}</p>
            <div className={s.row} style={{ alignItems: "start" }}>
              {(["name", "email", "phone"] as const).map((k) => (
                <label key={k} className={s.field} style={{ flex: 1, minWidth: 180 }}>
                  <span>{k === "name" ? h.contactName : k === "email" ? h.contactEmail : h.contactPhone}</span>
                  <input
                    className={s.input}
                    type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                    value={det.reservations_contact[k] ?? ""}
                    maxLength={160}
                    onChange={(e) => set("reservations_contact", { ...det.reservations_contact, [k]: e.target.value })}
                  />
                </label>
              ))}
            </div>
            {err("reservations_contact")}
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

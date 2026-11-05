"use client";

// The host's cancellation policy, Airbnb-style: one card per policy with what guests get back,
// the long-stay policy and the non-refundable option.
import type { Lang } from "@/i18n/locales";
import { CANCELLATION } from "@/i18n/messages/cancellation";
import { LONG_POLICIES, type LongPolicy, type Policy, POLICIES } from "@/lib/cancellation";
import s from "./editor.module.css";

type Props = {
  lang: Lang;
  policy: Policy;
  longPolicy: LongPolicy;
  nonRefundable: boolean;
  onChange: (next: { cancellation_policy?: Policy; long_stay_policy?: LongPolicy; non_refundable_option?: boolean }) => void;
};

export default function CancellationPicker({ lang, policy, longPolicy, nonRefundable, onChange }: Props) {
  const t = CANCELLATION[lang];
  return (
    <div className={s.group}>
      <h3 className={s.subhead}>{t.title}</h3>
      <p className={s.hint}>{t.choose}</p>
      <div className={s.policyList} role="radiogroup" aria-label={t.title}>
        {POLICIES.map((p) => (
          <label key={p} className={s.policy} data-on={policy === p}>
            <input type="radio" name="cancellation_policy" value={p} checked={policy === p} onChange={() => onChange({ cancellation_policy: p })} />
            <span className={s.policyText}>
              <strong>{t.names[p]}</strong>
              <span>{t.rules[p]}</span>
              <span className={s.hint}>{t.late[p]}</span>
            </span>
          </label>
        ))}
      </div>
      <p className={s.hint}>{t.window}</p>

      <h4 className={s.subhead}>{t.longTitle}</h4>
      <div className={s.policyList} role="radiogroup" aria-label={t.longTitle}>
        {LONG_POLICIES.map((p) => (
          <label key={p} className={s.policy} data-on={longPolicy === p}>
            <input type="radio" name="long_stay_policy" value={p} checked={longPolicy === p} onChange={() => onChange({ long_stay_policy: p })} />
            <span className={s.policyText}>
              <strong>{t.longNames[p]}</strong>
              <span>{t.longRules[p]}</span>
            </span>
          </label>
        ))}
      </div>

      <label className={s.check}>
        <input type="checkbox" checked={nonRefundable} onChange={(e) => onChange({ non_refundable_option: e.target.checked })} />
        <span>
          {t.nonRefundable}
          <span className={s.hint} style={{ display: "block" }}>
            {t.nonRefundableLead}
          </span>
        </span>
      </label>
      <p className={s.hint}>{t.sites}</p>
    </div>
  );
}

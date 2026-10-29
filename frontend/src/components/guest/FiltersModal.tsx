"use client";

import { useEffect, useRef } from "react";
import { BEDROOM_CHOICES, FEATURE_GROUPS, type FeatureKey } from "@/lib/catalog";
import type { Lang } from "@/lib/content";
import { guestContent } from "@/lib/guestContent";
import styles from "./guest.module.css";

export type FilterState = {
  features: FeatureKey[];
  bedrooms: number[]; // 4 means 4 or more
  rating4: boolean;
};

export const EMPTY_FILTERS: FilterState = { features: [], bedrooms: [], rating4: false };

export function countFilters(f: FilterState) {
  return f.features.length + f.bedrooms.length + (f.rating4 ? 1 : 0);
}

type Props = {
  lang: Lang;
  value: FilterState;
  resultCount: number;
  onChange: (f: FilterState) => void;
  onClose: () => void;
};

export default function FiltersModal({ lang, value, resultCount, onChange, onClose }: Props) {
  const t = guestContent[lang].filterPanel;
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  const toggleFeature = (k: FeatureKey) =>
    onChange({
      ...value,
      features: value.features.includes(k) ? value.features.filter((x) => x !== k) : [...value.features, k],
    });
  const toggleBedrooms = (n: number) =>
    onChange({
      ...value,
      bedrooms: value.bedrooms.includes(n) ? value.bedrooms.filter((x) => x !== n) : [...value.bedrooms, n],
    });

  const groups = FEATURE_GROUPS as unknown as {
    id: string;
    title: Record<Lang, string>;
    options: Record<string, Record<Lang, string>>;
  }[];

  return (
    <div className={styles.modalBackdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={dialog}
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="filters-title"
        tabIndex={-1}
      >
        <header className={styles.modalHeader}>
          <button type="button" className={styles.modalClose} aria-label={t.close} onClick={onClose}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
          <h2 id="filters-title">{t.title}</h2>
        </header>

        <div className={styles.modalBody}>
          {groups.slice(0, 1).map((g) => (
            <FilterSection key={g.id} title={g.title[lang]}>
              {Object.entries(g.options).map(([k, label]) => (
                <Check key={k} label={label[lang]} checked={value.features.includes(k as FeatureKey)} onChange={() => toggleFeature(k as FeatureKey)} />
              ))}
            </FilterSection>
          ))}

          <FilterSection title={t.reviews}>
            <Check label={t.rating4} checked={value.rating4} onChange={() => onChange({ ...value, rating4: !value.rating4 })} />
          </FilterSection>

          <FilterSection title={t.bedrooms}>
            {BEDROOM_CHOICES.map((n) => (
              <Check key={n} label={n === 4 ? "4+" : String(n)} checked={value.bedrooms.includes(n)} onChange={() => toggleBedrooms(n)} />
            ))}
          </FilterSection>

          {groups.slice(1).map((g) => (
            <FilterSection key={g.id} title={g.title[lang]}>
              {Object.entries(g.options).map(([k, label]) => (
                <Check key={k} label={label[lang]} checked={value.features.includes(k as FeatureKey)} onChange={() => toggleFeature(k as FeatureKey)} />
              ))}
            </FilterSection>
          ))}
        </div>

        <footer className={styles.modalFooter}>
          <button type="button" className={styles.textButton} onClick={() => onChange(EMPTY_FILTERS)}>
            {t.clearAll}
          </button>
          <button type="button" className={styles.applyButton} onClick={onClose}>
            {t.show(resultCount)}
          </button>
        </footer>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className={styles.filterSection}>
      <legend>{title}</legend>
      <div className={styles.checkGrid}>{children}</div>
    </fieldset>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={styles.checkItem}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}

"use client";
/* eslint-disable @next/next/no-img-element -- remote Unsplash photos, sized by CSS */

// The cottage page's photos: a large photo with four beside it on wide screens, a swipe
// row on phones, and every photo full size in a viewer (arrow keys, swipe, Esc).
import { useCallback, useEffect, useRef, useState } from "react";
import type { Messages } from "@/i18n";
import { fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { type ListingPhoto, unsplash, unsplashWhole } from "@/lib/listings";
import { ChevronLeft, ChevronRight, Close, GridIcon } from "./icons";
import styles from "./guest.module.css";

export default function DetailGallery({
  lang,
  photos,
  name,
  t,
}: {
  lang: Lang;
  photos: ListingPhoto[];
  name: string;
  t: Messages["guest"]["photos"];
}) {
  const [open, setOpen] = useState<number | null>(null);
  const [at, setAt] = useState(0); // the phone row's photo
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const alt = (p: ListingPhoto) => `${name}: ${t[p.kind]}`;
  const count = (n: number) => fill(lang, t.photoOf, { n: String(n + 1), total: String(photos.length) });

  const show = (i: number, from?: HTMLElement | null) => {
    opener.current = from ?? (document.activeElement as HTMLElement | null);
    setOpen(i);
  };
  const close = useCallback(() => {
    dialog.current?.close();
    setOpen(null);
    opener.current?.focus();
  }, []);
  const step = useCallback((d: number) => setOpen((i) => (i === null ? i : (i + d + photos.length) % photos.length)), [photos.length]);

  useEffect(() => {
    if (open !== null && dialog.current && !dialog.current.open) dialog.current.showModal();
  }, [open]);

  // Swipe in the viewer.
  const touch = useRef<number | null>(null);

  const tiles = photos.slice(0, 5);
  return (
    <>
      <section className={styles.gallery} aria-label={fill(lang, t.gallery, { name })} data-count={tiles.length}>
        {tiles.map((p, i) => (
          <button key={p.id + i} type="button" className={styles.galleryTile} onClick={(e) => show(i, e.currentTarget)} aria-label={`${alt(p)} – ${count(i)}`}>
            <img src={unsplash(p.id, i === 0 ? 1400 : 700, i === 0 ? 940 : 470, p.crop)} alt={`${name} – ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
          </button>
        ))}
        {photos.length > 1 ? (
          <button type="button" className={styles.galleryAll} onClick={(e) => show(0, e.currentTarget)}>
            <GridIcon className={styles.icon16} />
            {fill(lang, t.showAll, { n: String(photos.length) })}
          </button>
        ) : null}
      </section>

      {/* Phones: one photo at a time, swiped, with a count. */}
      <section className={styles.galleryRow} aria-label={fill(lang, t.gallery, { name })}>
        <div
          className={styles.galleryRowTrack}
          onScroll={(e) => {
            const el = e.currentTarget;
            setAt(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1)));
          }}
        >
          {photos.map((p, i) => (
            <button key={p.id + i} type="button" className={styles.galleryRowSlide} onClick={(e) => show(i, e.currentTarget)} aria-label={`${alt(p)} – ${count(i)}`}>
              <img src={unsplash(p.id, 900, 600, p.crop)} alt={`${name} – ${i + 1}`} loading={i === 0 ? "eager" : "lazy"} />
            </button>
          ))}
        </div>
        <span className={styles.galleryCount} aria-hidden="true">
          {at + 1} / {photos.length}
        </span>
      </section>

      {open !== null ? (
        <dialog
          ref={dialog}
          className={styles.viewer}
          aria-label={fill(lang, t.gallery, { name })}
          onCancel={(e) => {
            e.preventDefault();
            close();
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight") step(1);
            if (e.key === "ArrowLeft") step(-1);
          }}
          onTouchStart={(e) => (touch.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0].clientX - touch.current;
            if (Math.abs(dx) > 40) step(dx < 0 ? 1 : -1);
            touch.current = null;
          }}
        >
          <div className={styles.viewerBar}>
            <button type="button" className={styles.viewerClose} onClick={close} autoFocus>
              <Close className={styles.icon20} />
              <span>{t.close}</span>
            </button>
            <span aria-live="polite">{count(open)}</span>
          </div>
          <figure className={styles.viewerFigure}>
            <img key={photos[open].id} src={unsplashWhole(photos[open].id, 2000)} alt={alt(photos[open])} />
            <figcaption>{t[photos[open].kind]}</figcaption>
          </figure>
          {photos.length > 1 ? (
            <>
              <button type="button" className={`${styles.viewerArrow} ${styles.viewerPrev}`} aria-label={t.prev} onClick={() => step(-1)}>
                <ChevronLeft className={styles.icon20} />
              </button>
              <button type="button" className={`${styles.viewerArrow} ${styles.viewerNext}`} aria-label={t.next} onClick={() => step(1)}>
                <ChevronRight className={styles.icon20} />
              </button>
            </>
          ) : null}
          {/* The next photo loads in the background, so moving on is instant. */}
          <img className={styles.viewerPreload} src={unsplashWhole(photos[(open + 1) % photos.length].id, 2000)} alt="" aria-hidden="true" />
        </dialog>
      ) : null}
    </>
  );
}

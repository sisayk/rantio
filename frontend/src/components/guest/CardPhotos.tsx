"use client";
/* eslint-disable @next/next/no-img-element -- remote Unsplash photos, sized by CSS */

// A cottage card's photos: swipe on phones, arrows on hover with a mouse, dots for where
// you are. Only the photo shown and the next one load, so a page of cards stays light.
import { useRef, useState } from "react";
import { type ListingPhoto, unsplash } from "@/lib/listings";
import { ChevronLeft, ChevronRight } from "./icons";
import styles from "./guest.module.css";

export default function CardPhotos({
  photos,
  href,
  name,
  labels,
}: {
  photos: ListingPhoto[];
  href: string;
  name: string;
  labels: { prev: string; next: string };
}) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const [loaded, setLoaded] = useState(1); // photos 0..loaded may have their image

  const go = (step: number) => {
    const el = track.current;
    if (!el) return;
    setLoaded((n) => Math.max(n, at + step + 1));
    el.scrollBy({ left: step * el.clientWidth, behavior: "smooth" });
  };

  return (
    <>
      <div
        ref={track}
        className={styles.cardTrack}
        onScroll={(e) => {
          const el = e.currentTarget;
          const i = Math.round(el.scrollLeft / Math.max(el.clientWidth, 1));
          if (i !== at) setAt(i);
          setLoaded((n) => Math.max(n, i + 1));
        }}
        onPointerDown={() => setLoaded((n) => Math.max(n, at + 1))}
      >
        {photos.map((p, i) => (
          <a key={p.id + i} className={styles.cardSlide} href={href} tabIndex={-1} aria-hidden="true">
            {i <= loaded ? (
              <img src={unsplash(p.id, 720, 420, p.crop)} alt="" loading={i === 0 ? "lazy" : "eager"} width={720} height={420} draggable={false} />
            ) : null}
          </a>
        ))}
      </div>
      {photos.length > 1 ? (
        <>
          {at > 0 ? (
            <button type="button" className={`${styles.cardArrow} ${styles.cardArrowPrev}`} aria-label={`${labels.prev}: ${name}`} onClick={() => go(-1)}>
              <ChevronLeft className={styles.icon16} />
            </button>
          ) : null}
          {at < photos.length - 1 ? (
            <button type="button" className={`${styles.cardArrow} ${styles.cardArrowNext}`} aria-label={`${labels.next}: ${name}`} onClick={() => go(1)}>
              <ChevronRight className={styles.icon16} />
            </button>
          ) : null}
          <span className={styles.cardDots} aria-hidden="true">
            {photos.map((p, i) => (
              <span key={p.id + i} data-on={i === at} />
            ))}
          </span>
        </>
      ) : null}
    </>
  );
}

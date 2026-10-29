"use client";

// The homepage slides from the admin (Website → Homepage slides): photos that stay a few
// seconds and videos that play to their end, cross-fading in order. With no slides the
// hero keeps its built-in photo. Moving pictures stop for people who ask for less motion,
// videos give way to their still when the browser is saving data, and a pause button is
// always there.
import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/i18n";
import { fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import styles from "./guest.module.css";

type Slide = { id: number; kind: "image" | "video"; src: string; poster: string | null; alt: string; focus: string; seconds: number };

const CACHE = "stugora:hero";

function readCache(): Slide[] | null {
  try {
    const v = JSON.parse(localStorage.getItem(CACHE) ?? "null");
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

export default function HeroSlides({ lang, t }: { lang: Lang; t: Messages["guest"]["slides"] }) {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [at, setAt] = useState(0);
  const [shown, setShown] = useState(false); // the first slide has loaded
  const [paused, setPaused] = useState(false);
  const [calm, setCalm] = useState(false); // prefers-reduced-motion
  const [saveData, setSaveData] = useState(false);
  const videos = useRef<Map<number, HTMLVideoElement>>(new Map());

  // Slides from the last visit straight away, then the current list.
  useEffect(() => {
    const first = window.setTimeout(() => {
      const cached = readCache();
      if (cached?.length) setSlides(cached);
      setCalm(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      setSaveData(Boolean((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData));
    }, 0);
    fetch("/api/hero/")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((body: { slides: Slide[] }) => {
        setSlides(body.slides);
        setAt((i) => (i < body.slides.length ? i : 0));
        try {
          localStorage.setItem(CACHE, JSON.stringify(body.slides));
        } catch {
          // storage blocked: the slides load again next time
        }
      })
      .catch(() => undefined);
    return () => window.clearTimeout(first);
  }, []);

  const still = (s: Slide) => s.kind === "video" && (calm || saveData) && s.poster;
  const current = slides[at];
  const moving = !paused && !calm && slides.length > 1;

  // Photos (and videos shown as their still) move on after their seconds.
  useEffect(() => {
    if (!current || !moving || (current.kind === "video" && !still(current))) return;
    const timer = window.setTimeout(() => setAt((i) => (i + 1) % slides.length), current.seconds * 1000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- still() reads calm/saveData, listed
  }, [current, moving, slides.length, calm, saveData]);

  // The current video plays; the others rest at their start.
  useEffect(() => {
    videos.current.forEach((v, id) => {
      if (id === current?.id && !paused && !calm) {
        v.currentTime = 0;
        void v.play().catch(() => undefined);
      } else {
        v.pause();
      }
    });
  }, [current?.id, paused, calm]); // restart only on a new slide

  if (!slides.length) return null;

  const next = () => setAt((i) => (i + 1) % slides.length);

  return (
    <div className={styles.heroMedia} data-shown={shown}>
      {slides.map((s, i) => {
        const on = i === at;
        const near = on || i === (at + 1) % slides.length;
        const style = { objectPosition: s.focus } as React.CSSProperties;
        if (s.kind === "image" || still(s)) {
          return (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded files, any size
            <img
              key={s.id}
              className={styles.heroSlide}
              data-on={on}
              src={s.kind === "image" ? s.src : (s.poster ?? "")}
              alt={on ? s.alt : ""}
              aria-hidden={!on}
              loading={i === 0 ? "eager" : "lazy"}
              style={style}
              onLoad={() => i === 0 && setShown(true)}
            />
          );
        }
        return (
          <video
            key={s.id}
            ref={(el) => {
              if (el) videos.current.set(s.id, el);
              else videos.current.delete(s.id);
            }}
            className={styles.heroSlide}
            data-on={on}
            src={near ? s.src : undefined}
            poster={s.poster ?? undefined}
            muted
            playsInline
            preload={near ? "auto" : "none"}
            loop={slides.length === 1}
            aria-label={s.alt || undefined}
            aria-hidden={!on}
            style={style}
            onLoadedData={() => i === 0 && setShown(true)}
            onEnded={() => on && moving && next()}
          />
        );
      })}
      {slides.length > 1 || slides[0].kind === "video" ? (
        <div className={styles.heroControls}>
          {slides.length > 1
            ? slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className={styles.heroDot}
                  aria-current={i === at ? "true" : undefined}
                  aria-label={fill(lang, t.slide, { n: String(i + 1), total: String(slides.length) })}
                  onClick={() => setAt(i)}
                />
              ))
            : null}
          {!calm ? (
            <button
              type="button"
              className={styles.heroPause}
              aria-label={paused ? t.play : t.pause}
              onClick={() => setPaused((p) => !p)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                {paused ? <path d="M8 5.5v13l10.5-6.5L8 5.5Z" /> : <path d="M7.5 5h3v14h-3zM13.5 5h3v14h-3z" />}
              </svg>
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

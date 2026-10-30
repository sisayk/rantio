"use client";

/* eslint-disable @next/next/no-img-element -- the owner's own uploads, served by Django */
import { useEffect, useRef, useState } from "react";
import type { Messages } from "@/i18n";
import { fill } from "@/i18n/format";
import type { Lang } from "@/i18n/locales";
import { preparePhoto } from "@/lib/imagePrep";
import { type ListingPhoto, ownerApi, type PhotoKind, SignedOut } from "@/lib/ownerApi";
import { ArrowDown, ArrowUp, Dialog, Trash } from "./ui";
import s from "./editor.module.css";

const KINDS: PhotoKind[] = ["exterior", "living", "bedroom", "kitchen", "sauna", "outside"];
export const MAX_PHOTOS = 40;

type Upload = { key: number; name: string; pct: number; stage: "prep" | "send" | "failed"; error?: string };
type L = Messages["listings"];

const errorCode = (err: unknown): string => {
  const body = (err as { body?: { file?: string[] } })?.body;
  const code = body?.file?.[0];
  if (code === "too_big" || code === "not_image" || code === "too_many" || code === "missing") return code;
  if (err instanceof Error && (err.message === "too_big" || err.message === "not_image")) return err.message;
  return "failed";
};

/** The gallery editor. Every change here is saved straight away, so it needs no Save button. */
export default function PhotoManager({
  lang,
  l,
  cottageId,
  photos,
  onChange,
  notify,
  onSignedOut,
}: {
  lang: Lang;
  l: L;
  cottageId: number;
  photos: ListingPhoto[];
  onChange: (photos: ListingPhoto[]) => void;
  notify: (kind: "ok" | "error", text: string) => void;
  onSignedOut: () => void;
}) {
  const p = l.photos;
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [over, setOver] = useState(false);
  const [drag, setDrag] = useState<number | null>(null);
  const [dropOn, setDropOn] = useState<number | null>(null);
  const [removing, setRemoving] = useState<ListingPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [gallery, setGallery] = useState(false);
  const [captions, setCaptions] = useState<Record<number, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<number | null>(null);
  const counter = useRef(0);
  const current = useRef(photos);
  useEffect(() => {
    current.current = photos;
  }, [photos]);
  // Uploads finish one after another before React re-renders; the ref keeps the latest list.
  const commit = (next: ListingPhoto[]) => {
    current.current = next;
    onChange(next);
  };

  const failed = (err: unknown, name: string) => {
    if (err instanceof SignedOut) return onSignedOut();
    notify("error", fill(lang, p.errors[errorCode(err) as keyof L["photos"]["errors"]], { name }));
  };

  const setUpload = (key: number, patch: Partial<Upload>) =>
    setUploads((list) => list.map((u) => (u.key === key ? { ...u, ...patch } : u)));

  async function addFiles(files: File[]) {
    if (!files.length) return;
    const room = MAX_PHOTOS - current.current.length;
    if (room <= 0) return notify("error", p.errors.too_many);
    const take = files.slice(0, room);
    if (files.length > room) notify("error", p.errors.too_many);
    const queue = take.map((f) => ({ key: ++counter.current, name: f.name, pct: 0, stage: "prep" as const }));
    setUploads((list) => [...list, ...queue]);
    // One at a time: phones on a slow connection finish each photo instead of stalling all of them.
    for (let i = 0; i < take.length; i++) {
      const { key, name } = queue[i];
      try {
        const ready = await preparePhoto(take[i]);
        setUpload(key, { stage: "send" });
        const kind: PhotoKind = current.current.length === 0 ? "exterior" : "living";
        const photo = await ownerApi.addPhoto(cottageId, ready.blob, ready.name, kind, (pct) => setUpload(key, { pct }));
        commit([...current.current, photo]);
        setUploads((list) => list.filter((u) => u.key !== key));
      } catch (err) {
        if (err instanceof SignedOut) return onSignedOut();
        const code = errorCode(err);
        setUpload(key, { stage: "failed", error: fill(lang, p.errors[code as keyof L["photos"]["errors"]], { name }) });
      }
    }
  }

  async function saveOrder(next: ListingPhoto[]) {
    const before = current.current;
    commit(next);
    try {
      const res = await ownerApi.orderPhotos(cottageId, next.map((x) => x.id));
      commit(res.photos);
    } catch (err) {
      commit(before);
      failed(err, "");
    }
  }

  const move = (from: number, to: number) => {
    if (to < 0 || to >= photos.length || from === to) return;
    const next = [...photos];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    void saveOrder(next);
  };

  async function update(photo: ListingPhoto, fields: { kind?: PhotoKind; caption?: string }) {
    try {
      const saved = await ownerApi.updatePhoto(cottageId, photo.id, fields);
      commit(current.current.map((x) => (x.id === saved.id ? saved : x)));
      notify("ok", l.saved);
    } catch (err) {
      failed(err, "");
    }
  }

  async function replace(file: File | undefined) {
    const id = replacing.current;
    replacing.current = null;
    if (!file || id === null) return;
    const key = ++counter.current;
    setUploads((list) => [...list, { key, name: file.name, pct: 0, stage: "prep" }]);
    try {
      const ready = await preparePhoto(file);
      setUpload(key, { stage: "send" });
      const saved = await ownerApi.replacePhoto(cottageId, id, ready.blob, ready.name, (pct) => setUpload(key, { pct }));
      // The new file has a new address; a cache-busting query isn't needed.
      commit(current.current.map((x) => (x.id === saved.id ? saved : x)));
      setUploads((list) => list.filter((u) => u.key !== key));
      notify("ok", l.saved);
    } catch (err) {
      if (err instanceof SignedOut) return onSignedOut();
      setUpload(key, { stage: "failed", error: fill(lang, p.errors[errorCode(err) as keyof L["photos"]["errors"]], { name: file.name }) });
    }
  }

  async function remove() {
    const photo = removing;
    if (!photo) return;
    setBusy(true);
    try {
      await ownerApi.removePhoto(cottageId, photo.id);
      commit(current.current.filter((x) => x.id !== photo.id));
      setRemoving(null);
      notify("ok", l.saved);
    } catch (err) {
      failed(err, "");
    } finally {
      setBusy(false);
    }
  }

  const full = photos.length >= MAX_PHOTOS;

  return (
    <div className={s.group} style={{ borderTop: 0, paddingTop: 0 }}>
      <div
        className={s.dropZone}
        data-over={over}
        onDragOver={(e) => {
          if (drag !== null || !e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          if (drag !== null) return;
          e.preventDefault();
          setOver(false);
          void addFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <strong>{p.drop}</strong>
        <div className={s.row} style={{ justifyContent: "center" }}>
          <button type="button" className={s.button} disabled={full} onClick={() => fileInput.current?.click()}>
            {p.add}
          </button>
          <button type="button" className={s.ghost} disabled={full} onClick={() => cameraInput.current?.click()}>
            {p.camera}
          </button>
        </div>
        <span className={s.hint}>
          {p.hint} {fill(lang, p.count, { n: photos.length, max: MAX_PHOTOS })}
        </span>
        <input
          ref={fileInput}
          className={s.visuallyHidden}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          tabIndex={-1}
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={cameraInput}
          className={s.visuallyHidden}
          type="file"
          accept="image/*"
          capture="environment"
          tabIndex={-1}
          onChange={(e) => {
            void addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <input
          ref={replaceInput}
          className={s.visuallyHidden}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          tabIndex={-1}
          onChange={(e) => {
            void replace(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
      </div>

      {uploads.length ? (
        <ul className={s.uploads} aria-live="polite">
          {uploads.map((u) => (
            <li key={u.key} data-failed={u.stage === "failed"}>
              {u.stage === "failed" ? (
                <span className={s.row}>
                  {u.error}
                  <button type="button" className={s.ghost} onClick={() => setUploads((list) => list.filter((x) => x.key !== u.key))}>
                    {l.cancel}
                  </button>
                </span>
              ) : (
                <>
                  <span>{u.stage === "prep" ? fill(lang, p.preparing, { name: u.name }) : fill(lang, p.uploading, { name: u.name, pct: u.pct })}</span>
                  <span className={s.progressBar}>
                    <span style={{ width: `${u.stage === "prep" ? 4 : u.pct}%` }} />
                  </span>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {photos.length === 0 ? (
        <p className={s.muted}>{p.empty}</p>
      ) : (
        <>
          <div className={s.row}>
            <button type="button" className={s.button} onClick={() => setGallery(true)}>
              {p.previewGallery}
            </button>
          </div>
          <ul className={s.photoGrid}>
            {photos.map((photo, i) => (
              <li
                key={photo.id}
                className={s.photo}
                draggable
                data-dragging={drag === i}
                data-over={dropOn === i && drag !== null && drag !== i}
                onDragStart={(e) => {
                  setDrag(i);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  if (drag === null) return;
                  e.preventDefault();
                  setDropOn(i);
                }}
                onDrop={(e) => {
                  if (drag === null) return;
                  e.preventDefault();
                  move(drag, i);
                  setDrag(null);
                  setDropOn(null);
                }}
                onDragEnd={() => {
                  setDrag(null);
                  setDropOn(null);
                }}
              >
                <div className={s.photoImg}>
                  <img src={photo.url} alt={photo.caption || p.kinds[photo.kind]} loading="lazy" draggable={false} />
                  {i === 0 ? <span className={s.coverTag}>{p.cover}</span> : null}
                </div>
                <label className={s.field}>
                  <span className={s.visuallyHidden}>{p.room}</span>
                  <select
                    className={s.select}
                    value={photo.kind}
                    aria-label={`${p.room} (${i + 1})`}
                    onChange={(e) => void update(photo, { kind: e.target.value as PhotoKind })}
                  >
                    {KINDS.map((k) => (
                      <option key={k} value={k}>
                        {p.kinds[k]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={s.field}>
                  <span className={s.visuallyHidden}>{p.caption}</span>
                  <input
                    className={s.input}
                    maxLength={200}
                    placeholder={p.captionPlaceholder}
                    aria-label={`${p.caption} (${i + 1})`}
                    value={captions[photo.id] ?? photo.caption}
                    onChange={(e) => setCaptions((c) => ({ ...c, [photo.id]: e.target.value }))}
                    onBlur={() => {
                      const next = captions[photo.id];
                      if (next !== undefined && next.trim() !== photo.caption) void update(photo, { caption: next.trim() });
                      setCaptions((c) => {
                        const rest = { ...c };
                        delete rest[photo.id];
                        return rest;
                      });
                    }}
                  />
                </label>
                <div className={s.photoTools}>
                  <button type="button" className={s.iconBtn} aria-label={`${p.earlier} (${i + 1})`} disabled={i === 0} onClick={() => move(i, i - 1)}>
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    className={s.iconBtn}
                    aria-label={`${p.later} (${i + 1})`}
                    disabled={i === photos.length - 1}
                    onClick={() => move(i, i + 1)}
                  >
                    <ArrowDown />
                  </button>
                  {i > 0 ? (
                    <button type="button" className={s.ghost} onClick={() => move(i, 0)}>
                      {p.makeCover}
                    </button>
                  ) : null}
                  <span className={s.spacer} />
                  <button
                    type="button"
                    className={s.ghost}
                    onClick={() => {
                      replacing.current = photo.id;
                      replaceInput.current?.click();
                    }}
                  >
                    {p.replace}
                  </button>
                  <button type="button" className={s.iconBtn} aria-label={`${p.remove} (${i + 1})`} onClick={() => setRemoving(photo)}>
                    <Trash />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={Boolean(removing)} title={p.removeTitle} onClose={() => setRemoving(null)}>
        {removing ? <img src={removing.url} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 12 }} /> : null}
        <p>{p.removeBody}</p>
        <div className={s.dialogActions}>
          <button type="button" className={s.button} onClick={() => setRemoving(null)}>
            {l.cancel}
          </button>
          <button type="button" className={s.dangerSolid} disabled={busy} onClick={() => void remove()}>
            {p.remove}
          </button>
        </div>
      </Dialog>

      <Dialog open={gallery} title={p.previewGallery} onClose={() => setGallery(false)}>
        <div className={s.lightbox} style={{ maxHeight: "70vh", overflowY: "auto" }}>
          {photos.map((photo) => (
            <figure key={photo.id}>
              <img src={photo.url} alt={photo.caption || p.kinds[photo.kind]} loading="lazy" />
              <figcaption>
                {p.kinds[photo.kind]}
                {photo.caption ? ` · ${photo.caption}` : ""}
              </figcaption>
            </figure>
          ))}
        </div>
        <div className={s.dialogActions}>
          <button type="button" className={s.button} onClick={() => setGallery(false)}>
            {l.preview.close}
          </button>
        </div>
      </Dialog>
    </div>
  );
}

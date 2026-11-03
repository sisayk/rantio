"use client";
/* eslint-disable @next/next/no-img-element -- remote Unsplash photos in popups */

import { AdvancedMarker, InfoWindow, Map, MapControl, ControlPosition, useAdvancedMarkerRef, useMap } from "@vis.gl/react-google-maps";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { paths } from "@/i18n/paths";
import { type Camera3D, cameraOf, fitWithin, GoogleMaps, GrabMap, PLAIN, toBounds } from "@/lib/googleMaps";
import type { Listing } from "@/lib/listings";
import { listingName, unsplash } from "@/lib/listings";
import type { CottageMapProps, MapFocus } from "./CottageMapLeaflet";
import styles from "./guest.module.css";

const Map3DView = dynamic(() => import("@/lib/Map3DView"), {
  ssr: false,
  loading: () => <div className={styles.mapLoading} />,
});

function FitTo({ focus }: { focus: MapFocus }) {
  const map = useMap();
  const key = JSON.stringify(focus);
  useEffect(() => {
    if (!map) return;
    return fitWithin(map, toBounds(focus.bounds), 36, focus.maxZoom);
    // `key` captures every change to the focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/** If the flat map can't be read: the middle of the focus, from high enough to see it all. */
function fallbackCamera(focus: MapFocus): Camera3D {
  const b = toBounds(focus.bounds);
  const lat = (b.north + b.south) / 2;
  return { lat, lng: (b.east + b.west) / 2, range: Math.max(5_000, (b.north - b.south) * 111_000 * 1.6) };
}

function PricePin(props: {
  listing: Listing;
  text: string;
  /** The small card shown while the mouse is on the pin: photo, name, price. */
  peek: ReactNode;
  active: boolean;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  onHover: (id: string | null) => void;
  children: ReactNode;
}) {
  const { listing: l } = props;
  const [ref, marker] = useAdvancedMarkerRef();
  const [hover, setHover] = useState(false);
  return (
    <>
      <AdvancedMarker
        ref={ref}
        position={{ lat: l.lat, lng: l.lng }}
        zIndex={hover || props.open ? 2000 : props.active ? 1000 : 1}
        anchorLeft="-50%"
        anchorTop="-50%"
        onClick={props.onOpen}
        onMouseEnter={() => {
          setHover(true);
          props.onHover(l.id);
        }}
        onMouseLeave={() => {
          setHover(false);
          props.onHover(null);
        }}
      >
        <span className="stugora-pin-box">
          {hover && !props.open ? (
            <span className="stugora-peek" aria-hidden="true">
              {props.peek}
            </span>
          ) : null}
          <span className={`stugora-pin${props.active ? " is-active" : ""}`}>{props.text}</span>
        </span>
      </AdvancedMarker>
      {props.open && marker ? (
        <InfoWindow anchor={marker} headerDisabled onClose={props.onClose} className={styles.mapPopup}>
          {props.children}
        </InfoWindow>
      ) : null}
    </>
  );
}

export default function CottageMapGoogle(props: CottageMapProps) {
  const { listings, focus, cities, selectedCity, activeId, lang, names } = props;
  const [open, setOpen] = useState<string | null>(null);
  // The 3D view's starting camera: exactly what the flat map showed when the button was pressed.
  const [threeD, setThreeD] = useState<Camera3D | null>(null);
  const flatRef = useRef<google.maps.Map | null>(null);
  const toggle = (
    <button
      type="button"
      className={styles.map3dToggle}
      aria-pressed={Boolean(threeD)}
      onClick={() => setThreeD(threeD ? null : ((flatRef.current && cameraOf(flatRef.current)) ?? fallbackCamera(focus)))}
    >
      {threeD ? (props.show2d ?? "2D") : (props.show3d ?? "3D")}
    </button>
  );

  if (threeD) {
    return (
      <GoogleMaps>
        <div className={styles.mapWrap}>
          <Map3DView
            className={styles.map}
            label={props.label}
            lat={threeD.lat}
            lng={threeD.lng}
            range={threeD.range}
            pins={listings.map((l) => ({
              key: l.id,
              lat: l.lat,
              lng: l.lng,
              label: props.pinPrice(l), // the name comes up when pointing at it
              title: `${listingName(names, l)} · ${props.price(l)}`,
              onClick: () => window.location.assign(paths.cottage(lang, l.id)),
            }))}
          />
          {toggle}
        </div>
      </GoogleMaps>
    );
  }

  return (
    <GoogleMaps>
      <div className={styles.mapWrap}>
        <Map
          {...PLAIN}
          className={styles.map}
          defaultBounds={{ ...toBounds(focus.bounds), padding: 36 }}
          gestureHandling="greedy"
          onClick={() => setOpen(null)}
          aria-label={props.label}
        >
          <FitTo focus={focus} />
          <GrabMap mapRef={flatRef} />

          {cities.map((c) => {
            const on = c.name === selectedCity;
            return (
              <AdvancedMarker
                key={c.name}
                position={{ lat: c.lat, lng: c.lng }}
                anchorLeft="-50%"
                anchorTop="-50%"
                zIndex={on ? 500 : 0}
                title={c.name}
                onClick={() => props.onCity(c.name)}
              >
                <span className={`stugora-city${on ? " is-on" : ""}`}>
                  <i aria-hidden="true" />
                  <b>{c.name}</b>
                </span>
              </AdvancedMarker>
            );
          })}

          {listings.map((l) => (
            <PricePin
              key={l.id}
              listing={l}
              text={props.pinPrice(l)}
              active={l.id === activeId}
              open={open === l.id}
              onOpen={() => setOpen(l.id)}
              onClose={() => setOpen((cur) => (cur === l.id ? null : cur))}
              onHover={props.onHover}
              peek={
                <>
                  <img src={unsplash(l.photo, 400, 260, l.photoCrop)} alt="" width={200} height={130} />
                  <b>{listingName(names, l)}</b>
                  <i>{props.placeLabel(l)}</i>
                  <span>
                    <b>{props.price(l)}</b> {props.nightLabel}
                  </span>
                </>
              }
            >
              <a className={`${styles.popupCard} ${styles.popupLink}`} href={paths.cottage(lang, l.id)}>
                <img src={unsplash(l.photo, 480, 300, l.photoCrop)} alt="" width={240} height={150} />
                <div className={styles.popupBody}>
                  <strong>{listingName(names, l)}</strong>
                  <span>{props.placeLabel(l)}</span>
                  <span>
                    <b>{props.price(l)}</b> {props.nightLabel}
                  </span>
                </div>
              </a>
            </PricePin>
          ))}

          <MapControl position={ControlPosition.BOTTOM_LEFT}>
            <span className={styles.mapCredit}>
              Places: <a href="https://www.geonames.org/">GeoNames</a>
            </span>
          </MapControl>
        </Map>
        {toggle}
      </div>
    </GoogleMaps>
  );
}

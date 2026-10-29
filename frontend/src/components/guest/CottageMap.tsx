"use client";
/* eslint-disable @next/next/no-img-element -- remote Unsplash photos in popups */

import "leaflet/dist/leaflet.css";
import L, { type LatLngBoundsExpression } from "leaflet";
import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { Listing } from "@/lib/listings";
import type { Lang } from "@/i18n/locales";
import { paths } from "@/i18n/paths";
import { listingName, unsplash } from "@/lib/listings";
import type { City } from "@/lib/places";
import styles from "./guest.module.css";

export type MapFocus = { bounds: [[number, number], [number, number]]; maxZoom: number };

type Props = {
  listings: Listing[];
  focus: MapFocus;
  cities: City[]; // towns of the selected region, drawn as dots
  selectedCity: string;
  activeId: string | null;
  lang: Lang;
  names: Record<string, string>;
  label: string;
  placeLabel: (l: Listing) => string;
  price: (n: number) => string;
  nightLabel: string;
  onHover: (id: string | null) => void;
  onCity: (name: string) => void;
};

function FitTo({ focus }: { focus: MapFocus }) {
  const map = useMap();
  const key = JSON.stringify(focus);
  useEffect(() => {
    map.flyToBounds(focus.bounds as LatLngBoundsExpression, {
      padding: [36, 36],
      maxZoom: focus.maxZoom,
      duration: 0.6,
    });
    // `key` captures every change to the focus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

function pin(text: string, active: boolean) {
  return L.divIcon({
    className: "stugora-pin-wrap",
    html: `<span class="stugora-pin${active ? " is-active" : ""}">${text}</span>`,
    iconSize: undefined,
    iconAnchor: [28, 16],
  });
}

export default function CottageMap(props: Props) {
  const { listings, focus, cities, selectedCity, activeId, lang, names } = props;
  const icons = useMemo(
    () => new Map(listings.map((l) => [l.id, pin(props.price(l.price), l.id === activeId)])),
    // icons depend only on the listing, its price text and whether it is active
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [listings, activeId],
  );

  return (
    <MapContainer
      className={styles.map}
      bounds={focus.bounds}
      boundsOptions={{ padding: [36, 36], maxZoom: focus.maxZoom }}
      scrollWheelZoom
      aria-label={props.label}
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Places: <a href="https://www.geonames.org/">GeoNames</a>'
        maxZoom={18}
      />
      <FitTo focus={focus} />

      {cities.map((c) => {
        const on = c.name === selectedCity;
        return (
          <CircleMarker
            key={c.name}
            center={[c.lat, c.lng]}
            radius={on ? 7 : 5}
            pathOptions={{
              color: "#1d4c3c",
              weight: on ? 3 : 1.5,
              fillColor: on ? "#1d4c3c" : "#ffffff",
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => props.onCity(c.name) }}
          >
            <Tooltip direction="top" offset={[0, -6]} permanent={on}>
              {c.name}
            </Tooltip>
          </CircleMarker>
        );
      })}

      {listings.map((l) => (
        <Marker
          key={l.id}
          position={[l.lat, l.lng]}
          icon={icons.get(l.id)}
          zIndexOffset={l.id === activeId ? 1000 : 0}
          eventHandlers={{
            mouseover: () => props.onHover(l.id),
            mouseout: () => props.onHover(null),
          }}
        >
          <Popup className="stugora-popup" closeButton={false} offset={[0, -8]}>
            <a className={`${styles.popupCard} ${styles.popupLink}`} href={paths.cottage(lang, l.id)}>
              <img src={unsplash(l.photo, 480, 300, l.photoCrop)} alt="" width={240} height={150} />
              <div className={styles.popupBody}>
                <strong>{listingName(names, l)}</strong>
                <span>{props.placeLabel(l)}</span>
                <span>
                  <b>{props.price(l.price)}</b> {props.nightLabel}
                </span>
              </div>
            </a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

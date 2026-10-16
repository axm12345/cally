"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { usePreferences } from "./preferences";

export type MapPoint = { lat: number; lon: number };
const ASOK: MapPoint = { lat: 13.7373, lon: 100.5602 };

export default function LocationMap({ onConfirm, saving, radiusKm = 5 }: { onConfirm: (point: MapPoint) => void; saving: boolean; radiusKm?: number }) {
  const { t } = usePreferences();
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  useEffect(() => { circleRef.current?.setRadius(radiusKm * 1000); }, [radiusKm]);
  const [point, setPoint] = useState<MapPoint | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container.current) return;
    let initial = ASOK;
    try {
      const saved = JSON.parse(localStorage.getItem("cally-map-point") || "null");
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lon) && Math.abs(saved.lat) <= 90 && Math.abs(saved.lon) <= 180) initial = saved;
    } catch {}
    const map = L.map(container.current, { scrollWheelZoom: false }).setView([initial.lat, initial.lon], 15);
    mapRef.current = map;
    let loaded = false;
    const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>', maxZoom: 19 }).addTo(map);
    tiles.on("tileload", () => { loaded = true; setFailed(false); });
    tiles.on("tileerror", () => { if (!loaded) setFailed(true); });
    const icon = L.divIcon({ className: "location-map-pin", html: '<svg width="30" height="38" viewBox="0 0 30 38" aria-hidden="true"><path d="M15 36S2 22 2 15a13 13 0 1 1 26 0c0 7-13 21-13 21Z" fill="#7950d6" stroke="white" stroke-width="2"/><circle cx="15" cy="15" r="4" fill="white"/></svg>', iconSize: [30, 38], iconAnchor: [15, 37] });
    const marker = L.marker([initial.lat, initial.lon], { icon, draggable: true, autoPan: true, title: "Drag location pin", keyboard: true }).addTo(map);
    markerRef.current = marker;
    circleRef.current = L.circle([initial.lat, initial.lon], { radius: radiusKm * 1000, color: "#7950d6", weight: 1.5, dashArray: "5 5", fillOpacity: .06, interactive: false }).addTo(map);
    const select = (position: L.LatLng) => {
      const next = { lat: Math.max(-85, Math.min(85, position.lat)), lon: ((position.lng + 180) % 360 + 360) % 360 - 180 };
      marker.setLatLng([next.lat, next.lon]);
      circleRef.current?.setLatLng([next.lat, next.lon]);
      setPoint(next);
    };
    marker.on("dragend", () => select(marker.getLatLng()));
    map.on("click", event => select(event.latlng));
    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(container.current);
    return () => { resize.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  return <div className="location-map-panel">
    <p className="map-hint">{t("Tap the map or drag the pin to choose a location.")}</p>
    <div ref={container} className="location-map" role="region" aria-label={t("Choose a point on the map")} />
    {failed && <p className="sheet-note" role="status">{t("Map unavailable. You can still type an area below.")}</p>}
    <div className="map-actions">
      <button type="button" className="btn-text" disabled={saving} onClick={() => {
        const center = mapRef.current?.getCenter();
        if (!center) return;
        const next = { lat: center.lat, lon: ((center.lng + 180) % 360 + 360) % 360 - 180 };
        markerRef.current?.setLatLng([next.lat, next.lon]); circleRef.current?.setLatLng([next.lat, next.lon]); setPoint(next);
      }}>{t("Pin map center")}</button>
      <button type="button" className="btn btn-primary sm" disabled={!point || saving} onClick={() => {
        if (point) onConfirm(point);
      }}>{saving ? "…" : t("Use this location")}</button>
    </div>
  </div>;
}

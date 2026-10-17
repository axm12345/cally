import { NextResponse } from "next/server";
export const runtime = "nodejs";

// Listings only. Intentionally requests no phone numbers and has no telephony dependency.
export async function POST(req: Request) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return NextResponse.json({ error: "Shop discovery is not configured." }, { status: 503 });
  try {
    const body = await req.json();
    const clean = (value: unknown, max = 120) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const near = clean(body.near);
    if (!near) return NextResponse.json({ error: "Choose an area first." }, { status: 400 });
    const device = clean(body.device, 80);
    const fix = clean(body.fix, 100);
    const radiusKm = body.radiusKm === undefined ? 5 : body.radiusKm;
    if (!Number.isInteger(radiusKm) || radiusKm < 1 || radiusKm > 20) return NextResponse.json({ error: "Radius must be between 1 and 20 km." }, { status: 400 });
    let lat = body.coordinates?.lat, lon = body.coordinates?.lon;
    let hasPoint = typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180;
    if (!hasPoint) {
      // Cally only covers Thailand; without this, an area like "Siam" can resolve to Italy.
      const geo = await fetch("https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=th&q=" + encodeURIComponent(near), { headers: { "user-agent": "Cally location picker (https://cally-v1-2.vercel.app)" }, signal: AbortSignal.timeout(6000) });
      // place_rank < 13 is a country or province (e.g. "Siam" = Thailand), too broad for a radius search.
      if (geo.ok) { const locations = await geo.json(); lat = Number(locations[0]?.lat); lon = Number(locations[0]?.lon); hasPoint = Number(locations[0]?.place_rank) >= 13 && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180; }
      if (!hasPoint) return NextResponse.json({ error: "Choose a point on the map to apply your search radius." }, { status: 400 });
    }
    // Text Search only restricts to a rectangle, so ask for the box around the radius
    // circle (a bias alone can return far-away shops) and trim to the circle below.
    const latSpan = radiusKm / 111.32, lonSpan = radiusKm / (111.32 * Math.max(0.01, Math.cos(lat * Math.PI / 180)));
    const bounds = {
      low: { latitude: Math.max(-90, lat - latSpan), longitude: Math.max(-180, lon - lonSpan) },
      high: { latitude: Math.min(90, lat + latSpan), longitude: Math.min(180, lon + lonSpan) },
    };
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", signal: AbortSignal.timeout(12000),
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.googleMapsUri" },
      body: JSON.stringify({ textQuery: `${device && device !== "Not mentioned" ? device : "electronics"} repair ${fix} near ${near}`, pageSize: 20, languageCode: "en", locationRestriction: { rectangle: bounds } }),
    });
    if (!response.ok) return NextResponse.json({ error: "Couldn't load nearby shop listings. Try another area." }, { status: 502 });
    const data = await response.json();
    const distance = (a: number, b: number) => {
      const rad = Math.PI / 180;
      const v = Math.sin((a - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a * rad) * Math.sin((b - lon) * rad / 2) ** 2;
      return 6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v)));
    };
    type Place = { displayName: { text: string }; formattedAddress?: string; googleMapsUri?: string; location: { latitude: number; longitude: number } };
    // Shops without a location can't be checked against the radius, so they're excluded.
    const located = (Array.isArray(data.places) ? data.places : []).filter((p: Partial<Place>) => p.displayName?.text && p.location) as Place[];
    const measured = located.map((p) => ({ p, km: distance(p.location.latitude, p.location.longitude) }));
    const shops = measured.filter(({ km }) => km <= radiusKm).sort((a, b) => a.km - b.km).slice(0, 5).map(({ p, km }) => ({
      shop_name: p.displayName.text, phone: "", distance_km: Math.round(km * 10) / 10,
      address: p.formattedAddress ?? "", source_url: p.googleMapsUri ?? "", simulated: true,
    }));
    return NextResponse.json({ shops, radiusKm, center: { lat, lon }, attribution: "Google Maps", simulated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Couldn't load nearby shops. Please try again." }, { status: 502 }); }
}

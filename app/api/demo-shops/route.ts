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
    const lat = body.coordinates?.lat, lon = body.coordinates?.lon;
    const hasPoint = typeof lat === "number" && typeof lon === "number" && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 85 && Math.abs(lon) <= 180;
    const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST", signal: AbortSignal.timeout(12000),
      headers: { "content-type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location,places.googleMapsUri" },
      body: JSON.stringify({ textQuery: `${device && device !== "Not mentioned" ? device : "electronics"} repair ${fix} near ${near}`, pageSize: 5, languageCode: "en", ...(hasPoint ? { locationBias: { circle: { center: { latitude: lat, longitude: lon }, radius: 5000 } } } : {}) }),
    });
    if (!response.ok) return NextResponse.json({ error: "Couldn't load nearby shop listings. Try another area." }, { status: 502 });
    const data = await response.json();
    const distance = (a: number, b: number) => {
      const rad = Math.PI / 180;
      const v = Math.sin((a - lat) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(a * rad) * Math.sin((b - lon) * rad / 2) ** 2;
      return Math.round(6371 * 2 * Math.atan2(Math.sqrt(v), Math.sqrt(Math.max(0, 1 - v))) * 10) / 10;
    };
    const shops = (Array.isArray(data.places) ? data.places : []).filter((p: { displayName?: { text?: string } }) => p.displayName?.text).slice(0, 5).map((p: { displayName: { text: string }; formattedAddress?: string; googleMapsUri?: string; location?: { latitude: number; longitude: number } }) => ({
      shop_name: p.displayName.text, phone: "", distance_km: hasPoint && p.location ? distance(p.location.latitude, p.location.longitude) : null,
      address: p.formattedAddress ?? "", source_url: p.googleMapsUri ?? "", simulated: true,
    }));
    return NextResponse.json({ shops, attribution: "Google Maps", simulated: true }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Couldn't load nearby shops. Please try again." }, { status: 502 }); }
}

import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { priceBundle, type PaymentMethod } from "../payment-pricing";

type Order = { id: string; credits: number; method: PaymentMethod; amount: number; status: string; created: number; qrVariant: number | null };
type State = { balance: number; qrSequence: number; orders: Order[]; reservations: { id: string; created: number }[] };

// Portable DEMO state only: signed HttpOnly cookie, never real purchased credits.
// No cross-device ledger or concurrent-spending guarantees. Real billing needs a database.
export async function hostedDemoWallet(body?: Record<string, unknown>) {
  const secret = process.env.CALLY_DEMO_COOKIE_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "Hosted demo credits are not configured." }, { status: 503 });
  const sign = (value: string) => createHmac("sha256", secret).update(value).digest("base64url");
  const jar = await cookies();
  let state: State = { balance: 3, qrSequence: 0, orders: [], reservations: [] };
  const cookie = jar.get("cally-hosted-demo")?.value;
  if (cookie) {
    try {
      const [payload, signature] = cookie.split(".");
      const expected = sign(payload);
      if (signature?.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
        const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
        if (Number.isInteger(decoded.balance) && decoded.balance >= 0 && Array.isArray(decoded.orders) && Array.isArray(decoded.reservations)) state = decoded;
      }
    } catch { /* Invalid demo cookie starts a new free demo. */ }
  }
  const now = Date.now();
  for (const order of state.orders) if (order.status === "pending" && now - order.created > 600000) order.status = "expired";
  const expired = state.reservations.filter(r => now - r.created > 600000);
  state.balance += expired.length;
  state.reservations = state.reservations.filter(r => now - r.created <= 600000);
  let extra: Record<string, unknown> = {};
  if (body) {
    if (body.mode === "live") return NextResponse.json({ error: "Live payments are not connected." }, { status: 503 });
    if (body.action === "order") {
      const price = priceBundle(body.credits as number, body.method as PaymentMethod);
      const qrVariant = price.method === "promptpay" ? state.qrSequence++ % 2 : null;
      const order: Order = { id: randomUUID(), credits: price.credits, method: price.method, amount: price.totalSatang, status: "pending", created: now, qrVariant };
      state.orders.unshift(order);
      state.orders = state.orders.slice(0, 5);
      extra = { ...order, ...price, expiresAt: now + 600000 };
    } else if (body.action === "resolve") {
      if (typeof body.approve !== "boolean") throw new Error("Invalid approval.");
      const order = state.orders.find(o => o.id === body.id);
      if (!order) throw new Error("Demo order expired. Please start a new checkout.");
      if (order.status === "pending") {
        order.status = body.approve ? "demo_paid" : "failed";
        if (body.approve) state.balance += order.credits;
      }
      extra.status = order.status;
    } else if (body.action === "reserve") {
      if (state.balance < 1) throw new Error("No demo credits left. Open search credits to add more.");
      if (state.reservations.length >= 5) throw new Error("Finish an existing demo search first.");
      const id = randomUUID(); state.balance--; state.reservations.push({ id, created: now }); extra.reservationId = id;
    } else if (body.action === "release") {
      const found = state.reservations.some(r => r.id === body.id);
      if (found) { state.reservations = state.reservations.filter(r => r.id !== body.id); state.balance++; }
    } else throw new Error("Invalid action.");
  }
  const payload = Buffer.from(JSON.stringify(state)).toString("base64url");
  jar.set("cally-hosted-demo", `${payload}.${sign(payload)}`, { httpOnly: true, sameSite: "strict", secure: true, path: "/", maxAge: 86400 * 7 });
  return NextResponse.json({ mode: "demo", storage: "signed_demo_cookie", balance: state.balance, reserved: state.reservations.length, orders: state.orders, ...extra }, { headers: { "Cache-Control": "no-store" } });
}

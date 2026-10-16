import { hostedDemoWallet } from "@/lib/server/hosted-demo-wallet";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { accountExists, newAccount, wallet, createOrder, resolveOrder, reserveSearch, finishSearch } from "@/lib/server/demo-payments";
import type { PaymentMethod } from "@/lib/payment-pricing";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
async function account() {
  const jar = await cookies();
  const existing = jar.get("cally-demo-wallet")?.value;
  if (existing && accountExists(existing)) return existing;
  const id = newAccount();
  jar.set("cally-demo-wallet", id, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" && process.env.CALLY_COOKIE_SECURE === "true", path: "/", maxAge: 86400 * 30 });
  return id;
}
export async function GET() { if (process.env.VERCEL) return hostedDemoWallet(); return NextResponse.json(wallet(await account()), { headers: { "Cache-Control": "no-store" } }); }
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && new URL(origin).host !== req.headers.get("host")) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const body = await req.json();
    if (process.env.VERCEL) return await hostedDemoWallet(body);
    const a = await account();
    if (body.mode === "live") return NextResponse.json({ error: "Live payments are not connected. Official U-topia verification is required." }, { status: 503 });
    if (body.action === "order") return NextResponse.json(createOrder(a, body.credits, body.method as PaymentMethod));
    if (body.action === "resolve" && typeof body.id === "string" && typeof body.approve === "boolean") {
      const status = resolveOrder(a, body.id, body.approve);
      return NextResponse.json({ ...wallet(a), status });
    }
    if (body.action === "reserve") return NextResponse.json({ reservationId: reserveSearch(a), ...wallet(a) });
    if (body.action === "release" && typeof body.id === "string") { finishSearch(a, body.id); return NextResponse.json(wallet(a)); }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update demo credits." }, { status: 400 }); }
}

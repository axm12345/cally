import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Outbound calling is disabled. The client runs the simulated shop timeline. */
export async function POST() {
  return NextResponse.json({ mode: "mock" });
}

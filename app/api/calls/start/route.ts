import { NextResponse } from "next/server";
import {
  SHOP_DIRECTORY,
  bangkokReferenceTime,
  callerConfig,
  callerFetch,
  elevenLabsConfig,
  elevenLabsFetch,
} from "@/lib/server/calls";

export const runtime = "nodejs";

const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim().slice(0, 200) : "";
  return t.toLowerCase() === "not mentioned" ? "" : t;
};

/** One entry per shop. `mock: true` means the client plays that shop's mock result. */
type StartedCall = { shop_name: string; conversation_id: string | null; mock?: boolean; phone?: string };

/**
 * Starts one outbound call per shop, all at once.
 * Uses the Vonage caller (caller/) when CALLER_* is set, otherwise ElevenLabs' own telephony.
 * Shops that can't be called live fall back to mock results; replies { mode: "mock" } when none are live.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {}
  const fix = str(body.fix);
  const device = str(body.device);
  const when = str(body.when);
  const near = str(body.near);
  const reference_time = bangkokReferenceTime();
  const request_summary = [
    fix && `Fix a ${fix.toLowerCase()}`,
    device && `${fix ? "on " : "Repair "}${/^[aeiou]/i.test(device) ? "an" : "a"} ${device}`,
  ]
    .filter(Boolean)
    .join(" ");
  const constraints = [when ? `Needed ${when.toLowerCase()}` : "No time preference given", near && `near ${near}`].filter(Boolean).join(", ");
  const questions = "Can you do it today? What is the total price, including parts and labour? When would it be ready?";
  const mission = (shop_name: string) => ({ business_name: shop_name, request_summary, constraints, questions, reference_time });

  let calls: StartedCall[];
  const caller = callerConfig();
  const cfg = elevenLabsConfig();

  if (caller) {
    calls = await Promise.all(
      SHOP_DIRECTORY.map(async (shop, i): Promise<StartedCall> => {
        const number = caller.numbers[i];
        if (!number) return { shop_name: shop.shop_name, conversation_id: null, mock: true };
        try {
          const res = await callerFetch(caller, "/calls", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ number, language: caller.language, ...mission(shop.shop_name) }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || typeof data?.id !== "string") {
            console.error("[calls/start] caller", shop.shop_name, res.status, JSON.stringify(data));
            return { shop_name: shop.shop_name, conversation_id: null, mock: true };
          }
          return { shop_name: shop.shop_name, conversation_id: `c_${data.id}`, phone: number };
        } catch (err) {
          console.error("[calls/start] caller unreachable", shop.shop_name, err);
          return { shop_name: shop.shop_name, conversation_id: null, mock: true };
        }
      }),
    );
  } else if (cfg) {
    calls = await Promise.all(
      SHOP_DIRECTORY.map(async (shop): Promise<StartedCall> => {
        try {
          const res = await elevenLabsFetch("/v1/convai/twilio/outbound-call", cfg.apiKey, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              agent_id: cfg.agentId,
              agent_phone_number_id: cfg.phoneNumberId,
              to_number: shop.phone.replace(/\s+/g, ""),
              conversation_initiation_client_data: { dynamic_variables: mission(shop.shop_name) },
              telephony_call_config: { ringing_timeout_secs: 45 },
              call_recording_enabled: true,
            }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success || !data.conversation_id) {
            console.error("[calls/start]", shop.shop_name, res.status, JSON.stringify(data));
            return { shop_name: shop.shop_name, conversation_id: null, mock: true };
          }
          return { shop_name: shop.shop_name, conversation_id: data.conversation_id as string };
        } catch (err) {
          console.error("[calls/start]", shop.shop_name, err);
          return { shop_name: shop.shop_name, conversation_id: null, mock: true };
        }
      }),
    );
  } else {
    return NextResponse.json({ mode: "mock" });
  }

  if (calls.every((c) => c.mock)) return NextResponse.json({ mode: "mock" });
  return NextResponse.json({ mode: "live", calls });
}

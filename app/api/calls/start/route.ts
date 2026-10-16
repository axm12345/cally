import { NextResponse } from "next/server";
import {
  SHOP_DIRECTORY,
  bangkokReferenceTime,
  callLanguage,
  callerConfig,
  callerFetch,
  elevenLabsConfig,
  elevenLabsFetch,
  liveShopNumbers,
} from "@/lib/server/calls";

export const runtime = "nodejs";

const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim().slice(0, 200) : "";
  return t.toLowerCase() === "not mentioned" ? "" : t;
};

/** One entry per shop. `mock: true` means the client plays that shop's mock result. */
type StartedCall = { shop_name: string; conversation_id: string | null; mock?: boolean; phone?: string };

/**
 * Starts one outbound call per shop, all at once. Only shops with a number in LIVE_SHOP_NUMBERS are
 * called; the rest, and any call that can't start, fall back to mock results.
 * Direct: ElevenLabs places the call over the Vonage SIP number (default when ELEVENLABS_* is set).
 * Caller: the laptop caller in caller/ (when only CALLER_* is set, or CALL_MODE=caller).
 * Replies { mode: "mock" } when no shop is called live.
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
  const numbers = liveShopNumbers();
  const language = body.language === "en" || body.language === "th" || body.language === "yue" ? body.language : callLanguage() ?? "th";
  const useCaller = !!caller && (process.env.CALL_MODE?.trim() === "caller" || !cfg);

  if (caller && useCaller) {
    calls = await Promise.all(
      SHOP_DIRECTORY.map(async (shop, i): Promise<StartedCall> => {
        const number = caller.numbers[i];
        if (!number) return { shop_name: shop.shop_name, conversation_id: null, mock: true };
        try {
          const res = await callerFetch(caller, "/calls", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ number, language, ...mission(shop.shop_name) }),
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
  } else if (cfg && numbers.some(Boolean)) {
    const path = cfg.telephony === "twilio" ? "/v1/convai/twilio/outbound-call" : "/v1/convai/sip-trunk/outbound-call";
    calls = await Promise.all(
      SHOP_DIRECTORY.map(async (shop, i): Promise<StartedCall> => {
        const raw = numbers[i];
        if (!raw) return { shop_name: shop.shop_name, conversation_id: null, mock: true };
        const number = raw.startsWith("+") ? raw : `+${raw}`;
        try {
          const res = await elevenLabsFetch(path, cfg.apiKey, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              agent_id: cfg.agentId,
              agent_phone_number_id: cfg.phoneNumberId,
              to_number: number,
              conversation_initiation_client_data: {
                dynamic_variables: mission(shop.shop_name),
                ...(language && { conversation_config_override: { agent: { language } } }),
              },
              telephony_call_config: { ringing_timeout_secs: 45 },
              ...(cfg.telephony === "twilio" && { call_recording_enabled: true }),
            }),
          });
          const data = await res.json().catch(() => null);
          if (!res.ok || !data?.success || !data.conversation_id) {
            console.error("[calls/start]", shop.shop_name, res.status, JSON.stringify(data));
            return { shop_name: shop.shop_name, conversation_id: null, mock: true };
          }
          return { shop_name: shop.shop_name, conversation_id: data.conversation_id as string, phone: number };
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

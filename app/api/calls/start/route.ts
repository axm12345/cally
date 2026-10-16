import { NextResponse } from "next/server";
import {
  SHOP_DIRECTORY,
  bangkokReferenceTime,
  callLanguage,
  elevenLabsConfig,
  elevenLabsFetch,
} from "@/lib/server/calls";

export const runtime = "nodejs";
export const maxDuration = 60;

const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim().slice(0, 200) : "";
  return t.toLowerCase() === "not mentioned" ? "" : t;
};

type StartedCall = { shop_name: string; conversation_id: string | null; mock?: boolean; phone?: string };
/** Two fixed real destinations, three simulated slots. */
export async function POST(req: Request) {
  const numbers = (process.env.SHOWCASE_TARGET_NUMBERS || "").split(",").map(n=>n.trim()).filter(Boolean);
  if (numbers.length !== 2 || new Set(numbers).size !== 2 || numbers.some(n=>!/^\+66\d{8,9}$/.test(n))) return NextResponse.json({error:"Configure exactly two approved showcase phones."},{status:503});
  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {}
  const fix = str(body.fix);
  const device = str(body.device);
  const when = str(body.when);
  const near = str(body.near);
  if (!fix || !device) return NextResponse.json({error:"Describe the repair and device first."},{status:400});
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
  const cfg = elevenLabsConfig();
  const language = body.language === "en" || body.language === "th" || body.language === "yue" ? body.language : callLanguage() ?? "th";

  if (cfg && numbers.some(Boolean)) {
    const attempt = req.headers.get("x-showcase-attempt");
    if (!attempt || !/^[a-zA-Z0-9-]{16,80}$/.test(attempt)) return NextResponse.json({error:"Missing call request ID."},{status:400});
    const { reserveShowcaseAttempt } = await import("@/lib/server/showcase-limit");
    if (!reserveShowcaseAttempt(attempt)) return NextResponse.json({error:"Call already requested, or demo limit reached. Wait 10 minutes before trying again."},{status:429});
    const path = cfg.telephony === "twilio" ? "/v1/convai/twilio/outbound-call" : "/v1/convai/sip-trunk/outbound-call";
    calls = await Promise.all(
      SHOP_DIRECTORY.map(async (shop, i): Promise<StartedCall> => {
        const raw = i < 2 ? numbers[i] : undefined;
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
            return { shop_name: shop.shop_name, conversation_id: null };
          }
          return { shop_name: shop.shop_name, conversation_id: data.conversation_id as string, phone: number };
        } catch (err) {
          console.error("[calls/start]", shop.shop_name, err);
          return { shop_name: shop.shop_name, conversation_id: null };
        }
      }),
    );
  } else {
    return NextResponse.json({ error:"Live calling is not configured." },{status:503});
  }

  if (!calls.some((c) => c.conversation_id)) return NextResponse.json({ error:"The provider could not start the test call. Check the account and phone configuration." }, {status:502});
  return NextResponse.json({ mode: "live", calls });
}
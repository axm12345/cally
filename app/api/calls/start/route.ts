import { NextResponse } from "next/server";
import { SHOP_DIRECTORY, bangkokReferenceTime, elevenLabsConfig, elevenLabsFetch } from "@/lib/server/calls";

export const runtime = "nodejs";

const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim().slice(0, 200) : "";
  return t.toLowerCase() === "not mentioned" ? "" : t;
};

/** Starts one outbound call per shop, all at once. Replies { mode: "mock" } when ElevenLabs isn't configured. */
export async function POST(req: Request) {
  const cfg = elevenLabsConfig();
  if (!cfg) return NextResponse.json({ mode: "mock" });

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

  const calls = await Promise.all(
    SHOP_DIRECTORY.map(async (shop) => {
      const dynamic_variables = {
        business_name: shop.shop_name,
        request_summary,
        constraints,
        questions,
        reference_time,
      };
      try {
        const res = await elevenLabsFetch("/v1/convai/twilio/outbound-call", cfg.apiKey, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            agent_id: cfg.agentId,
            agent_phone_number_id: cfg.phoneNumberId,
            to_number: shop.phone.replace(/\s+/g, ""),
            conversation_initiation_client_data: { dynamic_variables },
            telephony_call_config: { ringing_timeout_secs: 45 },
            call_recording_enabled: true,
          }),
        });
        const data = await res.json().catch(() => null);
        if (!res.ok || !data?.success || !data.conversation_id) {
          console.error("[calls/start]", shop.shop_name, res.status, JSON.stringify(data));
          return { shop_name: shop.shop_name, conversation_id: null };
        }
        return { shop_name: shop.shop_name, conversation_id: data.conversation_id as string };
      } catch (err) {
        console.error("[calls/start]", shop.shop_name, err);
        return { shop_name: shop.shop_name, conversation_id: null };
      }
    }),
  );
  return NextResponse.json({ mode: "live", calls });
}

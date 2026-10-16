import { SHOP_DIRECTORY } from "@/lib/shops";

export { SHOP_DIRECTORY };

const BASE = "https://api.elevenlabs.io";

/**
 * ElevenLabs places the calls itself (no laptop). ELEVENLABS_PHONE_NUMBER_ID is the Vonage
 * number imported into ElevenLabs as a SIP trunk; ELEVENLABS_TELEPHONY=twilio for a Twilio number.
 */
export function elevenLabsConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID?.trim();
  const telephony = process.env.ELEVENLABS_TELEPHONY?.trim() === "twilio" ? "twilio" : "sip";
  return apiKey && agentId && phoneNumberId ? { apiKey, agentId, phoneNumberId, telephony } : null;
}

/** LIVE_SHOP_NUMBERS: comma-separated; the Nth number is called for the Nth shop, the rest use mock results. */
export const liveShopNumbers = () => (process.env.LIVE_SHOP_NUMBERS ?? "").split(",").map((n) => n.replace(/[^\d+]/g, ""));

/** CALL_LANGUAGE: en | th | yue; unset uses the agent's own default language. */
export const callLanguage = () => {
  const l = process.env.CALL_LANGUAGE?.trim() ?? "";
  return ["en", "th", "yue"].includes(l) ? l : "th";
};

export const elevenLabsFetch = (path: string, apiKey: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, { ...init, headers: { "xi-api-key": apiKey, ...init?.headers } });

/**
 * The Vonage + ElevenLabs caller in caller/ (runs on a laptop behind a public tunnel).
 * CALLER_URL: its public https address. CALLER_TOKEN: its LOCAL_CALL_TOKEN.
 * LIVE_SHOP_NUMBERS: comma-separated numbers; the Nth number is called for the Nth shop,
 * shops without a number use mock results.
 */
export function callerConfig() {
  const url = process.env.CALLER_URL?.trim().replace(/\/+$/, "");
  const token = process.env.CALLER_TOKEN?.trim();
  const numbers = liveShopNumbers();
  return url && token && numbers.some(Boolean) ? { url, token, numbers, language: callLanguage() } : null;
}

export const callerFetch = (cfg: { url: string; token: string }, path: string, init?: RequestInit) =>
  fetch(`${cfg.url}${path}`, {
    ...init,
    headers: { "x-local-call-token": cfg.token, "ngrok-skip-browser-warning": "1", ...init?.headers },
    cache: "no-store",
  });

/** Bangkok is UTC+7 with no DST, so a fixed offset is enough. */
export function bangkokNow() {
  const d = new Date(Date.now() + 7 * 3600_000);
  return d.toISOString().slice(0, 16).replace("T", " ") + " (UTC+7)";
}

/** Current date and time in Asia/Bangkok, e.g. "Thursday, 15 October 2026, 14:05 (Asia/Bangkok)". */
export function bangkokReferenceTime() {
  const text = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    dateStyle: "full",
    timeStyle: "short",
    hourCycle: "h23",
  }).format(new Date());
  return `${text} (Asia/Bangkok)`;
}

export async function askClaude(system: string, user: string, maxTokens = 1024): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: maxTokens,
      // Haiku 5.5 thinks by default and that counts against max_tokens; a short extraction doesn't need it.
      thinking: { type: "disabled" },
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
}

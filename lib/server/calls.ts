import { SHOP_DIRECTORY } from "@/lib/shops";

export { SHOP_DIRECTORY };

const BASE = "https://api.elevenlabs.io";

export function elevenLabsConfig() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  const agentId = process.env.ELEVENLABS_AGENT_ID?.trim();
  const phoneNumberId = process.env.ELEVENLABS_PHONE_NUMBER_ID?.trim();
  return apiKey && agentId && phoneNumberId ? { apiKey, agentId, phoneNumberId } : null;
}

export const elevenLabsFetch = (path: string, apiKey: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, { ...init, headers: { "xi-api-key": apiKey, ...init?.headers } });

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

export async function askClaude(system: string, user: string, maxTokens = 300): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-5-5",
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content?.find((b: { type: string }) => b.type === "text")?.text ?? "";
}

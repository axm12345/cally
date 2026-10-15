import { elevenLabsConfig, elevenLabsFetch } from "@/lib/server/calls";

export const runtime = "nodejs";

/** Proxies the call recording so the API key stays on the server. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cfg = elevenLabsConfig();
  if (!cfg) return new Response("Not configured", { status: 503 });
  const { id } = await params;
  const res = await elevenLabsFetch(`/v1/convai/conversations/${encodeURIComponent(id)}/audio`, cfg.apiKey);
  if (!res.ok || !res.body) return new Response("No recording", { status: 404 });
  return new Response(res.body, {
    headers: { "content-type": res.headers.get("content-type") ?? "audio/mpeg" },
  });
}

/**
 * Single source of truth for shops and call results.
 *
 * The UI uses `getRequestSummary`, `startCalls` and `rankResults`. Calls and
 * summaries go through the /api routes; with no ElevenLabs env vars set,
 * `startCalls` plays the mock results below so the demo always works.
 */

export type CallStatus = "done" | "talking" | "ringing" | "no_answer" | "no_price" | "failed";

export type TranscriptLine = { speaker: "agent" | "shop"; text: string };

export type ShopResult = {
  shop_name: string;
  phone: string;
  status: CallStatus;
  price_thb: number | null;
  price_is_estimate: boolean; // true: show as "from ฿X"
  distance_km: number | null;
  simulated?: boolean;
  source_url?: string;
  address?: string;
  ready_time: string | null; // ISO 8601
  available_today: boolean;
  transcript: TranscriptLine[];
  recording_url: string | null;
  duration: string; // m:ss, shown on the details screen
};

export type RequestSummary = { fix: string; device: string; when: string; near: string };

export const NOT_MENTIONED = "Not mentioned";
export const DEFAULT_HOME_AREA = "Asok";
export const CURRENT_LOCATION_AREA = "my current location";
export const homeLabel = (area: string) =>
  area === DEFAULT_HOME_AREA ? `Home · ${area}` : area === CURRENT_LOCATION_AREA ? "Current location" : area;
export const EXAMPLE_REQUEST = "My phone screen is cracked, I need it fixed today";
export const OPENING_LINE = "Hi, I'm a booking assistant calling for a customer.";

/* ---------- sample demo data ---------- */

const MOCK_SHOPS: ShopResult[] = [
  {
    shop_name: "Soi 11 Mobile",
    phone: "+66 2 000 0011",
    status: "done",
    price_thb: 2500,
    price_is_estimate: false,
    distance_km: 1.2,
    ready_time: "2026-10-16T16:30:00+07:00",
    available_today: true,
    duration: "1:12",
    recording_url: null,
    transcript: [
      { speaker: "agent", text: `${OPENING_LINE} Can you fix a cracked phone screen today?` },
      { speaker: "shop", text: "Yes, we can. Which phone is it?" },
      { speaker: "agent", text: "An iPhone 15. How much, and how long would it take?" },
      { speaker: "shop", text: "2,500 baht. It'll be ready by 4:30 today." },
      { speaker: "agent", text: "Thank you, I'll let the customer know." },
    ],
  },
  {
    shop_name: "Nana Phone Care",
    phone: "+66 2 000 0022",
    status: "done",
    price_thb: 2800,
    price_is_estimate: false,
    distance_km: 2.0,
    ready_time: "2026-10-17T11:00:00+07:00",
    available_today: false,
    duration: "0:58",
    recording_url: null,
    transcript: [
      { speaker: "agent", text: `${OPENING_LINE} Can you fix a cracked iPhone 15 screen today?` },
      { speaker: "shop", text: "Not today, the part comes in tomorrow." },
      { speaker: "agent", text: "How much, and when would it be ready?" },
      { speaker: "shop", text: "2,800 baht, ready tomorrow by 11 in the morning." },
      { speaker: "agent", text: "Thank you, I'll let the customer know." },
    ],
  },
  {
    shop_name: "Asok Screen Fix",
    phone: "+66 2 000 0033",
    status: "done",
    price_thb: 3200,
    price_is_estimate: false,
    distance_km: 0.5,
    ready_time: "2026-10-16T15:00:00+07:00",
    available_today: true,
    duration: "1:03",
    recording_url: null,
    transcript: [
      { speaker: "agent", text: `${OPENING_LINE} Can you fix a cracked iPhone 15 screen today?` },
      { speaker: "shop", text: "Sure. We have the screen in stock." },
      { speaker: "agent", text: "How much, and how long?" },
      { speaker: "shop", text: "3,200 baht, ready at 3 this afternoon." },
      { speaker: "agent", text: "Thank you, I'll let the customer know." },
    ],
  },
  {
    shop_name: "Terminal Fix Bar",
    phone: "+66 2 000 0044",
    status: "done",
    price_thb: 3900,
    price_is_estimate: false,
    distance_km: 0.9,
    ready_time: "2026-10-16T14:30:00+07:00",
    available_today: true,
    duration: "0:49",
    recording_url: null,
    transcript: [
      { speaker: "agent", text: `${OPENING_LINE} Can you fix a cracked iPhone 15 screen today?` },
      { speaker: "shop", text: "Yes, original quality, about an hour." },
      { speaker: "agent", text: "What would the price be?" },
      { speaker: "shop", text: "3,900 baht, ready by 2:30." },
      { speaker: "agent", text: "Thank you, I'll let the customer know." },
    ],
  },
  {
    shop_name: "Sukhumvit Repair Hub",
    phone: "+66 2 000 0055",
    status: "no_answer",
    price_thb: null,
    price_is_estimate: false,
    distance_km: 1.6,
    ready_time: null,
    available_today: false,
    duration: "0:00",
    recording_url: null,
    transcript: [],
  },
];

/** The shops to call: name, number and distance. */
export const SHOP_DIRECTORY = MOCK_SHOPS.map(({ shop_name, phone, distance_km }) => ({ shop_name, phone, distance_km }));

/** When each mock call changes state, in ms from the start of the batch. */
const MOCK_TIMELINE: Record<string, { talking: number; end: number }> = {
  "Soi 11 Mobile": { talking: 3000, end: 42000 },
  "Nana Phone Care": { talking: 5000, end: 51000 },
  "Asok Screen Fix": { talking: 6500, end: 58000 },
  "Terminal Fix Bar": { talking: 8500, end: 66000 },
  "Sukhumvit Repair Hub": { talking: Infinity, end: 32000 },
};

/* ---------- the three functions the UI uses ---------- */

/** Turn the transcript into the Fix / Device / When / Near rows via the server route. */
export async function getRequestSummary(transcript: string): Promise<RequestSummary> {
  const res = await fetch("/api/summarize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) throw new Error(`summarize failed: ${res.status}`);
  return res.json();
}

const POLL_MS = 3000;

/**
 * Start calling shops at once. `onUpdate` receives the full current list every
 * time any call changes state. `onFinish` fires when all calls have ended.
 * Returns a cancel function that stops everything.
 * Uses real ElevenLabs calls via the /api/calls routes; if those aren't
 * configured on the server it plays the mock timeline instead.
 */
export function startCalls(
  request: RequestSummary,
  onUpdate: (results: ShopResult[]) => void,
  onFinish: (results: ShopResult[]) => void,
  language: "en" | "th" | "yue" = "th",
): () => void {
  let cancelled = false;
  let cancelMock: (() => void) | null = null;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const blank = (shop: (typeof SHOP_DIRECTORY)[number], status: CallStatus): ShopResult => ({
    ...shop,
    status,
    price_thb: null,
    price_is_estimate: false,
    ready_time: null,
    available_today: false,
    transcript: [],
    recording_url: null,
    duration: "0:00",
  });

  void (async () => {
    let started: {
      mode: string;
      calls?: { shop_name: string; conversation_id: string | null; mock?: boolean; phone?: string }[];
    };
    try {
      const res = await fetch("/api/calls/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fix: request.fix, device: request.device, when: request.when, near: request.near, language }),
      });
      started = await res.json();
    } catch {
      started = { mode: "mock" };
    }
    if (cancelled) return;
    if (started.mode !== "live" || !started.calls) {
      cancelMock = startMockCalls(onUpdate, onFinish, request);
      return;
    }

    let results = SHOP_DIRECTORY.map((s) => blank(s, "ringing"));
    const open = new Set<string>();
    const ids = new Map(started.calls.map((c) => [c.shop_name, c.conversation_id]));
    const mockNames = new Set(started.calls.filter((c) => c.mock).map((c) => c.shop_name));
    for (const c of started.calls) {
      // The live shop's real number, so "Call this shop" dials who the agent talked to.
      if (c.phone) results = results.map((x) => (x.shop_name === c.shop_name ? { ...x, phone: c.phone! } : x));
    }
    for (const r of results) {
      if (ids.get(r.shop_name) || mockNames.has(r.shop_name)) open.add(r.shop_name);
      else results = results.map((x) => (x.shop_name === r.shop_name ? { ...x, status: "failed" as CallStatus } : x));
    }
    onUpdate(results);
    if (open.size === 0) return onFinish(results);

    const done = (name: string) => {
      open.delete(name);
      if (open.size === 0) onFinish(results);
    };

    // Shops that aren't called live play their mock result on the mock timeline.
    for (const name of mockNames) {
      const mock = MOCK_SHOPS.find((s) => s.shop_name === name);
      const t = MOCK_TIMELINE[name];
      if (!mock || !t) {
        done(name);
        continue;
      }
      const patch = (p: Partial<ShopResult>) => {
        if (cancelled) return;
        results = results.map((r) => (r.shop_name === name ? { ...r, ...p } : r));
        onUpdate(results);
      };
      if (Number.isFinite(t.talking)) {
        const tt = setTimeout(() => patch({ status: "talking" }), t.talking);
        timers.add(tt);
      }
      const te = setTimeout(() => {
        patch(mock);
        if (!cancelled) done(name);
      }, t.end);
      timers.add(te);
    }

    const poll = async (name: string) => {
      if (cancelled) return;
      let terminal = false;
      try {
        const res = await fetch(`/api/calls/${ids.get(name)}`);
        if (res.ok) {
          const d = await res.json();
          terminal = !!d.terminal;
          const { terminal: _t, ...patch } = d;
          results = results.map((r) => (r.shop_name === name ? { ...r, ...patch } : r));
          if (cancelled) return;
          onUpdate(results);
        }
      } catch {}
      if (cancelled) return;
      if (terminal) {
        done(name);
      } else {
        const t = setTimeout(() => {
          timers.delete(t);
          void poll(name);
        }, POLL_MS);
        timers.add(t);
      }
    };
    for (const name of [...open]) if (!mockNames.has(name)) void poll(name);
  })();

  return () => {
    cancelled = true;
    cancelMock?.();
    timers.forEach(clearTimeout);
  };
}

function startMockCalls(
  onUpdate: (results: ShopResult[]) => void,
  onFinish: (results: ShopResult[]) => void,
  request: RequestSummary,
): () => void {
  let cancelled = false;
  const controller = new AbortController();
  const timers: ReturnType<typeof setTimeout>[] = [];
  void (async () => {
    try {
      let coordinates;
      let radiusKm = 5;
      try { const saved = Number(localStorage.getItem("cally-radius-km")); if (Number.isInteger(saved) && saved >= 1 && saved <= 20) radiusKm = saved; } catch {}
      try { const point = JSON.parse(localStorage.getItem("cally-map-point") || "null"); if (point?.label === request.near) coordinates = { lat: point.lat, lon: point.lon }; } catch {}
      const res = await fetch("/api/demo-shops", { method: "POST", headers: { "content-type": "application/json" }, signal: controller.signal, body: JSON.stringify({ ...request, coordinates, radiusKm }) });
      if (!res.ok) throw new Error("Shop lookup failed");
      const data = await res.json();
      if (cancelled) return;
      const listings = (data.shops || []) as Pick<ShopResult, "shop_name" | "phone" | "distance_km" | "address" | "source_url" | "simulated">[];
      const plans = listings.slice(0,5).map((listing, i) => {
        const sample = MOCK_SHOPS[i];
        const timing = MOCK_TIMELINE[sample.shop_name];
        const seconds = Math.round((timing.end - (Number.isFinite(timing.talking) ? timing.talking : timing.end)) / 1000);
        return { shop: { ...sample, ...listing, simulated: true, duration: Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2,"0"), transcript: sample.status === "no_answer" ? [] : [
          { speaker: "agent" as const, text: "SIMULATED: Asking about " + request.fix + " for " + request.device + "." },
          { speaker: "shop" as const, text: "Illustrative demo response only. This business has not been contacted." },
          { speaker: "agent" as const, text: "Example comparison price: ฿" + sample.price_thb + ". This is not a quote from this business." },
        ] }, timing };
      });
      let results: ShopResult[] = plans.map(({shop}) => ({ ...shop, status: "ringing" }));
      onUpdate(results);
      if (!plans.length) return onFinish([]);
      let remaining = plans.length;
      for (const { shop, timing } of plans) {
        if (Number.isFinite(timing.talking)) timers.push(setTimeout(() => {
          if (cancelled) return;
          results = results.map(r => r.shop_name === shop.shop_name ? { ...r, status: "talking" } : r);
          onUpdate(results);
        }, timing.talking));
        timers.push(setTimeout(() => {
          if (cancelled) return;
          results = results.map(r => r.shop_name === shop.shop_name ? shop : r);
          onUpdate(results);
          if (--remaining === 0) onFinish(results);
        }, timing.end));
      }
    } catch { if (!cancelled) { onUpdate([]); onFinish([]); } }
  })();
  return () => { cancelled = true; controller.abort(); timers.forEach(clearTimeout); };
}

/** Answered shops, cheapest first, plus how many were left out. */
export function rankResults(results: ShopResult[]) {
  const answered = results
    .filter((r) => r.status === "done" && r.price_thb !== null)
    .sort((a, b) => a.price_thb! - b.price_thb!);
  return { answered, leftOut: results.length - answered.length };
}

/* ---------- display helpers ---------- */

export const formatPrice = (n: number | null, estimate = false, language: "en" | "th" | "yue" = "en") =>
  n === null ? "-" : `${estimate ? (language === "th" ? "เริ่มต้น " : language === "yue" ? "由 " : "from ") : ""}฿${n.toLocaleString("en-US")}`;

export function formatReady(r: ShopResult): { text: string; late: boolean } {
  if (!r.ready_time) return { text: "-", late: true };
  if (!r.available_today) return { text: "Tomorrow", late: true };
  // Read the clock time straight from the ISO string so it shows the shop's local time.
  const [h, m] = r.ready_time.slice(11, 16).split(":").map(Number);
  return { text: `${h % 12 || 12}:${String(m).padStart(2, "0")}`, late: false };
}

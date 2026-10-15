# CallAround

Say what needs fixing. An AI voice agent phones nearby shops at the same time, and the app shows the answers cheapest first, with price, distance from home and ready time.

Mobile-first Next.js web app (App Router, React 19, TypeScript, no UI libraries). Built for u-hackathon 2026, Bangkok.

- **Live app:** https://call-around.vercel.app
- **Status:** the full flow works end to end on **mock call results**. Real calls are wired for ElevenLabs Agents but switched off in production (no ElevenLabs env vars set).

## Requirements

- Node.js 20 or later (developed on Node 24.21, npm 11)
- An Anthropic API key (for reading the spoken request)
- Optional: ElevenLabs API key, agent ID and phone number ID (for real calls)

Speech input uses the browser's built-in speech recognition (Chrome, Safari). It needs `https` or `localhost` to get mic access.

## Run locally

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on port 3000 |
| `npm run build` | Production build |
| `npm start` | Serve the production build |

On Windows, if PowerShell blocks npm scripts, use `npm.cmd` / `vercel.cmd`, or run the commands from cmd.

Do not run `npm audit fix --force` or upgrade Next.js before the demo.

## Environment variables

All variables are **server-only**. They are read in `app/api/**` and `lib/server/**` and never reach the browser. Do not add a `NEXT_PUBLIC_` prefix to any of them.

| Variable | Required | Used by | Effect if empty |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | `/api/summarize`, transcript extraction in `/api/calls/[id]` | Confirm screen can't be reached (error on the Speak screen) |
| `ELEVENLABS_API_KEY` | No | `/api/calls/*` | App uses mock results |
| `ELEVENLABS_AGENT_ID` | No | `/api/calls/start` | App uses mock results |
| `ELEVENLABS_PHONE_NUMBER_ID` | No | `/api/calls/start` | App uses mock results |

See `.env.example` for the format. Claude model: `claude-haiku-5-5`.

## Deploy (Vercel)

The project is linked to the Vercel project `call-around/call-around`.

1. Add every variable above in **Vercel → Project → Settings → Environment Variables** (Production). Currently only `ANTHROPIC_API_KEY` is set there.
2. Deploy from the project folder:
   ```bash
   vercel --prod
   ```
3. Every env var change needs a redeploy.

Vercel serverless functions can't hold long-lived WebSockets. Any audio relay between a phone provider and ElevenLabs must run somewhere else.

## How the app works

```
Speak ──▶ Confirm ──▶ Calling ──▶ Options ──▶ Call details
  ▲          │ "No, say it again"
  └──────────┘
```

All five screens live in `app/page.tsx` (a single client component). Styles are in `app/globals.css`, icons in `components/icons.tsx`.

| Screen | Data source today |
|---|---|
| **Speak** | Browser speech recognition (or "Type instead"). Location pill uses browser geolocation or a typed area, default `Asok`. |
| **Confirm** | **Real:** `POST /api/summarize` (Claude) returns `{ fix, device, when, near }` |
| **Calling** | **Mock** unless ElevenLabs is configured. Statuses: Ringing / Talking / Got a price / No answer |
| **Options** | **Mock** unless ElevenLabs is configured. Ranked by `rankResults()` (cheapest first) |
| **Call details** | **Mock** transcript unless ElevenLabs is configured |

### Where the data lives: `lib/shops.ts`

This is the single file for shops, mock data and call orchestration on the client:

- `MOCK_SHOPS`: 5 sample shops with sample prices, transcripts and distances (not real shops or numbers)
- `SHOP_DIRECTORY`: the shops that get called, as `{ shop_name, phone, distance_km }`. It is currently derived from `MOCK_SHOPS`.
- `getRequestSummary()`: calls `/api/summarize`
- `startCalls(request, onUpdate, onFinish)`: starts calls via `/api/calls/start`, polls `/api/calls/[id]` every 3 s, and falls back to the mock timeline when the server replies `{ mode: "mock" }`
- `rankResults()`: answered shops with a price, sorted by `price_thb` ascending. Everything else is counted in the "didn't pick up" footer.

The result shape every screen expects (`ShopResult`):

```ts
{
  shop_name: string;
  phone: string;               // E.164, used for the "Call this shop" tel: link
  status: "done" | "talking" | "ringing" | "no_answer" | "no_price" | "failed";
  price_thb: number | null;
  price_is_estimate: boolean;  // true → shown as "from ฿X"
  distance_km: number;
  ready_time: string | null;   // ISO 8601 with +07:00
  available_today: boolean;
  transcript: { speaker: "agent" | "shop"; text: string }[];
  recording_url: string | null;
  duration: string;            // "m:ss"
}
```

### API endpoints

| Endpoint | Purpose |
|---|---|
| `POST /api/summarize` | Body `{ transcript }` → `{ fix, device, when, near }`. Missing fields are `"Not mentioned"` (`near` is `""`). |
| `POST /api/calls/start` | Body `{ fix, device, when, near }`. Returns `{ mode: "mock" }` if ElevenLabs isn't configured. Otherwise it starts one call per shop in `SHOP_DIRECTORY` in parallel and returns `{ mode: "live", calls: [{ shop_name, conversation_id \| null }] }`. |
| `GET /api/calls/[id]` | Status of one ElevenLabs conversation, mapped to the `ShopResult` fields plus `terminal: boolean`. When a call ends, Claude extracts the price, estimate flag, today availability and ready time from the transcript. |
| `GET /api/calls/[id]/audio` | Proxies the call recording so the API key stays server-side. |

`/api/calls/start` builds these agent dynamic variables for each call: `business_name`, `request_summary` (fix + device), `constraints` (when + near, or "No time preference given"), `questions` (fixed list) and `reference_time` (Asia/Bangkok).

Telephony today: `/api/calls/start` uses ElevenLabs' **Twilio** outbound-call endpoint (`/v1/convai/twilio/outbound-call`). The team now uses **Vonage**, so this needs to point at the Vonage–ElevenLabs backend (see below).

## Live calls (Vonage + ElevenLabs caller)

`caller/` is Aarush's tested caller (from `aarush-hitgub/cally-caller`) with small additions in `caller/controller/cally-calls.js`:

- `POST /calls` `{ number, business_name, request_summary, constraints, questions, reference_time }` → `{ id }` (header `x-local-call-token`)
- `GET /calls/:id` → `{ status: ringing | talking | ended | no_answer | failed, ended, duration_secs, transcript, conversation_id }`
- The five agent variables are passed per call to the connector, then to the ElevenLabs agent.
- `VERIFIED_TEST_NUMBER` may list several numbers (comma-separated, digits only). Any other number is refused.
- `PROCESSOR_SERVER` may be left blank: the WebSocket uses the same public host.

The caller runs on a laptop (it needs long-lived WebSockets, which Vercel can't host):

1. Put `controller/.env`, `connector/.env` and `controller/.private.key` in `caller/` (never committed). Then run `npm run setup` inside `caller/`.
2. Double-click `caller/start-all.cmd`. It opens the controller, connector, gateway and `ngrok http 8000`.
3. Copy ngrok's `https://…` address into `CALLER_URL` in `.env.local` and restart `npm run dev`.
4. Confirm a request in the app. Shops with a number in `LIVE_SHOP_NUMBERS` are called for real, and the rest play mock results. If the caller is unreachable, those shops also fall back to mock.

## Integration points for the Vonage–ElevenLabs backend

The UI does not need to change. Every integration happens behind the functions and endpoints above.

| Concern | Where to connect | Notes |
|---|---|---|
| **Shop discovery** | `SHOP_DIRECTORY` in `lib/shops.ts` | Static list today; there is no nearby-shop search yet. The selected area is sent only as the text `near`. For the demo, replace the phone numbers with the team's test numbers. A real search would replace this list, server-side, using `near`. |
| **Call initiation** | `POST /api/calls/start` (`app/api/calls/start/route.ts`) | Replace the ElevenLabs Twilio request with a call to the Vonage backend. Keep the response shape `{ mode: "live", calls: [{ shop_name, conversation_id }] }`, and keep `{ mode: "mock" }` when credentials are missing. |
| **Call status** | `GET /api/calls/[id]` (`app/api/calls/[id]/route.ts`) | Expects an ElevenLabs `conversation_id`. If the backend returns its own IDs, map them to ElevenLabs conversation IDs or return the same fields (`status`, `transcript`, `duration`, `terminal`, …) from the backend. |
| **Comparison results** | `rankResults()` in `lib/shops.ts` | Plain code, cheapest first. No change needed if statuses and prices follow `ShopResult`. |
| **Credentials** | `elevenLabsConfig()` in `lib/server/calls.ts` | Add any Vonage/backend variables here (server-only) and to `.env.example`. |

**Rule: mock mode must keep working.** If any live call setup is missing or fails to start, the app must still finish the flow on mock results.

## Known gaps

- Shop discovery is a fixed list, and the phone numbers in it are placeholders.
- If live mode is configured but every call fails to start, the Options screen shows no shops (no automatic switch back to mock).
- If `/api/summarize` fails, the user stays on the Speak screen with an error.
- Booking and payment (U-bot deposit) are not built. The button is "Call this shop", which opens the phone dialer.

## Project layout

```
app/
  page.tsx                 all 5 screens (client)
  layout.tsx, manifest.ts  metadata, viewport, PWA manifest
  globals.css              styles (violet #5B21B6 accent, galaxy mic orb)
  api/summarize/           Claude: transcript → request fields
  api/calls/               start calls, call status, recording proxy
components/icons.tsx       line icons
lib/shops.ts               shop list, mock data, client call orchestration, ranking
lib/server/calls.ts        server helpers: ElevenLabs config/fetch, Claude call, Bangkok time
public/                    app icons
callaround-ui-spec.md      original UI spec; the code wins where they differ (violet accent, "Call this shop", no history icon)
```

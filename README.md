# Cally (repo: callaround)

Say what needs fixing. An AI voice agent phones nearby shops at the same time, and the app shows the answers cheapest first, with price, distance from home and ready time.

Mobile-first Next.js web app (App Router, React 19, TypeScript, no UI libraries). Built for u-hackathon 2026, Bangkok.

- **Live app:** https://call-around.vercel.app
- **Status (16 Oct 2026):** works end to end. The first shop in the list is called **for real** (the number in `LIVE_SHOP_NUMBERS`); the other four shops are mock results. Calls go Vercel → ElevenLabs → Vonage, so no laptop or extra server is needed.

## Picking this up as a teammate

1. Clone this repo, then `npm install`.
2. Copy `.env.example` to `.env.local` and get the real values **privately** from Harshit (never commit them):
   `ANTHROPIC_API_KEY`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER_ID`, `LIVE_SHOP_NUMBERS`, `CALL_LANGUAGE`.
   The ElevenLabs and Vonage values also live in Aarush's private repo `aarush-hitgub/cally-caller`.
3. `npm run dev` and open http://localhost:3000. With no keys at all, the app still runs on mock results.
4. Deploying needs access to the Vercel project `call-around` (Harshit's account). The production settings are already stored in Vercel, so a redeploy works without anyone's laptop.

Where things live:

| What | Where |
|---|---|
| The 5 screens | `app/page.tsx`, styles in `app/globals.css` |
| Shops, mock data, ranking | `lib/shops.ts` |
| Starting calls / call status | `app/api/calls/start/route.ts`, `app/api/calls/[id]/route.ts` |
| Reading the spoken request | `app/api/summarize/route.ts` |
| Location names | `app/api/place/route.ts` |
| Voice agent (prompt, greeting, voice) | ElevenLabs agent "Cally - Business Enquiries" on Aarush's ElevenLabs account; prompt copy in `caller/agent/system-prompt.txt` |
| Phone line | Vonage number, imported into ElevenLabs as "Cally - Vonage (SIP)" |
| Laptop backup caller | `caller/` (only needed if direct calls stop working) |

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
| `ELEVENLABS_API_KEY` | For live calls | `/api/calls/*` | App uses mock results |
| `ELEVENLABS_AGENT_ID` | For live calls | `/api/calls/start` | App uses mock results |
| `ELEVENLABS_PHONE_NUMBER_ID` | For live calls | `/api/calls/start` (the Vonage SIP number in ElevenLabs) | App uses mock results |
| `LIVE_SHOP_NUMBERS` | For live calls | Nth number is called for the Nth shop | Every shop is mock |
| `CALL_LANGUAGE` | No | `en`, `th` or `yue`: language the agent opens in | Agent's default (Thai) |
| `ELEVENLABS_TELEPHONY` | No | `twilio` only for a Twilio number | SIP (the Vonage number) |
| `CALL_MODE` | No | `caller` forces the laptop caller | Direct ElevenLabs calls |
| `CALLER_URL`, `CALLER_TOKEN` | Backup only | The laptop caller in `caller/` | Not used |

See `.env.example` for the format. Claude model: `claude-haiku-5-5`.

## Deploy (Vercel)

The project is linked to the Vercel project `call-around/call-around`.

1. Add the variables above in **Vercel → Project → Settings → Environment Variables** (Production). All of them are already set there for the live app. To turn live calls off, remove `LIVE_SHOP_NUMBERS` and redeploy.
2. Deploy from the project folder:
   ```bash
   vercel --prod
   ```
3. Every env var change needs a redeploy.

Vercel serverless functions can't hold long-lived WebSockets, which is why calls are placed by ElevenLabs itself (over the Vonage SIP number) rather than relayed through Vercel.

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

Telephony today: `/api/calls/start` uses ElevenLabs' **SIP trunk** outbound-call endpoint (`/v1/convai/sip-trunk/outbound-call`) with the Vonage number imported into ElevenLabs. Each call gets the five agent variables and the `CALL_LANGUAGE` override; the transcript and status come from ElevenLabs' conversations API, and Claude reads the price and ready time.

## Backup: the laptop caller (Vonage + ElevenLabs)

Only needed if direct calls stop working; set `CALL_MODE=caller` to use it. `caller/` is Aarush's tested caller (from `aarush-hitgub/cally-caller`) with small additions in `caller/controller/cally-calls.js`:

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

**Rule: mock mode must keep working.** If any live call setup is missing or fails to start, the app must still finish the flow on mock results.

## Known gaps

- Shop discovery is a fixed list. Only shops with a number in `LIVE_SHOP_NUMBERS` are really called; the rest are mock.
- Anyone with the live link can trigger a real call while `LIVE_SHOP_NUMBERS` is set on Vercel.
- The agent sometimes says its closing line before the shop has finished its last answer.
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

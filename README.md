# Cally v1.2

Private handoff of the current assembled Cally app, based on axm12345/cally. That original repository is unchanged.

## Windows startup

Use Node.js 24 LTS. Accept the repository invitation, then:

```powershell
git clone https://github.com/aarush-hitgub/cally-v1.2.git
cd cally-v1.2
npm.cmd ci
npm.cmd run dev -- --hostname 127.0.0.1 --port 3200
```

Open http://127.0.0.1:3200. Alternatively: npm.cmd run build, then npm.cmd run start -- --hostname 127.0.0.1 --port 3200.

## Configuration transfer — no templates

Copy the owner's EXISTING populated files privately into these exact paths before starting:

- .env.local
- caller/controller/.env
- caller/connector/.env
- caller/controller/.private.key

These files were blocked from repository publication by automatic approval review. No dummy configuration files have been substituted. The original files remain on the owner's machine in the local assembled app. Restart after copying or changing env files. Never put provider keys in browser code.

The root .env.local contains the Anthropic key, ElevenLabs key, agent ID, imported SIP phone ID, Thai default call language and one live destination. Confirming a request can place a paid call to the owner's test phone ending 7771. Clear LIVE_SHOP_NUMBERS and restart to disable real calls. Remaining shops are mock; do not substitute real destinations without an authorized test.

## What changed in v1.2

- Compact animated settings panel, persistent dark/light mode.
- English, Thai and Cantonese app language, independently selectable AI call voice language; default English UI and Thai voice. Cantonese requires selection.
- Circular flags and globe icons for language settings.
- Speech waits for 1.8 seconds of quiet, preserving speech across short recognition sessions. Stop submits immediately. No microphone visualizer; that feature was reverted.
- Location sheet map button: tap, drag a pin or pan and pin the map center, then confirm. OpenStreetMap resolves street/area names; no Google key required. Last confirmed map pin is stored per browser.

## Calling architecture

Default: this app's server -> ElevenLabs SIP outbound call -> existing Vonage phone line. Direct mode needs no ngrok or extra laptop connector. Per-call business_name, request_summary, constraints, questions and reference_time are supplied. Voice preference affects new calls. Speech input follows app language.

The hosted ElevenLabs agent, its tools/defaults and imported phone line remain in the shared provider account; cloning does not recreate them. Changes to the shared agent affect everyone using it. The directory is fixed demo data. Selecting a map point does NOT discover nearby real shops or recalculate shop distances. Four shops remain mock; failed live starts can fall back to mock. Never charge for, or claim real savings from, mock quotes.

## Optional laptop backup

Run npm.cmd --prefix caller run setup to install it. Use the direct integration first. The backup needs persistent processes and a public tunnel; caller/start-all.cmd starts them. Set CALL_MODE=caller, CALLER_URL and CALLER_TOKEN in the root env only when selecting it. Original tunnel hostnames are not portable. caller/controller/cally-calls.js supplies the newer app endpoints; caller/CALLING-HANDOFF.md is historical standalone documentation and predates those additions. Keep recording disabled.

## Validation and limitations

Production build and TypeScript passed. Map pin dragging, confirmation and street-name resolution were browser-tested. Speech pause logic was checked with simulated recognition events. Packaging placed no calls; verify one approved destination on the receiving machine.

Web dependency audit reports two affected packages (one moderate, one high via PostCSS/Next.js). Backup service installs previously reported zero. Preserve the lockfile for reproducibility; review upgrades separately instead of audit fix --force. A parent lockfile warning on the original laptop did not prevent building.

There is no authentication protecting paid-call endpoints. Keep local until access control is added; do not expose this configuration publicly. Real payments/credits are not implemented; CALLY-PAYMENTS-STANDBY.md is a proposal. See UPSTREAM-README.md for original project documentation; this README describes the current handoff.

## Location-based demo update
The public demo now resolves real business listings for the selected area and repair request through Google Places (GOOGLE_MAPS_API_KEY is server-only). No phone numbers are requested for discovery, and those shops are not called. Conversations and sample prices are explicitly simulated; timings are staggered over roughly 40–65 seconds. View shop listing opens the real listing rather than dialing. U-bot integration was cancelled.

Search radius: location picker now offers a persistent 1–20 km slider, default 5 km. Listing results are filtered by straight-line distance from the map point or resolved typed area; shops beyond the limit are excluded.

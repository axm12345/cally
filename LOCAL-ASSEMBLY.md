# Local assembly status

Source: https://github.com/axm12345/cally (main archive downloaded 16 October 2026).
A separate downloaded copy; no changes were pushed to the repository.

Open http://127.0.0.1:3200 while the current production server is running.
For future development, stop the existing server first, then double-click START-CALLY-LOCAL.cmd.

Completed: locked dependency installation, production build, backup caller dependency installation and syntax checks, homepage browser check, and mock call endpoint check. Existing source files were preserved. Known local ElevenLabs key, agent and imported SIP phone ID are in .env.local; backup credentials are in caller/controller and caller/connector. Values are not printed here.

Missing: ANTHROPIC_API_KEY in .env.local. Obtain it privately from the teammate. Without it, the existing /api/summarize returns 500 and the UI cannot advance from its request screen. The README's general claim that no keys are needed for mock mode does not hold for that initial summarization step.

LIVE_SHOP_NUMBERS is deliberately empty. No real phone calls were placed. Add only explicitly approved test destinations when ready to test. This app otherwise calls numbers as soon as its confirmation step is accepted.

The shop list is fixed, not Google Maps discovery. Direct calls use the existing ElevenLabs SIP integration; the backup caller is installed but not started and needs a public tunnel if selected. No Google API key is required by this version.

Dependency audit: web app reports 2 affected packages (1 moderate, 1 high, via PostCSS/Next.js); backup packages report 0. Preserved README dependency versions and did not run a forced upgrade. Next.js also warns about an inferred parent workspace root due to unrelated lockfiles; the build and local server still succeeded.

This is a local assembly, not a Vercel redeploy. No cloud, agent, billing, repository or collaborator settings were changed. Full live flow remains unverified until the missing key is provided and a consenting test call is requested.

## Configuration completed
The Anthropic key has now been saved locally and the app restarted. A real /api/summarize request returned HTTP 200 with Broken screen / Laptop / Today / Asok. The earlier missing-key blocker is resolved. LIVE_SHOP_NUMBERS remains empty; no phone calls were placed. Full live calling remains untested in this local assembly.

## Local settings added
Small settings button, persistent light/dark theme, English/Thai UI, and separate English/Thai AI call voice preference. New/default call voice is Thai. Browser microphone recognition follows app language; outbound agent follows AI voice language. Agent voice identity is unchanged. Original transcript text and business names are preserved. Production build and TypeScript passed; eight mocked direct/backup language cases passed without any provider call. Browser checks confirmed dark theme, Thai labels and preference persistence. GitHub remains unchanged.

## Map location picker
Added a small map toggle in the area sheet using Leaflet and OpenStreetMap tiles. Supports dragging the pin, clicking a point, panning/zooming and pinning the map center. Only confirmation sends the selected point to the existing location-name endpoint, which uses OpenStreetMap reverse geocoding. No Google API key is used. The last confirmed pin is stored locally for reopening; this does not implement live shop discovery. TypeScript and production build passed. No paid phone calls were made.

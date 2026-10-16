# Vercel demo deployment

Use Node.js 24.x. Import this repository into Vercel with Next.js detected and the repository root as project root. The backup caller folder is excluded; hosted calls use the direct ElevenLabs SIP integration.

Set server-side environment variables through Vercel project settings, never public NEXT_PUBLIC variables:
- ANTHROPIC_API_KEY: existing private value for request understanding.
- CALLY_DEMO_COOKIE_SECRET: generate a fresh random secret of at least 32 characters. Hosted demo credits fail closed without it.
- ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, ELEVENLABS_PHONE_NUMBER_ID: only required when intentionally enabling real calls.
- CALL_LANGUAGE=th.
- LIVE_SHOP_NUMBERS: leave empty for the publicly accessible demonstration. Paid calls have no public-user authorization gate in this snapshot; do not expose the owner's test phone to unrestricted triggering.

Local SQLite data is not uploaded. Hosted credit state uses a signed, HttpOnly, secure cookie, entirely separate from real billing. It travels between Vercel function instances but is browser-specific and does not provide database-level concurrent spending/replay guarantees. Real payments remain disconnected. All debit/U-topia checkout approval is simulated. Uploaded PromptPay QR images are real-recipient references and labeled not to transfer money for the demo. Production monetization needs real account authentication, shared durable storage and verified payment callbacks.

The official U-topia reference is https://u-topia.com/; it is not an implemented provider endpoint. No U-bot spending authorization is claimed.

Validation: production build and hosted-cookie checks passed (state across requests, duplicate approvals/releases, QR alternation, invalid-signature handling and refusal of live-payment mode). No real payments or phone calls were made for deployment preparation.

# Cally caller

Standalone handoff of the Vonage + ElevenLabs caller that completed successful two-way phone conversations.

**Start with [CALLING-HANDOFF.md](CALLING-HANDOFF.md).** It contains exact Windows commands, ngrok/dashboard setup, the existing call endpoint, transcript/event examples, required private configuration, and known limitations.

This repository excludes the Cally frontend and newer queue integration. No real API keys, phone numbers, private keys, populated env files, logs or recordings are included. Use .env.example and supply credentials privately.

Important: the preserved connector explicitly supplies only business_name. The other requested mission variables and a persistent transcript API are not implemented in this snapshot; the handoff documents this clearly.

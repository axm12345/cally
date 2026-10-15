# Cally caller: backend handoff

## Scope and provenance
This package uses the ORIGINAL standalone controller and connector that completed two-way Thai phone conversations on multiple consenting destinations. It excludes the newer UI, Maps discovery, queue and unfinished app integration. No new calls were made during packaging.

The proven connector includes signed-URL authentication, initialization on the correct ElevenLabs socket, ws 7/ws 8 binary handling, business_name, and timer cleanup. Its source and dependency lockfiles are copied unchanged. Calling flow, endpoints, NCCOs and audio behavior are preserved.

Only controller source edits allowed for packaging:
- Replace the fixed private-key filename with `VONAGE_PRIVATE_KEY_PATH`, preserving `./.private.key` as the default.
- Replace the numeric sample WebSocket caller ID with `WEBSOCKET_CALLER_ID` or `SERVICE_PHONE_NUMBER` (not a PSTN destination).
- Replace sample destination strings in comments/startup examples with `DESTINATION_DIGITS`.

See SOURCE-PROVENANCE.json for original hashes and PACKAGING-CHANGES.diff for the sanitized changes (removed numeric examples are redacted). The original source directories and running services were not changed by this task.

Files:
- `controller/voice-to-ai-engines.js`: Express server, Vonage SDK call, NCCO and webhook handlers.
- `controller/start-local-controller.cjs`: forces the controller to port 8001.
- `connector/elevenlabs-agent-ws-connector.cjs`: signed ElevenLabs connection, audio relay and transcript callbacks.
- `local-gateway.cjs`: local port 8000; forwards controller HTTP to 8001 and /socket traffic to 6000.
- Each service has its own package.json and exact lockfile; root package.json supplies convenience commands.
- `agent/`: sanitized snapshot of current hosted behavior settings; reference only, not automatically applied or loaded by the calling code.
- LICENSE files retain upstream Apache-2.0 attribution.

## Windows setup
The successful session used Node **24.22.0**. Node 22 is also allowed by the controller's declared engines, but those successful calls used Node 24. Use npm shipped with Node.

Extract the archive and open PowerShell:

```powershell
cd C:\path\to\cally-caller
npm.cmd run setup
Copy-Item .env.example controller\.env
Copy-Item .env.example connector\.env
```

Fill credentials privately. Both services read .env relative to their own working directory; a root .env alone is NOT used. It is acceptable to copy the union of settings into both files.

Save the matching Vonage application's private key as `controller/.private.key`, or set VONAGE_PRIVATE_KEY_PATH in controller/.env. Relative paths resolve from controller/. Do not regenerate a key unless intentionally updating the application too.

Important settings:
- SERVICE_PHONE_NUMBER: purchased Voice-capable caller ID, digits only; no plus, punctuation or spaces.
- VERIFIED_TEST_NUMBER: one consenting allowed destination, digits only.
- LOCAL_CALL_TOKEN: a new long random secret.
- PROCESSOR_SERVER: public gateway hostname only, no https://, wss:// or trailing slash.
- BUSINESS_NAME: the business name supplied to the agent, process-wide.
- MAX_CALL_DURATION=60 matches the demo's PSTN duration cap.
- Keep RECORD_CALLS=false and RECORD_ALL_AUDIO=false. Recording was not needed for the tested flow. If deliberately enabling it later, create controller/post-call-data and connector/recordings, and configure platform recording capabilities first.
- Leave PORT and VCR_PORT blank for the topology below. The controller wrapper forces 8001; connector defaults to 6000.

In THREE separate PowerShell terminals, each in cally-caller:

```powershell
npm.cmd run start:controller
```

```powershell
npm.cmd run start:connector
```

```powershell
npm.cmd run start:gateway
```

Keep all processes running. Optional syntax validation: `npm.cmd run check`.

## Public URL, ngrok and Vonage dashboard
Vonage needs public HTTPS/WSS access. For the exact local gateway layout:

```powershell
ngrok http 8000
```

ONE public domain routes to local gateway 8000, then to controller 8001 or connector 6000. Exposing only 6000 is insufficient: controller callbacks must also be public.

Put the resulting public hostname in PROCESSOR_SERVER and restart the controller after changing it. The gateway preserves the public Host header. The source derives callback addresses from req.hostname.

In your EXISTING Vonage application:
1. Enable Voice; select an available region.
2. Answer URL: `https://YOUR_PUBLIC_HOST/answer`, HTTP **GET**.
3. Event URL: `https://YOUR_PUBLIC_HOST/event`, HTTP **POST**.
4. Save changes and link the purchased Voice-capable number.
5. Use that same application's APP_ID and matching private key.

RTC `/rtc` is only for optional recording and is not required with recording off.

There is no separate dashboard WebSocket field to configure for this sample. Code builds:

```text
wss://YOUR_PUBLIC_HOST/socket?participant=user1&call_direction=outbound&peer_uuid=CALL_UUID&webhook_url=https://YOUR_PUBLIC_HOST/results
```

and creates a Vonage WebSocket leg with `audio/l16;rate=16000`. Do not change the audio format.

For outbound calls the SDK supplies GET `/answer_2` and POST `/event_2` automatically. Its conference/WebSocket leg uses GET `/ws_answer_2` and POST `/ws_event_2`. Inbound handlers are `/answer`, `/event`, `/ws_answer_1`, `/ws_event_1`; inbound was not separately revalidated for this handoff.

## Start ONE outbound call
Existing endpoint:

```http
GET https://YOUR_PUBLIC_HOST/call?number=DESTINATION_DIGITS
x-local-call-token: YOUR_LOCAL_CALL_TOKEN
```

**Request body: none.** This is GET, not a POST JSON API.
The destination must exactly equal VERIFIED_TEST_NUMBER or the existing guard returns 403. Change that setting and restart the controller to allow a different test phone. This local allowlist is independent of Vonage account verification.

PowerShell example:

```powershell
$publicBase = "https://YOUR_PUBLIC_HOST"
$destination = "DESTINATION_DIGITS"
$headers = @{ "x-local-call-token" = "YOUR_LOCAL_CALL_TOKEN" }
Invoke-WebRequest -Method Get -Uri "$publicBase/call?number=$destination" -Headers $headers
```

Use the PUBLIC URL. Calling through localhost generates unreachable `https://localhost` callbacks because the code derives URLs from the request hostname.

Response: HTTP 200, text `Ok`. This is sent BEFORE Vonage acceptance; it does not prove the call rang or connected. Watch Vonage events/logs.

The `/call` handler's existing SDK operation:

```javascript
vonage.voice.createOutboundCall({
  to: [{ type: 'phone', number: req.query.number }],
  from: { type: 'phone', number: process.env.SERVICE_PHONE_NUMBER },
  limit: process.env.MAX_CALL_DURATION,
  answer_url: ['https://' + req.hostname + '/answer_2'],
  answer_method: 'GET',
  event_url: ['https://' + req.hostname + '/event_2'],
  event_method: 'POST'
});
```

Successful manual tests also invoked this same SDK call pattern directly during troubleshooting. No new paid `/call` trigger test was performed during packaging. The protected HTTP route preserves its existing guard and call-construction behavior.

Your teammate should invoke the endpoint from their SERVER. Never send LOCAL_CALL_TOKEN or provider keys to browser code.

## ElevenLabs settings and per-call information: actual current behavior
Reuse the existing working agent in the workspace authorized by ELEVENLABS_API_KEY:
- Input AND output format: `pcm_16000`.
- Client events: `audio`, `user_transcript`, `agent_response`, `interruption`.
- Agent may remain private. The connector requests `/v1/convai/conversation/get-signed-url`, then opens its signed WebSocket.
- Language, voice, tools, prompts and default dynamic variables live in the ElevenLabs account. API keys do not transfer those settings to another account.

In the connector's ElevenLabs `open` handler, the exact preserved initialization is:

```json
{
  "type": "conversation_initiation_client_data",
  "dynamic_variables": {
    "business_name": "BUSINESS_NAME from env, or Hackathon demo"
  }
}
```

| Agent variable | Explicitly supplied by this tested connector? |
| --- | --- |
| business_name | YES, from env; shared by all calls |
| request_summary | NO |
| constraints | NO |
| questions | NO |
| reference_time | NO |

The HTTP route accepts only number. It cannot yet receive those four mission fields, a JSON mission, or shop metadata. The agent's saved demo defaults may allow a conversation, but are not the customer's actual current requirements. This handoff intentionally does not implement missing per-call transport.

The teammate must add per-call context transport as a separate change if needed. Do not mutate a global agent prompt/BUSINESS_NAME between overlapping calls and assume isolation. Files in agent/ are reference snapshots, not automatic provisioning or a complete new-agent export.

## How to detect completion and obtain transcripts
Identifiers:
- Vonage phone-call UUID: SDK successful-create response printed by controller. `/call` does not return it.
- Vonage WebSocket-leg UUID: a separate leg created after conference transfer.
- ElevenLabs conversation_id: in `conversation_initiation_metadata_event.conversation_id`, printed by the connector's default message branch. It is not returned by /call or persisted/correlated in a database.

Vonage sends started/ringing/answered/completed and failure events to `/event_2`. Illustrative terminal event:

```json
{"uuid":"VONAGE_PHONE_CALL_UUID","status":"completed","duration":"60","detail":"ok"}
```

The handler acknowledges with `Ok` and handles conference transfer, but does NOT persist all status updates or provide polling. Check Vonage Voice logs or ngrok's local inspector at `http://127.0.0.1:4040`. The controller does not console-log every terminal status. `/api/calls/:id` and `/v1/calls/:id` are NOT implemented in this package.

The connector POSTs these actual shapes to controller `/results`:

```json
{"type":"user_transcript","transcript":"Shop's actual words","call_uuid":"VONAGE_PHONE_CALL_UUID"}
```

```json
{"type":"agent_response","response":"Agent's actual words","call_uuid":"VONAGE_PHONE_CALL_UUID"}
```

`/results` only prints the body and acknowledges `Ok`. There is no transcript database, ordered assembly, results API, structured quote extraction or UI push. The teammate needs to store/forward these separately.

To retrieve a completed conversation server-side from ElevenLabs:

```http
GET https://api.elevenlabs.io/v1/convai/conversations/CONVERSATION_ID
xi-api-key: ELEVENLABS_API_KEY
```

Relevant response fields, illustrated:

```json
{
  "conversation_id":"CONVERSATION_ID",
  "status":"done",
  "transcript":[
    {"role":"agent","message":"Question","time_in_call_secs":0},
    {"role":"user","message":"Shop answer","time_in_call_secs":5}
  ],
  "metadata":{"call_duration_secs":60}
}
```

This is an ElevenLabs API example, not an API implemented in this folder. Processing can lag after hangup; an in-progress conversation may not contain a complete transcript.

## Several simultaneous calls?
There is no sequential queue. Multiple accepted triggers can start simultaneous calls in principle, using separate conference names and socket buffers. This was NOT concurrency/load-tested. Provider account limits and ElevenLabs quotas apply. The HTTP guard currently permits only one configured destination, and mission data is process-global/default, not isolated per call.

No idempotency key exists: repeated requests can create repeated paid calls. There is no HTTP cancel endpoint, spending cap, batch orchestration or recovery policy. MAX_CALL_DURATION caps the outbound phone leg. Begin with one consenting test phone.

## Laptop/account dependencies and known limitations
- Laptop, three Node processes and public tunnel must stay running. A changed domain requires updating PROCESSOR_SERVER, callbacks and restarting the controller.
- This gateway binds loopback 8000 and is intended for local use. It is not a turnkey cloud deployment. Running controller directly also defaults to 8000; use the supplied wrapper to avoid collision.
- Teammate needs authorized use of the matching Vonage app/keypair and ElevenLabs agent/workspace, or must configure/test their own.
- Paid accounts need an eligible caller ID. Vonage's trial demo caller ID is not a purchased number and stops being available after adding credit. Trial Voice is restricted to the ORIGINAL sign-up number; additional verified SMS test numbers are not automatically valid Voice recipients.
- VERIFIED_TEST_NUMBER is our local allowlist, not a Vonage verification check.
- A carrier can fail delivery even after reporting ringing. Some destinations worked while another returned unanswered/unavailable.
- Vonage/ElevenLabs/tunnel balances, quotas and permissions apply. Calls can incur charges.
- This original package has NO `CALLY_CALLS_ENABLED` or newer app passcode pause. Its own token/allowlist and valid provider settings are enough to initiate paid calls.
- No Maps API integration or GOOGLE_MAPS_API_KEY usage exists here. The Google key is required privately only if the teammate's separate app uses Places.
- No production-grade signed webhook checks, authenticated WebSocket admission, rate limits or callback idempotency are implemented. Public relay endpoints need further protection before unattended use.
- The connector trusts its WebSocket webhook_url query. It logs transcripts/metadata, and raw SDK errors may contain sensitive request details. Do not share raw logs or signed URLs.
- Callback failures, malformed messages and socket failures do not have comprehensive recovery. Early microphone frames may be dropped before ElevenLabs is ready; audio pacing is the preserved original timer implementation.
- ElevenLabs socket close does not implement robust phone-leg hangup. Keep the duration cap.
- Recording paths are optional and unverified; retain the recording-off defaults. The live-agent-transfer sample is not included.
- Packaging syntax/audit checks are not a new end-to-end phone test or a guarantee of cloud reliability.

## Values to transfer PRIVATELY: names only
Secrets:
- API_KEY
- API_SECRET
- matching Vonage private key FILE (path setting: VONAGE_PRIVATE_KEY_PATH)
- ELEVENLABS_API_KEY
- LOCAL_CALL_TOKEN (prefer generating a fresh one)

Account/configuration values:
- APP_ID
- SERVICE_PHONE_NUMBER
- ELEVENLABS_AGENT_ID
- VERIFIED_TEST_NUMBER (consenting test destination)
- BUSINESS_NAME
- PROCESSOR_SERVER (teammate's public hostname)

Only if separately needed by their app:
- GOOGLE_MAPS_API_KEY
- ELEVENLABS_VOICE_ID

Enter secrets directly into hosting settings or use an authorized private password-manager transfer. Never commit populated env files/private keys or send them in a GitHub issue.

## Instruction to the teammate's AI
Read this document first. Preserve these files as the known-working calling reference. Connect your app from server routes. Do not assume per-call mission transport, a transcript API, quote extraction, cloud deployment or concurrency validation already exists. Those are separate integration tasks, not capabilities of this snapshot.

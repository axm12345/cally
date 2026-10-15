'use strict'

//-- Cally additions: per-call mission, call IDs, status and transcript for the Cally app.
//-- Kept in this file so the tested call flow in voice-to-ai-engines.js stays as it was.

const crypto = require('crypto');

const MISSION_KEYS = ['business_name', 'request_summary', 'constraints', 'questions', 'reference_time'];
const MAX_CALLS_KEPT = 200;

const calls = new Map();   // cally id -> call record
const byUuid = new Map();  // Vonage PSTN leg uuid -> cally id

const digits = (v) => String(v || '').replace(/\D/g, '');

// VERIFIED_TEST_NUMBER may hold several comma-separated numbers (digits only).
const allowedNumbers = () => (process.env.VERIFIED_TEST_NUMBER || '').split(',').map(digits).filter(Boolean);
const isAllowed = (number) => allowedNumbers().includes(digits(number));

const authed = (req) => !!process.env.LOCAL_CALL_TOKEN && req.get('x-local-call-token') === process.env.LOCAL_CALL_TOKEN;

const findCall = (id, uuid) => calls.get(id) || calls.get(byUuid.get(uuid));

function mount(app, { vonage, servicePhoneNumber, maxCallDuration }) {

  //-- Start one outbound call with its mission. Body: { number, business_name, request_summary, constraints, questions, reference_time }
  app.post('/calls', async (req, res) => {
    if (!authed(req)) return res.sendStatus(403);
    const number = digits(req.body && req.body.number);
    if (!isAllowed(number)) return res.status(403).json({ error: 'number is not on VERIFIED_TEST_NUMBER' });

    const mission = {};
    for (const key of MISSION_KEYS) {
      const value = req.body[key];
      if (typeof value === 'string' && value.trim()) mission[key] = value.trim().slice(0, 300);
    }
    if (['en', 'th', 'yue'].includes(req.body.language)) mission.language = req.body.language;

    const id = crypto.randomUUID();
    const call = { id, status: 'ringing', transcript: [], conversation_id: null, uuid: null, answeredAt: null, endedAt: null, mission };
    calls.set(id, call);
    if (calls.size > MAX_CALLS_KEPT) calls.delete(calls.keys().next().value);

    const hostName = req.hostname;
    try {
      const out = await vonage.voice.createOutboundCall({
        to: [{ type: 'phone', number }],
        from: { type: 'phone', number: servicePhoneNumber },
        limit: maxCallDuration,
        answer_url: ['https://' + hostName + '/answer_2?cally_id=' + id],
        answer_method: 'GET',
        event_url: ['https://' + hostName + '/event_2?cally_id=' + id],
        event_method: 'POST'
      });
      call.uuid = out.uuid;
      byUuid.set(out.uuid, id);
      console.log('>>> Cally call started:', id);
      res.json({ id });
    } catch (err) {
      call.status = 'failed';
      call.endedAt = Date.now();
      console.error('>>> Cally call failed to start:', id, err && err.message);
      res.status(502).json({ error: 'call failed to start' });
    }
  });

  //-- Status and transcript of one call.
  app.get('/calls/:id', (req, res) => {
    if (!authed(req)) return res.sendStatus(403);
    const call = calls.get(req.params.id);
    if (!call) return res.sendStatus(404);
    const end = call.endedAt || Date.now();
    res.json({
      status: call.status,
      ended: !!call.endedAt,
      duration_secs: call.answeredAt ? Math.round((end - call.answeredAt) / 1000) : 0,
      transcript: call.transcript,
      conversation_id: call.conversation_id
    });
  });
}

//-- Vonage events for the PSTN leg (from /event_2).
function onEvent(id, body) {
  const call = findCall(id, body && body.uuid);
  if (!call || call.endedAt) return;
  if (body.uuid && !call.uuid) {
    call.uuid = body.uuid;
    byUuid.set(body.uuid, call.id);
  }
  switch (body.status) {
    case 'started':
    case 'ringing':
      if (!call.answeredAt) call.status = 'ringing';
      break;
    case 'answered':
      call.status = 'talking';
      call.answeredAt = Date.now();
      break;
    case 'completed':
      call.status = call.answeredAt ? 'ended' : 'no_answer';
      call.endedAt = Date.now();
      break;
    case 'busy':
    case 'timeout':
    case 'unanswered':
    case 'rejected':
    case 'cancelled':
      call.status = 'no_answer';
      call.endedAt = Date.now();
      break;
    case 'failed':
      call.status = 'failed';
      call.endedAt = Date.now();
      break;
  }
}

//-- Extra query parameters for the connector WebSocket, so the agent gets this call's mission.
function wsParams(id) {
  const call = calls.get(id);
  if (!call) return '';
  return '&cally_id=' + encodeURIComponent(id) + [...MISSION_KEYS, 'language']
    .filter((key) => call.mission[key])
    .map((key) => '&' + key + '=' + encodeURIComponent(call.mission[key]))
    .join('');
}

//-- Transcript lines and conversation id posted by the connector (to /results).
function onResult(body) {
  if (!body) return;
  const call = findCall(body.cally_id, body.call_uuid);
  if (!call) return;
  if (body.type === 'user_transcript' && body.transcript) call.transcript.push({ speaker: 'shop', text: String(body.transcript) });
  if (body.type === 'agent_response' && body.response) call.transcript.push({ speaker: 'agent', text: String(body.response) });
  if (body.type === 'conversation' && body.conversation_id) call.conversation_id = String(body.conversation_id);
}

module.exports = { mount, onEvent, wsParams, onResult, isAllowed };

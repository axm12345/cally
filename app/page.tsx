"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CURRENT_LOCATION_AREA,
  DEFAULT_HOME_AREA,
  EXAMPLE_REQUEST,
  NOT_MENTIONED,
  homeLabel,
  formatPrice,
  formatReady,
  getRequestSummary,
  rankResults,
  startCalls,
  type CallStatus,
  type RequestSummary,
  type ShopResult,
} from "@/lib/shops";
import * as I from "@/components/icons";

type Screen = "speak" | "confirm" | "calling" | "options" | "details";

const STATUS_LABEL: Record<CallStatus, string> = {
  done: "Got a price",
  talking: "Talking…",
  ringing: "Ringing…",
  no_answer: "No answer",
  no_price: "No price given",
  failed: "Couldn't connect",
};

const CALL_TIMEOUT_MS = 180_000;

export default function Page() {
  const [screen, setScreen] = useState<Screen>("speak");
  const [transcript, setTranscript] = useState("");
  const [summary, setSummary] = useState<RequestSummary | null>(null);
  const [results, setResults] = useState<ShopResult[]>([]);
  const [selected, setSelected] = useState<ShopResult | null>(null);
  const [homeArea, setHomeArea] = useState(DEFAULT_HOME_AREA);
  const [error, setError] = useState<string | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => () => cancelRef.current?.(), []);

  const submitTranscript = useCallback(async (text: string) => {
    setTranscript(text);
    setError(null);
    try {
      const s = await getRequestSummary(text);
      // A place named in the spoken request wins; otherwise use the home area.
      setSummary({ ...s, near: s.near.trim() || homeArea });
      setScreen("confirm");
    } catch (err) {
      console.error(err);
      setError("Couldn't read that request. Check the server log and try again.");
    }
  }, [homeArea]);

  const beginCalling = () => {
    if (!summary || summary.fix === NOT_MENTIONED) return;
    setScreen("calling");
    let timeout: ReturnType<typeof setTimeout>;
    const finish = () => {
      clearTimeout(timeout);
      setScreen((s) => (s === "calling" ? "options" : s));
    };
    const cancel = startCalls(summary, setResults, finish);
    timeout = setTimeout(finish, CALL_TIMEOUT_MS);
    cancelRef.current = () => {
      clearTimeout(timeout);
      cancel();
    };
  };

  const stopCalling = (next: Screen) => {
    cancelRef.current?.();
    cancelRef.current = null;
    setScreen(next);
  };

  return (
    <main className="app">
      {screen === "speak" && <Speak onTranscript={submitTranscript} error={error} homeArea={homeArea} onHomeArea={setHomeArea} />}
      {screen === "confirm" && summary && (
        <Confirm
          transcript={transcript}
          summary={summary}
          onBack={() => setScreen("speak")}
          onYes={beginCalling}
        />
      )}
      {screen === "calling" && (
        <Calling
          results={results}
          onShow={() => stopCalling("options")}
          onCancel={() => stopCalling("speak")}
        />
      )}
      {screen === "options" && (
        <Options
          results={results}
          onClose={() => setScreen("speak")}
          onOpen={(s) => {
            setSelected(s);
            setScreen("details");
          }}
        />
      )}
      {screen === "details" && selected && (
        <Details
          shop={selected}
          onBack={() => setScreen("options")}
        />
      )}
    </main>
  );
}

/* ---------- 1 · Speak ---------- */

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function Speak({
  onTranscript,
  error,
  homeArea,
  onHomeArea,
}: {
  onTranscript: (t: string) => void;
  error: string | null;
  homeArea: string;
  onHomeArea: (area: string) => void;
}) {
  const [sheet, setSheet] = useState(false);
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  // UI-only states: reading the request after speech, or nothing was heard.
  const [thinking, setThinking] = useState(false);
  const [missed, setMissed] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const gotRef = useRef(false);

  useEffect(() => {
    if (error) setThinking(false);
  }, [error]);

  const submit = (t: string) => {
    setListening(false);
    setThinking(true);
    onTranscript(t);
  };

  const toggleMic = () => {
    if (thinking) return;
    setMissed(false);
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const Ctor = (window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec })
      .SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition?: new () => SpeechRec }).webkitSpeechRecognition;
    if (!Ctor) {
      // No speech-to-text in this browser: use the example so the flow stays demoable.
      submit(EXAMPLE_REQUEST);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = false;
    gotRef.current = false;
    rec.onresult = (e) => {
      gotRef.current = true;
      submit(e.results[0][0].transcript);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      if (!gotRef.current) {
        setMissed(true);
        setTyping(true);
      }
    };
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  return (
    <section className="screen">
      <div className="glow" style={{ top: 230, left: 45 }} />
      <div className="topbar">
        <button className="pill glass" onClick={() => setSheet(true)} aria-haspopup="dialog">
          <I.Home size={18} />{homeLabel(homeArea)}
        </button>
      </div>
      {sheet && (
        <AreaSheet
          current={homeArea}
          onPick={(area) => {
            onHomeArea(area);
            setSheet(false);
          }}
          onClose={() => setSheet(false)}
        />
      )}

      <div className="speak-body">
        <h1>What needs fixing?</h1>
        <p className="sub">Just say it. I&apos;ll find the cheapest shop.</p>
        <div className={`mic-ring glass ${listening ? "live" : ""} ${thinking ? "busy" : ""}`}>
          <button
            className="mic-btn"
            onClick={toggleMic}
            disabled={thinking}
            aria-label={listening ? "Stop listening" : "Start talking"}
          >
            {listening ? <I.Stop size={56} /> : <I.Mic size={72} />}
          </button>
        </div>
        <div className="mic-help" aria-live="polite">
          <b>{thinking ? "Got it" : listening ? "Listening…" : missed ? "I didn't catch that" : "Tap once, then talk"}</b>
          <p>
            {thinking
              ? "Reading your request…"
              : listening
                ? "Talk now. Tap the square when you're done."
                : missed
                  ? "Tap to try again, or type it below."
                  : "No need to hold it. I stop when you pause."}
          </p>
        </div>
        {error && <p role="alert" style={{ color: "var(--warn, #b3261e)", fontSize: 14 }}>{error}</p>}
        {!listening && !thinking && (
          <p className="example">Try: <i>&ldquo;{EXAMPLE_REQUEST}&rdquo;</i></p>
        )}
      </div>

      {typing ? (
        <form
          className="type-box"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !thinking) submit(text.trim());
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs fixing?"
            aria-label="Describe what needs fixing"
          />
          <button className="btn btn-primary sm" type="submit">Go</button>
        </form>
      ) : (
        <button className="btn btn-secondary" onClick={() => setTyping(true)}>
          <I.Keyboard size={20} />Type instead
        </button>
      )}
    </section>
  );
}

function AreaSheet({
  current,
  onPick,
  onClose,
}: {
  current: string;
  onPick: (area: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [locating, setLocating] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const useLocation = () => {
    if (!navigator.geolocation) return setNote("This browser can't share your location.");
    setLocating(true);
    setNote(null);
    navigator.geolocation.getCurrentPosition(
      () => onPick(CURRENT_LOCATION_AREA),
      () => {
        setLocating(false);
        setNote("Couldn't get your location. Type an area instead.");
      },
      { timeout: 10_000 },
    );
  };

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Choose your area" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <b>Where should I look?</b>
          <button className="round" onClick={onClose} aria-label="Close"><I.Close size={20} /></button>
        </div>
        <button className="btn btn-secondary" onClick={useLocation} disabled={locating}>
          <I.Pin size={20} />{locating ? "Finding you…" : "Use my current location"}
        </button>
        {note && <p role="alert" className="sheet-note">{note}</p>}
        <form
          className="type-box"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onPick(text.trim().slice(0, 80));
          }}
        >
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type an area"
            aria-label="Type a different area"
          />
          <button className="btn btn-primary sm" type="submit">Set</button>
        </form>
      </div>
    </div>
  );
}

/* ---------- 2 · Confirm ---------- */

function Confirm({
  transcript,
  summary,
  onBack,
  onYes,
}: {
  transcript: string;
  summary: RequestSummary;
  onBack: () => void;
  onYes: () => void;
}) {
  const listen = () => {
    if (!("speechSynthesis" in window)) return;
    const line = `I'll ask nearby shops: ${summary.fix}, ${summary.device}, ${summary.when}, near ${summary.near}.`;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(line));
  };
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const fixMissing = summary.fix === NOT_MENTIONED;
  const deviceMissing = summary.device === NOT_MENTIONED;

  const rows: [string, string][] = [
    ["Fix", summary.fix],
    ["Device", summary.device],
    ["When", summary.when],
    ["Near", summary.near],
  ];

  return (
    <section className="screen">
      <div className="glow" style={{ top: -80, right: -90 }} />
      <div className="topbar" style={{ justifyContent: "flex-start" }}>
        <button className="round glass" onClick={onBack} aria-label="Back"><I.Back size={22} /></button>
      </div>
      <h1 style={{ marginTop: 18 }}>Is this right?</h1>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">YOU SAID</div>
        <p className="confirm-quote">&ldquo;{transcript}&rdquo;</p>
      </div>

      <div className="summary glass">
        <div className="summary-head">
          <span className="eyebrow" style={{ color: "var(--accent)" }}>I&apos;LL ASK NEARBY SHOPS</span>
          <button className="listen" onClick={listen}><I.Speaker size={16} />Listen</button>
        </div>
        {rows.map(([k, v]) => (
          <div className="row" key={k}><span>{k}</span><b>{v}</b></div>
        ))}
      </div>

      {fixMissing && <p role="alert" className="warn-note">I didn&apos;t catch what needs fixing. Say it again?</p>}
      {!fixMissing && deviceMissing && (
        <p className="warn-note">Shops may need the model for a price. Continue anyway?</p>
      )}

      <div className="spacer" />
      <div className="stack">
        <button className="btn btn-primary" onClick={onYes} disabled={fixMissing} style={fixMissing ? { opacity: 0.5 } : undefined}><I.Check size={22} />Yes, find me a shop</button>
        <button className="btn btn-secondary" onClick={onBack}><I.Mic size={20} />No, say it again</button>
      </div>
    </section>
  );
}

/* ---------- 3 · Calling ---------- */

function Calling({
  results,
  onShow,
  onCancel,
}: {
  results: ShopResult[];
  onShow: () => void;
  onCancel: () => void;
}) {
  return (
    <section className="screen">
      <div className="glow" style={{ top: 20, left: 45 }} />
      <div className="calling-hero">
        <div className="ring b" />
        <div className="ring a" />
        <div className="phone-dot"><I.Phone size={44} /></div>
      </div>
      <div className="center">
        <h1 style={{ fontSize: 28 }}>Calling shops for you</h1>
        <p className="sub" style={{ fontSize: 16 }}>About a minute. You can put your phone down.</p>
      </div>

      <div className="card shop-list" aria-live="polite">
        {results.map((r) => (
          <div className="shop-row" key={r.shop_name}>
            <span>{r.shop_name}</span>
            <span className={`st ${r.status}`}>{STATUS_LABEL[r.status]}</span>
          </div>
        ))}
      </div>

      <div className="spacer" />
      <div className="stack">
        <button className="btn btn-glass glass" onClick={onShow}>Show results</button>
        <button className="btn-text" onClick={onCancel}>Cancel</button>
      </div>
    </section>
  );
}

/* ---------- 4 · Options ---------- */

function Options({
  results,
  onClose,
  onOpen,
}: {
  results: ShopResult[];
  onClose: () => void;
  onOpen: (s: ShopResult) => void;
}) {
  const { answered, leftOut } = rankResults(results);
  const [top, ...rest] = answered;

  return (
    <section className="screen">
      <div className="glow" style={{ top: 120, left: 40 }} />
      <div className="topbar">
        <button className="round glass" onClick={onClose} aria-label="Close"><I.Close size={22} /></button>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>
          {answered.length} {answered.length === 1 ? "shop" : "shops"} answered
        </span>
      </div>
      <div className="scroll">
      <h1 style={{ marginTop: 18 }}>Cheapest first</h1>

      {!top ? (
        <p className="sub">No shop picked up yet. Try again in a moment.</p>
      ) : (
        <>
          <div className="top-pick glass">
            <div className="pick-head">
              <button onClick={() => onOpen(top)} style={{ textAlign: "left" }}>
                <h2>{top.shop_name}</h2>
              </button>
              <span className="badge">CHEAPEST</span>
            </div>
            <div className="stats">
              <div className="stat"><b className="green">{formatPrice(top.price_thb, top.price_is_estimate)}</b><small>Price</small></div>
              <div className="stat"><b>{top.distance_km} km</b><small>From home</small></div>
              <div className="stat"><b>{formatReady(top).text}</b><small>{top.available_today ? "Ready today" : "Ready"}</small></div>
            </div>
            <CallShopButton shop={top} small />
            <button className="see-call" onClick={() => onOpen(top)}>See call</button>
          </div>

          <div className="stack" style={{ marginTop: 14 }}>
            {rest.map((r) => {
              const ready = formatReady(r);
              return (
                <button className="opt-row" key={r.shop_name} onClick={() => onOpen(r)}>
                  <span className="name">{r.shop_name}</span>
                  <span className="price">{formatPrice(r.price_thb, r.price_is_estimate)}</span>
                  <span className="dim">{r.distance_km} km</span>
                  <span className={ready.late ? "late" : ""}>{r.available_today ? `Today ${ready.text}` : ready.text}</span>
                </button>
              );
            })}
          </div>
        </>
      )}

      {leftOut > 0 && (
        <p className="foot-note">
          {leftOut} {leftOut === 1 ? "shop" : "shops"} didn&apos;t pick up, so {leftOut === 1 ? "it's" : "they're"} left out.
        </p>
      )}
      </div>
    </section>
  );
}

function CallShopButton({ shop, small }: { shop: ShopResult; small?: boolean }) {
  return (
    <a className={`btn btn-primary ${small ? "sm" : ""}`} href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`}>
      <I.Phone size={20} />Call this shop
    </a>
  );
}

/* ---------- 5 · Call details ---------- */

function Details({
  shop,
  onBack,
}: {
  shop: ShopResult;
  onBack: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ready = formatReady(shop);

  const togglePlay = () => {
    if (!shop.recording_url) {
      // Mock data has no recording; just flip the control so the UI can be reviewed.
      setPlaying((p) => !p);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(shop.recording_url);
      audioRef.current.onended = () => setPlaying(false);
    }
    if (playing) audioRef.current.pause();
    else void audioRef.current.play();
    setPlaying(!playing);
  };
  useEffect(() => () => audioRef.current?.pause(), []);

  return (
    <section className="screen">
      <div className="glow" style={{ top: 360, left: -60 }} />
      <div className="topbar" style={{ justifyContent: "flex-start", gap: 12 }}>
        <button className="round glass" onClick={onBack} aria-label="Back"><I.Back size={22} /></button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{shop.shop_name}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Call · {shop.duration} · completed</div>
        </div>
      </div>

      <div className="scroll">
      <div className="chips">
        <span className="chip g">{formatPrice(shop.price_thb, shop.price_is_estimate)}</span>
        <span className="chip">{shop.distance_km} km from home</span>
        <span className={`chip ${ready.late ? "w" : ""}`}>
          {shop.available_today ? `Ready today ${ready.text}` : `Ready ${ready.text.toLowerCase()}`}
        </span>
      </div>

      <div className="safe"><I.Shield size={18} />The assistant said it was calling for a customer.</div>

      <div className="chat">
        {shop.transcript.map((l, i) => (
          <div key={i} className={`bubble ${l.speaker}`}>{l.text}</div>
        ))}
      </div>
      </div>

      <div className="bar glass">
        <button className="play" onClick={togglePlay} aria-label={playing ? "Pause recording" : "Play recording"}>
          {playing ? <I.Pause size={22} /> : <I.Play size={22} />}
        </button>
        <CallShopButton shop={shop} small />
      </div>
    </section>
  );
}

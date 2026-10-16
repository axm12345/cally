"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_HOME_AREA, EXAMPLE_REQUEST, NOT_MENTIONED, homeLabel, formatPrice, formatReady, getRequestSummary, rankResults, startCalls, type CallStatus, type RequestSummary, type ShopResult, } from "@/lib/shops";
import { PreferencesProvider, Settings, usePreferences } from "@/components/preferences";
import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/location-map";
const LocationMap = dynamic(() => import("@/components/location-map"), { ssr: false });
import { SearchCreditsProvider, useSearchCredits } from "@/components/search-credits";
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
const CALL_TIMEOUT_MS = 180000;
function CallyPage() {
    const { t, uiLanguage } = usePreferences();
    const { voiceLanguage } = usePreferences();
    const credits = useSearchCredits();
    const [starting, setStarting] = useState(false);
    const [creditNotice, setCreditNotice] = useState("");
    const reservationRef = useRef<string | null>(null);
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
        }
        catch (err) {
            console.error(err);
            setError(t("Couldn't read that request. Check the server log and try again."));
        }
    }, [homeArea]);
    const beginCalling = async () => {
        if (starting || !summary || summary.fix === NOT_MENTIONED)
            return;
        setStarting(true);
        const reservation = await credits.reserve();
        setStarting(false);
        if (!reservation) return;
        reservationRef.current = reservation;
        setCreditNotice("");
        setScreen("calling");
        let timeout: ReturnType<typeof setTimeout>;
        const finish = () => {
            clearTimeout(timeout);
            const id = reservationRef.current; reservationRef.current = null;
            if (id) void credits.release(id).then(() => setCreditNotice(uiLanguage === "th" ? "คืนเครดิตทดลองแล้ว · ไม่คิดเงินจากราคาจำลอง" : uiLanguage === "yue" ? "已退回示範額度 · 唔會按模擬報價收費" : "Demo credit returned · mock quotes are never billed")).catch(() => setCreditNotice(uiLanguage === "th" ? "เครดิตที่สำรองไว้จะคืนอัตโนมัติภายใน 10 นาที" : uiLanguage === "yue" ? "預留額度會喺十分鐘內自動退回" : "Reserved credit will be released after 10 minutes"));
            setScreen((s) => (s === "calling" ? "options" : s));
        };
        const cancel = startCalls(summary, setResults, finish, voiceLanguage);
        timeout = setTimeout(finish, CALL_TIMEOUT_MS);
        cancelRef.current = () => {
            clearTimeout(timeout);
            const id = reservationRef.current; reservationRef.current = null;
            if (id) void credits.release(id).catch(() => {});
            cancel();
        };
    };
    const stopCalling = (next: Screen) => {
        cancelRef.current?.();
        cancelRef.current = null;
        setScreen(next);
    };
    return (<main className="app">
      <Settings />
      {creditNotice && screen === "options" && <div className="credit-result-note" role="status">{creditNotice}</div>}
      {screen === "speak" && <Speak onTranscript={submitTranscript} error={error} homeArea={homeArea} onHomeArea={setHomeArea}/>}
      {screen === "confirm" && summary && (<Confirm transcript={transcript} summary={summary} onBack={() => setScreen("speak")} onYes={() => { void beginCalling(); }} starting={starting}/>)}
      {screen === "calling" && (<Calling results={results} onShow={() => stopCalling("options")} onCancel={() => stopCalling("speak")}/>)}
      {screen === "options" && (<Options results={results} onClose={() => setScreen("speak")} onOpen={(s) => {
                setSelected(s);
                setScreen("details");
            }}/>)}
      {screen === "details" && selected && (<Details shop={selected} onBack={() => setScreen("options")}/>)}
    </main>);
}
/* ---------- 1 · Speak ---------- */
type SpeechRec = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onspeechstart: (() => void) | null;
    onspeechend: (() => void) | null;
    onresult: ((e: {
        results: ArrayLike<ArrayLike<{
            transcript: string;
        }>>;
    }) => void) | null;
    onerror: (() => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};
function Speak({ onTranscript, error, homeArea, onHomeArea, }: {
    onTranscript: (t: string) => void;
    error: string | null;
    homeArea: string;
    onHomeArea: (area: string) => void;
}) {
    const { t, uiLanguage } = usePreferences();
    const [sheet, setSheet] = useState(false);
    const [listening, setListening] = useState(false);
    const [typing, setTyping] = useState(false);
    const [text, setText] = useState("");
    // UI-only states: reading the request after speech, or nothing was heard.
    const [thinking, setThinking] = useState(false);
    const [missed, setMissed] = useState(false);
    const recRef = useRef<SpeechRec | null>(null);
    const gotRef = useRef(false);
    const pauseRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const finishRef = useRef<(() => void) | null>(null);
    useEffect(() => () => {
        if (pauseRef.current) clearTimeout(pauseRef.current);
        finishRef.current = null;
        const rec = recRef.current;
        if (rec) { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.onspeechstart = null; rec.onspeechend = null; rec.stop(); }
    }, []);
    useEffect(() => {
        if (error)
            setThinking(false);
    }, [error]);
    const submit = (t: string) => {
        setListening(false);
        setThinking(true);
        onTranscript(t);
    };
    const toggleMic = () => {
        if (thinking)
            return;
        setMissed(false);
        if (listening) {
            finishRef.current?.();
            return;
        }
        const Ctor = (window as unknown as {
            SpeechRecognition?: new () => SpeechRec;
            webkitSpeechRecognition?: new () => SpeechRec;
        })
            .SpeechRecognition ?? (window as unknown as {
            webkitSpeechRecognition?: new () => SpeechRec;
        }).webkitSpeechRecognition;
        if (!Ctor) {
            // No speech-to-text in this browser: use the example so the flow stays demoable.
            submit(EXAMPLE_REQUEST);
            return;
        }
        const rec = new Ctor();
        rec.lang = uiLanguage === "th" ? "th-TH" : uiLanguage === "yue" ? "yue-HK" : "en-US";
        // Keep collecting speech across short pauses; submit only after 1.8 seconds of quiet.
        rec.interimResults = true;
        rec.continuous = true;
        gotRef.current = false;
        let completed = false;
        let pending = "";
        let previousSession = "";
        const clearPause = () => {
            if (pauseRef.current) clearTimeout(pauseRef.current);
            pauseRef.current = null;
        };
        const finish = () => {
            if (completed) return;
            completed = true;
            clearPause();
            finishRef.current = null;
            rec.stop();
            setListening(false);
            if (pending.trim()) submit(pending.trim());
            else { setMissed(true); setTyping(true); }
        };
        const waitForPause = () => {
            clearPause();
            if (pending.trim()) pauseRef.current = setTimeout(finish, 1800);
        };
        finishRef.current = finish;
        rec.onspeechstart = clearPause;
        rec.onspeechend = waitForPause;
        rec.onresult = (e) => {
            if (completed) return;
            pending = [previousSession, Array.from(e.results, result => result[0].transcript).join(" ")].filter(Boolean).join(" ");
            gotRef.current = !!pending.trim();
            waitForPause();
        };
        rec.onerror = () => {
            if (completed) return;
            completed = true;
            clearPause();
            finishRef.current = null;
            setListening(false);
            setText(pending.trim());
            setMissed(true);
            setTyping(true);
        };
        rec.onend = () => {
            if (completed) return;
            if (!pending.trim()) { finish(); return; }
            // Some browsers end recognition on their own. Preserve the text and
            // restart during the grace period so a resumed sentence is included.
            previousSession = pending;
            if (!pauseRef.current) waitForPause();
            try { rec.start(); } catch { /* Existing pause timer will finish safely. */ }
        };
        recRef.current = rec;
        setListening(true);
        try { rec.start(); } catch { rec.onerror?.(); }
    };
    return (<section className="screen">
      <div className="glow" style={{ top: 230, left: 45 }}/>
      <div className="topbar">
        <button className="pill glass area" onClick={() => setSheet(true)} aria-haspopup="dialog">
          {homeArea === DEFAULT_HOME_AREA ? <I.Home size={18}/> : <I.Pin size={18}/>}
          <span>{t(homeLabel(homeArea))}</span>
        </button>
        <span className="brand">CALLY</span>
      </div>
      {sheet && (<AreaSheet current={homeArea} onPick={(area) => {
                onHomeArea(area);
                setSheet(false);
            }} onClose={() => setSheet(false)}/>)}

      <div className="speak-body">
        <h1>{t("What needs fixing?")}</h1>
        <p className="sub">{t("Just say it. I'll find the cheapest shop.")}</p>
        <div className={`mic-ring glass ${listening ? "live" : ""} ${thinking ? "busy" : ""}`}>
          <button className="mic-btn" onClick={toggleMic} disabled={thinking} aria-label={listening ? t("Stop listening") : t("Start talking")}>
            {listening ? <I.Stop size={56}/> : <I.Mic size={72}/>}
          </button>
        </div>
        <div className="mic-help" aria-live="polite">
          <b>{thinking ? t("Got it") : listening ? t("Listening\u2026") : missed ? t("I didn't catch that") : t("Tap once, then talk")}</b>
          <p>
            {thinking
            ? t("Reading your request\u2026") : listening
            ? t("Talk now. Tap the square when you're done.") : missed
            ? t("Tap to try again, or type it below.") : t("No need to hold it. I stop when you pause.")}
          </p>
        </div>
        {error && <p role="alert" style={{ color: "var(--warn, #b3261e)", fontSize: 14 }}>{error}</p>}
        {!listening && !thinking && (<p className="example">{t("Try:")}<i>&ldquo;{t(EXAMPLE_REQUEST)}&rdquo;</i></p>)}
      </div>

      {typing ? (<form className="type-box" onSubmit={(e) => {
                e.preventDefault();
                if (text.trim() && !thinking)
                    submit(text.trim());
            }}>
          <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t("What needs fixing?")} aria-label={t("Describe what needs fixing")}/>
          <button className="btn btn-primary sm" type="submit">{t("Go")}</button>
        </form>) : (<button className="btn btn-secondary" onClick={() => setTyping(true)}>
          <I.Keyboard size={20}/>{t("Type instead")}</button>)}
    </section>);
}
/** A short place name for a position or typed text, via /api/place. Null if it can't be named. */
async function placeName(body: {
    lat: number;
    lon: number;
} | {
    text: string;
}): Promise<string | null> {
    try {
        const res = await fetch("/api/place", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
        });
        if (!res.ok)
            return null;
        const { label } = await res.json();
        return typeof label === "string" && label.trim() ? label.trim() : null;
    }
    catch {
        return null;
    }
}
function AreaSheet({ current, onPick, onClose, }: {
    current: string;
    onPick: (area: string) => void;
    onClose: () => void;
}) {
    const { t, uiLanguage } = usePreferences();
    const [text, setText] = useState("");
    const [showMap, setShowMap] = useState(false);
    const [radiusKm, setRadiusKm] = useState(5);
    useEffect(() => { try { const saved = Number(localStorage.getItem("cally-radius-km")); if (Number.isInteger(saved) && saved >= 1 && saved <= 20) setRadiusKm(saved); } catch {} }, []);
    const [locating, setLocating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [note, setNote] = useState<string | null>(null);
    const useLocation = () => {
        if (!navigator.geolocation)
            return setNote(t("This browser can't share your location."));
        setLocating(true);
        setNote(null);
        navigator.geolocation.getCurrentPosition(async (pos) => {
            const label = await placeName({ lat: pos.coords.latitude, lon: pos.coords.longitude });
            if (label)
                return onPick(label);
            setLocating(false);
            setNote(t("Found you, but couldn't name the street. Type an area instead."));
        }, () => {
            setLocating(false);
            setNote(t("Couldn't get your location. Type an area instead."));
        }, { timeout: 10000, enableHighAccuracy: true });
    };
    const setMapPoint = async (point: MapPoint) => {
        setSaving(true);
        setNote(null);
        const label = await placeName(point);
        if (!label) { setSaving(false); setNote(t("Could not name this point. Try a nearby street or type an area.")); return; }
        try { localStorage.setItem("cally-map-point", JSON.stringify({ ...point, label })); } catch {}
        onPick(label);
    };
    const setTyped = async (typed: string) => {
        setSaving(true);
        onPick((await placeName({ text: typed })) ?? typed);
    };
    return (<div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label={t("Choose your area")} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div className="area-heading"><b>{t("Where should I look?")}</b><button type="button" className="map-opener" aria-label={t("Choose on map")} aria-expanded={showMap} aria-controls="location-map-picker" onClick={() => setShowMap(value => !value)}><svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/></svg></button></div>
          <button className="round" onClick={onClose} aria-label={t("Close")}><I.Close size={20}/></button>
        </div>
        <div className="radius-picker">
          <label htmlFor="shop-radius"><span>{t("Search radius")}</span><output htmlFor="shop-radius">{radiusKm} {uiLanguage === "th" ? "กม." : uiLanguage === "yue" ? "公里" : "km"}</output></label>
          <input id="shop-radius" type="range" min="1" max="20" step="1" value={radiusKm} aria-label={t("Search radius")} aria-valuetext={radiusKm + " km"} onChange={e => { const radius = Number(e.target.value); setRadiusKm(radius); try { localStorage.setItem("cally-radius-km", String(radius)); } catch {} }}/>
          <div className="radius-scale"><span>1 km</span><span>20 km</span></div>
          <small>{t("Straight-line distance from the selected location.")}</small>
        </div>
        <button className="btn btn-secondary" onClick={useLocation} disabled={locating}>
          <I.Pin size={20}/>{locating ? t("Finding you\u2026") : t("Use my current location")}
        </button>
        {showMap && <div id="location-map-picker"><LocationMap onConfirm={setMapPoint} saving={saving} radiusKm={radiusKm} /></div>}
        {note && <p role="alert" className="sheet-note">{note}</p>}
        <form className="type-box" onSubmit={(e) => {
            e.preventDefault();
            if (text.trim() && !saving)
                void setTyped(text.trim().slice(0, 80));
        }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Type an area")} aria-label={t("Type a different area")} disabled={saving}/>
          <button className="btn btn-primary sm" type="submit" disabled={saving}>{saving ? "…" : t("Set")}</button>
        </form>
      </div>
    </div>);
}
/* ---------- 2 · Confirm ---------- */
function Confirm({ transcript, summary, onBack, onYes, starting, }: {
    transcript: string;
    summary: RequestSummary;
    onBack: () => void;
    onYes: () => void;
    starting: boolean;
}) {
    const { t, uiLanguage } = usePreferences();
    const listen = () => {
        if (!("speechSynthesis" in window))
            return;
        const line = uiLanguage === "yue" ? `我會問附近嘅舖頭：${summary.fix}，${summary.device}，${summary.when}，喺 ${summary.near} 附近。` : uiLanguage === "th" ? `ฉันจะถามร้านใกล้คุณเรื่อง ${summary.fix} ${summary.device} ${summary.when} แถว ${summary.near}` : `I'll ask nearby shops: ${summary.fix}, ${summary.device}, ${summary.when}, near ${summary.near}.`;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(line);
        utterance.lang = uiLanguage === "th" ? "th-TH" : uiLanguage === "yue" ? "yue-HK" : "en-US";
        window.speechSynthesis.speak(utterance);
    };
    useEffect(() => () => window.speechSynthesis?.cancel(), []);
    const fixMissing = summary.fix === NOT_MENTIONED;
    const deviceMissing = summary.device === NOT_MENTIONED;
    const rows: [
        string,
        string
    ][] = [
        [t("Fix"), summary.fix],
        [t("Device"), summary.device],
        [t("When"), summary.when],
        [t("Near"), summary.near],
    ];
    return (<section className="screen">
      <div className="glow" style={{ top: -80, right: -90 }}/>
      <div className="topbar" style={{ justifyContent: "flex-start" }}>
        <button className="round glass" onClick={onBack} aria-label={t("Back")}><I.Back size={22}/></button>
      </div>
      <h1 style={{ marginTop: 18 }}>{t("Is this right?")}</h1>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="eyebrow">{t("YOU SAID")}</div>
        <p className="confirm-quote">&ldquo;{transcript}&rdquo;</p>
      </div>

      <div className="summary glass">
        <div className="summary-head">
          <span className="eyebrow" style={{ color: "var(--accent)" }}>{t("I'LL ASK NEARBY SHOPS")}</span>
          <button className="listen" onClick={listen}><I.Speaker size={16}/>{t("Listen")}</button>
        </div>
        {rows.map(([k, v]) => (<div className="row" key={k}><span>{t(k)}</span><b>{t(v)}</b></div>))}
      </div>

      {fixMissing && <p role="alert" className="warn-note">{t("I didn't catch what needs fixing. Say it again?")}</p>}
      {!fixMissing && deviceMissing && (<p className="warn-note">{t("Shops may need the model for a price. Continue anyway?")}</p>)}

      <div className="spacer"/>
      <p className="demo-search-note">{uiLanguage === "th" ? "สำรอง 1 เครดิตทดลอง แล้วคืนให้เมื่อจบ · ไม่มีการเก็บเงินจริง" : uiLanguage === "yue" ? "預留 1 個示範額度，完成後退回 · 唔收真錢" : "Reserves 1 demo credit, returned when finished · no real charge"}</p>
      <div className="stack">
        <button className="btn btn-primary" onClick={onYes} disabled={fixMissing || starting} style={fixMissing ? { opacity: 0.5 } : undefined}><I.Check size={22}/>{starting ? "…" : t("Yes, find me a shop")}</button>
        <button className="btn btn-secondary" onClick={onBack}><I.Mic size={20}/>{t("No, say it again")}</button>
      </div>
    </section>);
}
/* ---------- 3 · Calling ---------- */
function Calling({ results, onShow, onCancel, }: {
    results: ShopResult[];
    onShow: () => void;
    onCancel: () => void;
}) {
    const { t, uiLanguage } = usePreferences();
    const isDemo = results.length === 0 || results.every(r => r.simulated);
    return (<section className="screen">
      <div className="glow" style={{ top: 20, left: 45 }}/>
      <div className="calling-hero">
        <div className="ring b"/>
        <div className="ring a"/>
        <div className="phone-dot"><I.Phone size={44}/></div>
      </div>
      <div className="center">
        <h1 style={{ fontSize: 28 }}>{isDemo ? t("Simulated shop conversations") : t("Calling shops for you")}</h1>
        <p className="sub" style={{ fontSize: 16 }}>{t("About a minute. You can put your phone down.")}</p>
      </div>

      {isDemo && <p className="simulation-notice">{t("Demo only: real shop listings, simulated conversations and prices. No shops are called.")}</p>}
      {results.length === 0 && <p className="map-hint">{t("Finding shops for your selected area…")}</p>}
      <div className="card shop-list" aria-live="polite">
        {results.map((r) => (<div className="shop-row" key={r.shop_name}>
            <span>{r.shop_name}</span>
            <span className={`st ${r.status}`}>{t(STATUS_LABEL[r.status])}</span>
          </div>))}
      </div>

      <div className="spacer"/>
      <div className="stack">
        <button className="btn btn-glass glass" onClick={onShow}>{t("Show results")}</button>
        <button className="btn-text" onClick={onCancel}>{t("Cancel")}</button>
      </div>
    </section>);
}
/* ---------- 4 · Options ---------- */
function Options({ results, onClose, onOpen, }: {
    results: ShopResult[];
    onClose: () => void;
    onOpen: (s: ShopResult) => void;
}) {
    const { t, uiLanguage } = usePreferences();
    const { answered, leftOut } = rankResults(results);
    const [top, ...rest] = answered;
    return (<section className="screen">
      <div className="glow" style={{ top: 120, left: 40 }}/>
      <div className="topbar">
        <button className="round glass" onClick={onClose} aria-label={t("Close")}><I.Close size={22}/></button>
        <span style={{ fontSize: 14, color: "var(--muted)" }}>
          {uiLanguage === "yue" ? `${answered.length} 間舖有回覆` : uiLanguage === "th" ? `มีร้านตอบกลับ ${answered.length} ร้าน` : `${answered.length} ${answered.length === 1 ? "shop" : "shops"} answered`}
        </span>
      </div>
      <div className="scroll">
      <h1 style={{ marginTop: 18 }}>{t("Cheapest first")}</h1>
      {results.some(r => r.simulated) && <p className="simulation-notice">{t("Demo only: real shop listings, simulated conversations and prices. No shops are called.")} <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a></p>}

      {!top ? (<p className="sub">{results.length === 0 ? t("No matching shop listings were found. Try another area.") : t("No shop picked up yet. Try again in a moment.")}</p>) : (<>
          <div className="top-pick glass">
            <div className="pick-head">
              <button onClick={() => onOpen(top)} style={{ textAlign: "left" }}>
                <h2>{top.shop_name}</h2>
              </button>
              <span className="badge">{t("CHEAPEST")}</span>
            </div>
            <div className="stats">
              <div className="stat"><b className="green">{formatPrice(top.price_thb, top.price_is_estimate, uiLanguage)}</b><small>{t("Price")}</small></div>
              <div className="stat"><b>{top.distance_km ?? "—"} {uiLanguage === "th" ? "กม." : uiLanguage === "yue" ? "公里" : "km"}</b><small>{t("From home")}</small></div>
              <div className="stat"><b>{t(formatReady(top).text)}</b><small>{top.available_today ? t("Ready today") : t("Ready")}</small></div>
            </div>
            <CallShopButton shop={top} small/>
            <button className="see-call" onClick={() => onOpen(top)}>{t("See call")}</button>
          </div>

          <div className="stack" style={{ marginTop: 14 }}>
            {rest.map((r) => {
                const ready = formatReady(r);
                return (<button className="opt-row" key={r.shop_name} onClick={() => onOpen(r)}>
                  <span className="name">{r.shop_name}</span>
                  <span className="price">{formatPrice(r.price_thb, r.price_is_estimate, uiLanguage)}</span>
                  <span className="dim">{r.distance_km ?? "—"} {uiLanguage === "th" ? "กม." : uiLanguage === "yue" ? "公里" : "km"}</span>
                  <span className={ready.late ? "late" : ""}>{r.available_today ? `${t("Today")} ${t(ready.text)}` : t(ready.text)}</span>
                </button>);
            })}
          </div>
        </>)}

      {leftOut > 0 && (<p className="foot-note">
          {uiLanguage === "yue" ? `${leftOut} 間舖冇人聽，所以冇列出。` : uiLanguage === "th" ? `${leftOut} ร้านไม่รับสาย จึงไม่แสดงในผลลัพธ์` : `${leftOut} ${leftOut === 1 ? "shop didn't pick up, so it's" : "shops didn't pick up, so they're"} left out.`}
        </p>)}
      </div>
    </section>);
}
function CallShopButton({ shop, small }: {
    shop: ShopResult;
    small?: boolean;
}) {
    const { t, uiLanguage } = usePreferences();
    if (shop.simulated) return shop.source_url ? <a className={`btn btn-primary ${small ? "sm" : ""}`} href={shop.source_url} target="_blank" rel="noreferrer">{t("View shop listing")}</a> : null;
    return (<a className={`btn btn-primary ${small ? "sm" : ""}`} href={`tel:${shop.phone.replace(/[^\d+]/g, "")}`}>
      <I.Phone size={20}/>{t("Call this shop")}</a>);
}
/* ---------- 5 · Call details ---------- */
function Details({ shop, onBack, }: {
    shop: ShopResult;
    onBack: () => void;
}) {
    const { t, uiLanguage } = usePreferences();
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
        if (playing)
            audioRef.current.pause();
        else
            void audioRef.current.play();
        setPlaying(!playing);
    };
    useEffect(() => () => audioRef.current?.pause(), []);
    return (<section className="screen">
      <div className="glow" style={{ top: 360, left: -60 }}/>
      <div className="topbar" style={{ justifyContent: "flex-start", gap: 12 }}>
        <button className="round glass" onClick={onBack} aria-label={t("Back")}><I.Back size={22}/></button>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>{shop.shop_name}</div>
          <div style={{ fontSize: 13, color: "var(--muted)" }}>{uiLanguage === "th" ? "การโทร" : uiLanguage === "yue" ? "通話" : "Call"} · {shop.duration} · {uiLanguage === "th" ? "เสร็จสิ้น" : uiLanguage === "yue" ? "已完成" : "completed"}</div>
        </div>
      </div>

      <div className="scroll">
      <div className="chips">
        <span className="chip g">{formatPrice(shop.price_thb, shop.price_is_estimate, uiLanguage)}</span>
        <span className="chip">{shop.distance_km ?? "—"} {uiLanguage === "th" ? "กม. จากบ้าน" : uiLanguage === "yue" ? "公里，離屋企" : "km from home"}</span>
        <span className={`chip ${ready.late ? "w" : ""}`}>
          {shop.available_today ? `${t("Ready today")} ${t(ready.text)}` : `${t("Ready")} ${t(ready.text)}`}
        </span>
      </div>

      <div className="safe"><I.Shield size={18}/>{shop.simulated ? t("Demo only: real shop listings, simulated conversations and prices. No shops are called.") : t("The assistant said it was calling for a customer.")}</div>

      <div className="chat">
        {shop.transcript.map((l, i) => (<div key={i} className={`bubble ${l.speaker}`}>{l.text}</div>))}
      </div>
      </div>

      <div className="bar glass">
        <button className="play" onClick={togglePlay} aria-label={playing ? t("Pause recording") : t("Play recording")}>
          {playing ? <I.Pause size={22}/> : <I.Play size={22}/>}
        </button>
        <CallShopButton shop={shop} small/>
      </div>
    </section>);
}
export default function Page() { return <PreferencesProvider><SearchCreditsProvider><CallyPage /></SearchCreditsProvider></PreferencesProvider>; }

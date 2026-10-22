"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_HOME_AREA, EXAMPLE_REQUEST, NOT_MENTIONED, homeLabel, formatPrice, formatReady, getRequestSummary, rankResults, startCalls, type CallStatus, type RequestSummary, type SearchOutcome, type ShopResult, } from "@/lib/shops";
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
    // Prefills the type box when the user goes back from "Is this right?" to correct their request.
    const [speakDraft, setSpeakDraft] = useState("");
    // The repair tile the user picked; null shows the tiles, otherwise the mic screen for that repair.
    const [repair, setRepair] = useState<RepairKey | null>(null);
    const [summary, setSummary] = useState<RequestSummary | null>(null);
    const [results, setResults] = useState<ShopResult[]>([]);
    const [callsRunning, setCallsRunning] = useState(false);
    const [selected, setSelected] = useState<ShopResult | null>(null);
    const [homeArea, setHomeAreaState] = useState(DEFAULT_HOME_AREA);
    // False until the user picks an area, so the default (Asok) is never used silently.
    const [areaChosen, setAreaChosen] = useState(false);
    // True when the request itself named the area, so the default-area warning doesn't apply.
    const [nearSaid, setNearSaid] = useState(false);
    useEffect(() => { try { const saved = localStorage.getItem("cally-area"); if (saved) { setHomeAreaState(saved); setAreaChosen(true); } } catch {} }, []);
    const setHomeArea = (area: string) => {
        setHomeAreaState(area);
        setAreaChosen(true);
        try { localStorage.setItem("cally-area", area); } catch {}
    };
    const [outcome, setOutcome] = useState<SearchOutcome | null>(null);
    // Area sheet opened from the confirm or results screen for the same request.
    const [areaSheet, setAreaSheet] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const cancelRef = useRef<(() => void) | null>(null);
    useEffect(() => () => cancelRef.current?.(), []);
    const submitTranscript = useCallback(async (text: string) => {
        setTranscript(text);
        setSpeakDraft("");
        setError(null);
        try {
            const s = await getRequestSummary(text);
            // A place named in the spoken request wins; otherwise use the home area.
            setSummary({ ...s, near: s.near.trim() || homeArea });
            setNearSaid(!!s.near.trim());
            setScreen("confirm");
        }
        catch (err) {
            console.error(err);
            setError(t("Sorry, something went wrong reading your request. Please try again."));
        }
    }, [homeArea, t]);
    const beginCalling = async () => {
        if (starting || !summary || summary.fix === NOT_MENTIONED)
            return;
        setStarting(true);
        const reservation = await credits.reserve();
        setStarting(false);
        if (!reservation) return;
        reservationRef.current = reservation;
        setCreditNotice("");
        setOutcome(null);
        setResults([]);
        setCallsRunning(true);
        // Closing the results later lands back on the tiles, not a half-finished mic screen.
        setRepair(null);
        setScreen("calling");
        let timeout: ReturnType<typeof setTimeout>;
        const finish = (_results?: ShopResult[], searchOutcome?: SearchOutcome) => {
            clearTimeout(timeout);
            cancelRef.current = null;
            setCallsRunning(false);
            setOutcome(searchOutcome ?? null);
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
        setCallsRunning(false);
        setScreen(next);
    };
    // Back from "Is this right?" reopens the mic screen with the request ready to edit. The text
    // already includes the repair, so it goes to the generic screen to avoid repeating it.
    const backToSpeak = () => {
        setSpeakDraft(transcript);
        setRepair("other");
        setScreen("speak");
    };
    // What the phone's Back button does on each screen: the same as the on-screen back/close.
    const goBack = () => {
        if (areaSheet) { setAreaSheet(false); return; }
        if (screen === "details") setScreen("options");
        else if (screen === "options" || screen === "calling") stopCalling("speak");
        else if (screen === "confirm") backToSpeak();
        else setRepair(null);
    };
    const goBackRef = useRef(goBack);
    goBackRef.current = goBack;
    // Keep one history entry while away from the home screen, so Back steps back inside the
    // app instead of leaving it.
    const trappedRef = useRef(false);
    const ignorePopRef = useRef(false);
    const away = screen !== "speak" || repair !== null;
    // Bumped on every Back press, so the entry is re-added even when "away" stays true
    // (e.g. Back from "Is this right?" lands on the mic screen, still away from the tiles).
    const [pops, setPops] = useState(0);
    useEffect(() => {
        if (away && !trappedRef.current) {
            history.pushState({ cally: true }, "");
            trappedRef.current = true;
        }
        else if (!away && trappedRef.current) {
            trappedRef.current = false;
            ignorePopRef.current = true;
            history.back();
        }
    }, [away, pops]);
    useEffect(() => {
        const onPop = () => {
            if (ignorePopRef.current) { ignorePopRef.current = false; return; }
            trappedRef.current = false;
            goBackRef.current();
            setPops((n) => n + 1);
        };
        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
    }, []);
    return (<main className="app">
      <Settings />
      {creditNotice && screen === "options" && !callsRunning && <div className="credit-result-note" role="status">{creditNotice}</div>}
      {screen === "speak" && <Speak onTranscript={submitTranscript} error={error} homeArea={homeArea} areaChosen={areaChosen} onHomeArea={setHomeArea} draft={speakDraft} repair={repair} onRepair={setRepair} onShowLast={results.length ? () => setScreen("options") : undefined}/>}
      {screen === "confirm" && summary && (<Confirm transcript={transcript} summary={summary} areaChosen={areaChosen || nearSaid} onChange={setSummary} onEditArea={() => setAreaSheet(true)} onBack={backToSpeak} onYes={() => { void beginCalling(); }} starting={starting}/>)}
      {screen === "calling" && (<Calling results={results} onShow={() => setScreen("options")} onCancel={() => stopCalling("speak")}/>)}
      {screen === "options" && (<Options results={results} outcome={outcome} running={callsRunning} onClose={() => stopCalling("speak")} onRetry={() => setScreen("confirm")} onWiden={() => setAreaSheet(true)} onOpen={(s) => {
                setSelected(s);
                setScreen("details");
            }}/>)}
      {areaSheet && (<AreaSheet current={homeArea} onPick={(area) => {
                setHomeArea(area);
                setSummary((s) => (s ? { ...s, near: area } : s));
                setAreaSheet(false);
                setScreen("confirm");
            }} onClose={() => {
                // The radius slider saves as it moves, so closing still searches again with it.
                setAreaSheet(false);
                setScreen("confirm");
            }}/>)}
      {screen === "details" && selected && (<Details shop={selected} onBack={() => setScreen("options")}/>)}
    </main>);
}
/* ---------- 1 · Speak ---------- */
type SpeechRec = {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((e: {
        results: ArrayLike<ArrayLike<{
            transcript: string;
        }>>;
    }) => void) | null;
    onerror: ((e?: { error?: string }) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
};
function Speak({ onTranscript, error, homeArea, areaChosen, onHomeArea, draft, repair, onRepair, onShowLast, }: {
    onTranscript: (t: string) => void;
    error: string | null;
    homeArea: string;
    areaChosen: boolean;
    onHomeArea: (area: string) => void;
    /** The last request, kept so "say it again" can edit it instead of starting over. */
    draft: string;
    repair: RepairKey | null;
    onRepair: (repair: RepairKey | null) => void;
    onShowLast?: () => void;
}) {
    const { t, uiLanguage } = usePreferences();
    const [sheet, setSheet] = useState(false);
    const [listening, setListening] = useState(false);
    const [typing, setTyping] = useState(!!draft);
    const [text, setText] = useState(draft);
    // UI-only states: reading the request after speech, or nothing was heard.
    const [thinking, setThinking] = useState(false);
    const [missed, setMissed] = useState(false);
    const recRef = useRef<SpeechRec | null>(null);
    const holdingRef = useRef(false);
    const releaseRef = useRef<(() => void) | null>(null);
    useEffect(() => () => {
        holdingRef.current = false;
        releaseRef.current = null;
        const rec = recRef.current;
        if (rec) { rec.onresult = null; rec.onend = null; rec.onerror = null; rec.stop(); }
    }, []);
    useEffect(() => {
        if (error)
            setThinking(false);
    }, [error]);
    const chosen = REPAIRS.find((r) => r.key === repair) ?? null;
    // The tile already says what's broken, so the user only adds the device and timing.
    const submit = (said: string) => {
        setListening(false);
        setThinking(true);
        onTranscript(chosen && chosen.key !== "other" ? `${t(chosen.label)}, ${said}` : said);
    };
    const openRepair = (key: RepairKey | null) => {
        setMissed(false);
        setTyping(false);
        setText("");
        onRepair(key);
    };
    const startHold = () => {
        if (thinking || holdingRef.current)
            return;
        setMissed(false);
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
        // Listen for as long as the button is held; letting go stops and submits.
        rec.interimResults = true;
        rec.continuous = true;
        holdingRef.current = true;
        let completed = false;
        let pending = "";
        let previousSession = "";
        let releaseTimer: ReturnType<typeof setTimeout> | null = null;
        const finish = () => {
            if (completed) return;
            completed = true;
            if (releaseTimer) clearTimeout(releaseTimer);
            releaseRef.current = null;
            setListening(false);
            if (pending.trim()) submit(pending.trim());
            else { setMissed(true); setTyping(true); }
        };
        releaseRef.current = () => {
            // Let the browser deliver the last words before submitting, but don't wait on it forever.
            try { rec.stop(); } catch { finish(); return; }
            releaseTimer = setTimeout(finish, 1500);
        };
        rec.onresult = (e) => {
            if (completed) return;
            pending = [previousSession, Array.from(e.results, result => result[0].transcript).join(" ")].filter(Boolean).join(" ");
        };
        rec.onerror = (e) => {
            if (completed) return;
            // Silence or a stop() call: onend follows and decides what to do.
            if (e?.error === "no-speech" || e?.error === "aborted") return;
            completed = true;
            holdingRef.current = false;
            if (releaseTimer) clearTimeout(releaseTimer);
            releaseRef.current = null;
            setListening(false);
            setText(pending.trim());
            setMissed(true);
            setTyping(true);
        };
        rec.onend = () => {
            if (completed) return;
            if (holdingRef.current) {
                // Some browsers end recognition on their own. Keep the text and
                // restart so listening continues for as long as the button is held.
                previousSession = pending;
                try { rec.start(); return; } catch { /* Submit what was heard so far. */ }
            }
            finish();
        };
        recRef.current = rec;
        setListening(true);
        try { rec.start(); } catch { rec.onerror?.({}); }
    };
    const endHold = () => {
        if (!holdingRef.current)
            return;
        holdingRef.current = false;
        releaseRef.current?.();
    };
    return (<section className="screen">
      <div className="glow" style={{ top: 230, left: 45 }}/>
      <div className="topbar">
        <button className={`pill glass area ${areaChosen ? "" : "unset"}`} onClick={() => setSheet(true)} aria-haspopup="dialog" aria-label={areaChosen ? `${t("Searching near")} ${t(homeLabel(homeArea))}. ${t("Tap to change")}` : t("Set your area")}>
          <I.Pin size={18}/>
          <span>{areaChosen ? t(homeLabel(homeArea)) : t("Set area")}</span>
        </button>
        <span className="brand">CALLY</span>
      </div>
      {sheet && (<AreaSheet current={homeArea} onPick={(area) => {
                onHomeArea(area);
                setSheet(false);
            }} onClose={() => setSheet(false)}/>)}

      {chosen ? (<>
        <div className="speak-body">
          <button className="repair-chip glass" onClick={() => openRepair(null)} aria-label={`${t(chosen.label)}. ${t("Change repair")}`}>
            <chosen.Icon size={18}/><span>{t(chosen.label)}</span><I.Close size={16}/>
          </button>
          <h1 className="repair-question">{t(chosen.question)}</h1>
          <p className="example">{t("For example:")} <i>&ldquo;{t(chosen.example)}&rdquo;</i></p>
          <div className={`mic-ring glass ${listening ? "live" : ""} ${thinking ? "busy" : ""}`}>
            <button className="mic-btn" disabled={thinking} aria-label={t("Hold to talk")} aria-pressed={listening}
              onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  // Capture the pointer so letting go anywhere on screen still ends the hold.
                  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* Release on the button still works. */ }
                  startHold();
              }}
              onPointerUp={endHold} onPointerCancel={endHold} onLostPointerCapture={endHold} onBlur={endHold}
              onKeyDown={(e) => { if ((e.key === " " || e.key === "Enter") && !e.repeat) { e.preventDefault(); startHold(); } }}
              onKeyUp={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); endHold(); } }}
              onContextMenu={(e) => e.preventDefault()}>
              <I.Mic size={64}/>
            </button>
          </div>
          <div className="mic-help" aria-live="polite">
            <b>{thinking ? t("Got it") : listening ? t("Listening…") : missed ? t("I didn't catch that") : t("Hold to talk")}</b>
            <p>{thinking ? t("Reading your request…") : listening ? t("Let go to send") : missed ? t("Hold the mic while you talk, or type it below.") : t("Let go when you're done")}</p>
          </div>
          {error && <p className="home-note" role="alert">{error}</p>}
        </div>
        {typing ? (<form className="type-box" onSubmit={(e) => {
                  e.preventDefault();
                  if (text.trim() && !thinking)
                      submit(text.trim());
              }}>
            <input autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder={t(chosen.example)} aria-label={t(chosen.question)}/>
            <button className="btn btn-primary sm" type="submit" disabled={!text.trim() || thinking}>{t("Go")}</button>
          </form>) : (<button className="btn btn-secondary" onClick={() => setTyping(true)}>
            <I.Keyboard size={20}/>{t("Type instead")}</button>)}
      </>) : (<>
        <div className="home-body">
          <h1>{t("What's broken?")}</h1>
          {/* How Cally works, as pictures: your problem → shops get called → cheapest price. */}
          <ol className="how-strip" aria-label={t("How Cally works")}>
            <li><span className="how-icon"><I.CrackedScreen size={18}/></span>{t("You say it")}</li>
            <li><span className="how-icon"><I.Phone size={18}/></span>{t("We call shops")}</li>
            <li><span className="how-icon win"><I.Tag size={18}/></span>{t("Cheapest wins")}</li>
          </ol>
          <div className="repair-grid">
            {REPAIRS.filter((r) => r.key !== "other").map(({ key, label, Icon }) => (<button key={key} className="repair-tile glass" onClick={() => openRepair(key)}>
                <span className="repair-icon"><Icon size={26}/></span>
                <span>{t(label)}</span>
              </button>))}
            <button className="repair-tile glass" onClick={() => openRepair("other")}>
              <span className="repair-icon"><I.More size={26}/></span>
              <span>{t("Something else")}</span>
            </button>
          </div>
          {error && <p className="home-note" role="alert">{error}</p>}
          {onShowLast && (<button className="see-call" onClick={onShowLast}>{t("See your last results")}</button>)}
        </div>
        <button className="btn btn-secondary" onClick={() => openRepair("other")}>
          <I.Mic size={20}/>{t("Or just say it")}</button>
      </>)}
    </section>);
}
type RepairKey = "screen" | "battery" | "water" | "charging" | "laptop" | "other";
/** Common repairs on the home screen. Each opens the mic asking only for what's still missing. */
const REPAIRS: { key: RepairKey; label: string; question: string; example: string; Icon: typeof I.Mic }[] = [
    { key: "screen", label: "Cracked screen", question: "Which phone is it?", example: "iPhone 13, need it today", Icon: I.CrackedScreen },
    { key: "battery", label: "Battery", question: "Which device needs a battery?", example: "Samsung S22, drains by lunchtime", Icon: I.Battery },
    { key: "water", label: "Water damage", question: "Which device got wet?", example: "iPhone 12, dropped it in water this morning", Icon: I.Droplet },
    { key: "charging", label: "Charging port", question: "Which device won't charge?", example: "Pixel 7, cable keeps falling out", Icon: I.Plug },
    { key: "laptop", label: "Laptop", question: "What's wrong with your laptop?", example: "MacBook Air, keyboard stopped working", Icon: I.Laptop },
    { key: "other", label: "Something else", question: "What's broken?", example: EXAMPLE_REQUEST, Icon: I.More },
];
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
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);
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
          <div className="area-heading"><b>{t("Where should I look?")}</b><small>{t("Now searching near")} {t(homeLabel(current))}</small></div>
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
        <button className="btn btn-secondary" aria-expanded={showMap} aria-controls="location-map-picker" onClick={() => setShowMap(value => !value)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true"><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/></svg>{showMap ? t("Hide map") : t("Choose on map")}
        </button>
        {showMap && <div id="location-map-picker"><LocationMap onConfirm={setMapPoint} saving={saving} radiusKm={radiusKm} area={current} /></div>}
        {note && <p role="alert" className="sheet-note">{note}</p>}
        <form className="type-box" onSubmit={(e) => {
            e.preventDefault();
            if (saving) return;
            // With nothing typed, the button means "done": the radius slider has already saved.
            if (!text.trim()) { onClose(); return; }
            void setTyped(text.trim().slice(0, 80));
        }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("Type an area")} aria-label={t("Type a different area")} disabled={saving}/>
          <button className="btn btn-primary sm area-set" type="submit" disabled={saving}>{saving ? t("Saving…") : text.trim() ? t("Set") : t("Done")}</button>
        </form>
      </div>
    </div>);
}
/* ---------- 2 · Confirm ---------- */
type EditableField = "fix" | "device" | "when";
function Confirm({ transcript, summary, areaChosen, onChange, onEditArea, onBack, onYes, starting, }: {
    transcript: string;
    summary: RequestSummary;
    areaChosen: boolean;
    onChange: (summary: RequestSummary) => void;
    onEditArea: () => void;
    onBack: () => void;
    onYes: () => void;
    starting: boolean;
}) {
    const [editing, setEditing] = useState<EditableField | null>(null);
    const [draft, setDraft] = useState("");
    // Enter and Escape both remove the input, which then blurs; only the first action counts.
    const doneRef = useRef(false);
    const startEdit = (field: EditableField) => {
        doneRef.current = false;
        setEditing(field);
        setDraft(summary[field] === NOT_MENTIONED ? "" : summary[field]);
    };
    const commitEdit = () => {
        if (!editing || doneRef.current) return;
        doneRef.current = true;
        onChange({ ...summary, [editing]: draft.trim().slice(0, 120) || NOT_MENTIONED });
        setEditing(null);
    };
    const cancelEdit = () => {
        doneRef.current = true;
        setEditing(null);
    };
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
    const rows: [string, keyof RequestSummary][] = [
        ["Fix", "fix"],
        ["Device", "device"],
        ["When", "when"],
        ["Near", "near"],
    ];
    const placeholder: Record<EditableField, string> = { fix: t("e.g. Cracked screen"), device: t("e.g. iPhone 13"), when: t("e.g. Today") };
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
        {rows.map(([label, key]) => key !== "near" && editing === key ? (<form className="row row-editing" key={key} onSubmit={(e) => { e.preventDefault(); commitEdit(); }}>
            <label htmlFor={`edit-${key}`}>{t(label)}</label>
            <input id={`edit-${key}`} autoFocus value={draft} placeholder={placeholder[key]} onChange={(e) => setDraft(e.target.value)} onBlur={commitEdit} onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); cancelEdit(); } }}/>
          </form>) : (<button type="button" className={`row row-edit ${summary[key] === NOT_MENTIONED ? "missing" : ""}`} key={key} onClick={() => (key === "near" ? onEditArea() : startEdit(key))} aria-label={`${t(label)}: ${t(summary[key])}. ${t("Tap to change")}`}>
            <span>{t(label)}</span>
            <b>{t(summary[key])}<svg className="edit-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></b>
          </button>))}
        <p className="edit-hint">{t("Tap any line to change it.")}</p>
      </div>

      {fixMissing && <p role="alert" className="warn-note">{t("I didn't catch what needs fixing. Tap Fix to type it, or say it again.")}</p>}
      {!fixMissing && deviceMissing && (<p className="warn-note">{t("Shops may need the model to give a price. Tap Device to add it, or continue anyway.")}</p>)}
      {!areaChosen && summary.near === DEFAULT_HOME_AREA && (<p className="warn-note">{t("Searching near Asok, Bangkok (the default area). Tap Near to change it.")}</p>)}

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
        <button className="btn btn-glass glass" onClick={onShow}>{t("See prices so far")}</button>
        <button className="btn-text" onClick={onCancel}>{t("Cancel")}</button>
      </div>
    </section>);
}
/* ---------- 4 · Options ---------- */
function NoShops({ outcome, onWiden, onRetry }: {
    outcome: SearchOutcome | null;
    onWiden: () => void;
    onRetry: () => void;
}) {
    const { t, uiLanguage } = usePreferences();
    if (outcome?.empty === "lookup_failed")
        return (<>
          <p className="sub" role="alert">{t("Couldn't load shop listings. Try again in a moment.")}</p>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onRetry}>{t("Try again")}</button>
        </>);
    if (outcome?.empty === "area_unclear")
        return (<>
          <p className="sub" role="alert">{t("I couldn't find that area. Choose it on the map, or type a more specific place.")}</p>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onWiden}><I.Pin size={20}/>{t("Change area")}</button>
        </>);
    if (outcome?.empty === "out_of_range") {
        const r = outcome.radiusKm;
        const atMax = r >= 20;
        const message = uiLanguage === "th"
            ? (atMax ? `ไม่พบร้านในระยะ ${r} กม. ลองเลือกพื้นที่อื่น` : `ไม่พบร้านในระยะ ${r} กม. ลองเพิ่มรัศมีการค้นหาแล้วลองอีกครั้ง`)
            : uiLanguage === "yue"
                ? (atMax ? `${r} 公里內搵唔到舖頭，試吓揀其他地區。` : `${r} 公里內搵唔到舖頭，試吓擴大搜尋範圍再試。`)
                : (atMax ? `No shops found within ${r} km. Try a different area.` : `No shops found within ${r} km. Increase your search radius and try again.`);
        return (<>
          <p className="sub" role="alert">{message}</p>
          <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onWiden}><I.Pin size={20}/>{atMax ? t("Change area") : t("Increase search radius")}</button>
        </>);
    }
    return <p className="sub">{t("No matching shop listings were found. Try another area.")}</p>;
}
function Options({ results, outcome, running, onClose, onOpen, onWiden, onRetry, }: {
    results: ShopResult[];
    outcome: SearchOutcome | null;
    running: boolean;
    onClose: () => void;
    onOpen: (s: ShopResult) => void;
    onWiden: () => void;
    onRetry: () => void;
}) {
    const { t, uiLanguage } = usePreferences();
    const { answered, pending, leftOut } = rankResults(results);
    const [top, ...rest] = answered;
    const waiting = running && (pending > 0 || results.length === 0);
    const answeredLine = uiLanguage === "yue" ? `${results.length} 間舖之中 ${answered.length} 間有報價` : uiLanguage === "th" ? `ได้ราคาจาก ${answered.length} จาก ${results.length} ร้าน` : `${answered.length} of ${results.length} ${results.length === 1 ? "shop" : "shops"} gave a price`;
    const waitingLine = uiLanguage === "yue" ? `仲等緊 ${pending} 間舖回覆…` : uiLanguage === "th" ? `กำลังรอคำตอบจากอีก ${pending} ร้าน…` : `Still waiting on ${pending} ${pending === 1 ? "shop" : "shops"}…`;
    return (<section className="screen">
      <div className="glow" style={{ top: 120, left: 40 }}/>
      <div className="topbar">
        <button className="round glass" onClick={onClose} aria-label={running ? t("Stop and close") : t("Close")}><I.Close size={22}/></button>
      </div>
      <div className="scroll">
      <h1 style={{ marginTop: 18 }}>{t("Cheapest first")}</h1>
      {results.length > 0 && <p className="results-count">{answeredLine}{waiting && pending > 0 && <span className="live-dot">{waitingLine}</span>}</p>}
      {results.some(r => r.simulated) && <p className="simulation-notice">{t("Demo only: real shop listings, simulated conversations and prices. No shops are called.")} <a href="https://maps.google.com" target="_blank" rel="noreferrer">Google Maps</a></p>}

      {!top ? (waiting
            ? <p className="sub" aria-live="polite">{t("Shops are still answering. Prices will appear here as they come in.")}</p>
            : results.length === 0 ? <NoShops outcome={outcome} onWiden={onWiden} onRetry={onRetry}/>
            : (<>
              <p className="sub">{t("None of the shops gave a price this time.")}</p>
              <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onRetry}>{t("Try again")}</button>
            </>)) : (<>
          <div className="top-pick glass">
            <div className="pick-head">
              <button onClick={() => onOpen(top)} style={{ textAlign: "left" }}>
                <h2>{top.shop_name}</h2>
              </button>
              <span className="badge">{t("CHEAPEST")}</span>
            </div>
            <div className="stats">
              <div className="stat"><b className="green">{formatPrice(top.price_thb, top.price_is_estimate, uiLanguage)}</b><small>{t("Price")}</small></div>
              <div className="stat"><b>{top.distance_km ?? "—"} {uiLanguage === "th" ? "กม." : uiLanguage === "yue" ? "公里" : "km"}</b><small>{t("Away")}</small></div>
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
        if (!shop.recording_url)
            return;
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
        <span className="chip">{shop.distance_km ?? "—"} {uiLanguage === "th" ? "กม. จากจุดที่ค้นหา" : uiLanguage === "yue" ? "公里遠" : "km away"}</span>
        <span className={`chip ${ready.late ? "w" : ""}`}>
          {shop.available_today ? `${t("Ready today")} ${t(ready.text)}` : `${t("Ready")} ${t(ready.text)}`}
        </span>
      </div>

      <div className="safe"><I.Shield size={18}/>{shop.simulated ? t("Demo only: real shop listings, simulated conversations and prices. No shops are called.") : t("The assistant said it was calling for a customer.")}</div>

      <div className="chat">
        {shop.transcript.map((l, i) => (<div key={i} className={`bubble ${l.speaker}`}>{l.text}</div>))}
      </div>
      </div>

      {/* Only offer playback when there is a real recording to play. */}
      {(shop.recording_url || !shop.simulated || shop.source_url) && (<div className="bar glass">
        {shop.recording_url && (<button className="play" onClick={togglePlay} aria-label={playing ? t("Pause recording") : t("Play recording")}>
          {playing ? <I.Pause size={22}/> : <I.Play size={22}/>}
        </button>)}
        <CallShopButton shop={shop} small/>
      </div>)}
    </section>);
}
export default function Page() { return <PreferencesProvider><SearchCreditsProvider><CallyPage /></SearchCreditsProvider></PreferencesProvider>; }

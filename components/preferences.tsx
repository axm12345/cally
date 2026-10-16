"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export const thai: Record<string, string> = {
 "Search radius": "รัศมีการค้นหา", "Straight-line distance from the selected location.": "ระยะทางเส้นตรงจากตำแหน่งที่เลือก",
 "Simulated shop conversations": "การสนทนาร้านค้าแบบจำลอง", "Demo only: real shop listings, simulated conversations and prices. No shops are called.": "การสาธิตเท่านั้น: ชื่อร้านจริง แต่การสนทนาและราคาเป็นตัวอย่าง ไม่มีการโทรหาร้าน", "Finding shops for your selected area…": "กำลังหาร้านในพื้นที่ที่เลือก…", "No matching shop listings were found. Try another area.": "ไม่พบร้านที่ตรงกับการค้นหา ลองพื้นที่อื่น", "View shop listing": "ดูข้อมูลร้าน",
  "Choose on map": "เลือกบนแผนที่", "Choose a point on the map": "เลือกจุดบนแผนที่", "Tap the map or drag the pin to choose a location.": "แตะแผนที่หรือลากหมุดเพื่อเลือกตำแหน่ง", "Map unavailable. You can still type an area below.": "แผนที่ไม่พร้อมใช้งาน ยังสามารถพิมพ์พื้นที่ด้านล่างได้", "Pin map center": "ปักหมุดกลางแผนที่", "Use this location": "ใช้ตำแหน่งนี้", "Could not name this point. Try a nearby street or type an area.": "ไม่พบชื่อสถานที่ ลองถนนใกล้เคียงหรือพิมพ์พื้นที่",
  "Settings": "การตั้งค่า", "Close": "ปิด", "Dark mode": "โหมดมืด",
  "App language": "ภาษาของแอป", "AI voice language": "ภาษาเสียง AI",
  "Used when Cally calls a shop.": "ภาษาที่ Cally ใช้เมื่อโทรหาร้าน",
  "What needs fixing?": "ต้องการซ่อมอะไร?", "Just say it. I'll find the cheapest shop.": "บอกมาได้เลย ฉันจะหาร้านที่ราคาถูกที่สุดให้",
  "Stop listening": "หยุดฟัง", "Start talking": "เริ่มพูด", "Got it": "เข้าใจแล้ว",
  "Listening…": "กำลังฟัง…", "I didn't catch that": "ฉันฟังไม่ชัด", "Tap once, then talk": "แตะหนึ่งครั้ง แล้วพูดได้เลย",
  "Reading your request…": "กำลังอ่านคำขอ…", "Talk now. Tap the square when you're done.": "พูดได้เลย แตะสี่เหลี่ยมเมื่อพูดจบ",
  "Tap to try again, or type it below.": "แตะเพื่อลองอีกครั้ง หรือพิมพ์ด้านล่าง", "No need to hold it. I stop when you pause.": "ไม่ต้องกดค้าง ฉันจะหยุดเมื่อคุณเว้นจังหวะ",
  "Try:": "ลองพูดว่า:", "Describe what needs fixing": "อธิบายสิ่งที่ต้องการซ่อม", "Go": "ถัดไป", "Type instead": "พิมพ์แทน",
  "My phone screen is cracked, I need it fixed today": "หน้าจอโทรศัพท์แตก ต้องการซ่อมวันนี้",
  "Choose your area": "เลือกพื้นที่", "Where should I look?": "ต้องการหาร้านแถวไหน?", "Finding you…": "กำลังหาตำแหน่ง…",
  "Use my current location": "ใช้ตำแหน่งปัจจุบัน", "Type an area": "พิมพ์ชื่อพื้นที่", "Type a different area": "พิมพ์พื้นที่อื่น", "Set": "บันทึก",
  "This browser can't share your location.": "เบราว์เซอร์นี้แชร์ตำแหน่งไม่ได้", "Found you, but couldn't name the street. Type an area instead.": "พบตำแหน่งแล้ว แต่ไม่พบชื่อถนน กรุณาพิมพ์พื้นที่",
  "Couldn't get your location. Type an area instead.": "ไม่พบตำแหน่ง กรุณาพิมพ์พื้นที่", "Back": "ย้อนกลับ",
  "Is this right?": "ข้อมูลถูกต้องไหม?", "YOU SAID": "สิ่งที่คุณบอก", "I'LL ASK NEARBY SHOPS": "ฉันจะถามร้านใกล้คุณ", "Listen": "ฟัง",
  "Fix": "งานซ่อม", "Device": "อุปกรณ์", "When": "เวลา", "Near": "พื้นที่", "Not mentioned": "ไม่ได้ระบุ",
  "I didn't catch what needs fixing. Say it again?": "ยังไม่ทราบว่าต้องการซ่อมอะไร พูดอีกครั้งได้ไหม?",
  "Shops may need the model for a price. Continue anyway?": "ร้านอาจต้องทราบรุ่นเพื่อเสนอราคา ต้องการดำเนินการต่อไหม?",
  "Yes, find me a shop": "ใช่ หาร้านให้ฉัน", "No, say it again": "ไม่ พูดอีกครั้ง",
  "Calling shops for you": "กำลังโทรหาร้านให้คุณ", "About a minute. You can put your phone down.": "ใช้เวลาประมาณหนึ่งนาที วางโทรศัพท์รอได้เลย",
  "Ringing…": "กำลังเรียกสาย…", "Talking…": "กำลังสนทนา…", "Got a price": "ได้ราคาแล้ว", "No answer": "ไม่มีผู้รับสาย", "No price given": "ไม่ได้รับราคา", "Couldn't connect": "เชื่อมต่อไม่ได้",
  "Show results": "ดูผลลัพธ์", "Cancel": "ยกเลิก", "Cheapest first": "เรียงจากราคาถูกที่สุด", "No shop picked up yet. Try again in a moment.": "ยังไม่มีร้านรับสาย ลองอีกครั้งในอีกสักครู่",
  "CHEAPEST": "ถูกที่สุด", "Price": "ราคา", "From home": "ระยะจากบ้าน", "Ready today": "เสร็จวันนี้", "Ready": "พร้อมรับ", "See call": "ดูการสนทนา", "Call this shop": "โทรหาร้านนี้",
  "shop": "ร้าน", "shops": "ร้าน", "Tomorrow": "พรุ่งนี้", "Today": "วันนี้", "from ": "เริ่มต้น ", "Home · Asok": "บ้าน · อโศก", "Current location": "ตำแหน่งปัจจุบัน",
  "The assistant said it was calling for a customer.": "ผู้ช่วยแจ้งแล้วว่าโทรมาในนามลูกค้า", "Pause recording": "หยุดเสียงชั่วคราว", "Play recording": "เล่นเสียงบันทึก",
  "Couldn't read that request. Check the server log and try again.": "อ่านคำขอไม่สำเร็จ กรุณาลองอีกครั้ง",
};

export const cantonese: Record<string, string> = {
 "Search radius": "搜尋範圍", "Straight-line distance from the selected location.": "由所選位置計算嘅直線距離。",
 "Simulated shop conversations": "模擬舖頭對話", "Demo only: real shop listings, simulated conversations and prices. No shops are called.": "只供示範：真實舖頭資料，對話同價錢係模擬，冇打畀舖頭。", "Finding shops for your selected area…": "搵緊所選地區嘅舖頭…", "No matching shop listings were found. Try another area.": "搵唔到符合要求嘅舖頭，試吓其他地區。", "View shop listing": "睇舖頭資料",
  "Choose on map": "喺地圖揀", "Choose a point on the map": "喺地圖揀位置", "Tap the map or drag the pin to choose a location.": "撳地圖或者拖個圖釘嚟揀位置。", "Map unavailable. You can still type an area below.": "載入唔到地圖，可以喺下面輸入地區。", "Pin map center": "釘選地圖中心", "Use this location": "用呢個位置", "Could not name this point. Try a nearby street or type an area.": "搵唔到地名，試吓附近條街或者輸入地區。",
  "Settings": "設定",
  "Close": "關閉",
  "Dark mode": "深色模式",
  "App language": "介面語言",
  "AI voice language": "AI 通話語言",
  "Used when Cally calls a shop.": "Cally 打畀舖頭時用嘅語言。",
  "What needs fixing?": "有咩要整？",
  "Just say it. I'll find the cheapest shop.": "講畀我聽，我幫你搵最平嘅舖頭。",
  "Stop listening": "停止聆聽",
  "Start talking": "開始講",
  "Got it": "收到",
  "Listening…": "聽緊…",
  "I didn't catch that": "我聽唔清楚",
  "Tap once, then talk": "撳一下就可以講",
  "Reading your request…": "睇緊你嘅要求…",
  "Talk now. Tap the square when you're done.": "可以講喇，講完撳個方形掣。",
  "Tap to try again, or type it below.": "撳一下再試，或者喺下面打字。",
  "No need to hold it. I stop when you pause.": "唔使撳住，你停頓時我就會停。",
  "Try:": "試吓講：",
  "Describe what needs fixing": "講吓有咩要整",
  "Go": "繼續",
  "Type instead": "改用打字",
  "My phone screen is cracked, I need it fixed today": "我部電話個芒爆咗，想今日整好",
  "Choose your area": "揀地區",
  "Where should I look?": "想搵邊區？",
  "Finding you…": "搵緊你嘅位置…",
  "Use my current location": "用我而家嘅位置",
  "Type an area": "輸入地區",
  "Type a different area": "輸入其他地區",
  "Set": "儲存",
  "This browser can't share your location.": "呢個瀏覽器分享唔到位置。",
  "Found you, but couldn't name the street. Type an area instead.": "搵到你嘅位置，但搵唔到街名，請輸入地區。",
  "Couldn't get your location. Type an area instead.": "攞唔到你嘅位置，請輸入地區。",
  "Back": "返回",
  "Is this right?": "啱唔啱？",
  "YOU SAID": "你話",
  "I'LL ASK NEARBY SHOPS": "我會問附近嘅舖頭",
  "Listen": "聽一聽",
  "Fix": "維修項目",
  "Device": "裝置",
  "When": "時間",
  "Near": "附近地區",
  "Not mentioned": "未提及",
  "I didn't catch what needs fixing. Say it again?": "我聽唔清楚有咩要整，可唔可以再講一次？",
  "Shops may need the model for a price. Continue anyway?": "舖頭可能要知道型號先報到價，照樣繼續？",
  "Yes, find me a shop": "啱，幫我搵舖頭",
  "No, say it again": "唔啱，再講一次",
  "Calling shops for you": "幫你打緊畀舖頭",
  "About a minute. You can put your phone down.": "大約一分鐘，可以放低電話等。",
  "Ringing…": "響緊…",
  "Talking…": "傾緊…",
  "Got a price": "收到報價",
  "No answer": "冇人聽",
  "No price given": "未有報價",
  "Couldn't connect": "接通唔到",
  "Show results": "睇結果",
  "Cancel": "取消",
  "Cheapest first": "最平優先",
  "No shop picked up yet. Try again in a moment.": "暫時冇舖頭聽電話，等陣再試。",
  "CHEAPEST": "最平",
  "Price": "價錢",
  "From home": "離屋企",
  "Ready today": "今日整好",
  "Ready": "整好時間",
  "See call": "睇通話",
  "Call this shop": "打畀呢間舖",
  "shop": "間舖",
  "shops": "間舖",
  "Tomorrow": "聽日",
  "Today": "今日",
  "from ": "由 ",
  "Home · Asok": "屋企 · Asok",
  "Current location": "目前位置",
  "The assistant said it was calling for a customer.": "助理已表明係代客人打嚟。",
  "Pause recording": "暫停錄音",
  "Play recording": "播放錄音",
  "Couldn't read that request. Check the server log and try again.": "讀唔到要求，請再試一次。"
};

type Language = "en" | "th" | "yue";
type Preferences = { dark: boolean; uiLanguage: Language; voiceLanguage: Language };
const defaults: Preferences = { dark: false, uiLanguage: "en", voiceLanguage: "th" };
const Context = createContext({ ...defaults, set: (_patch: Partial<Preferences>) => {}, t: (text: string) => text });

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState(defaults);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("cally-preferences") || "{}");
      setPrefs({ dark: saved.dark === true, uiLanguage: saved.uiLanguage === "th" || saved.uiLanguage === "yue" ? saved.uiLanguage : "en", voiceLanguage: saved.voiceLanguage === "en" || saved.voiceLanguage === "yue" ? saved.voiceLanguage : "th" });
    } catch {}
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = prefs.dark ? "dark" : "light";
    document.documentElement.lang = prefs.uiLanguage;
    localStorage.setItem("cally-preferences", JSON.stringify(prefs));
  }, [prefs, ready]);
  return <Context.Provider value={{ ...prefs, set: (patch) => setPrefs(p => ({ ...p, ...patch })), t: text => prefs.uiLanguage === "th" ? thai[text] ?? text : prefs.uiLanguage === "yue" ? cantonese[text] ?? text : text }}>{children}</Context.Provider>;
}

export const usePreferences = () => useContext(Context);


function LanguageFlag({ language }: { language: Language }) {
  const label = language === "en" ? "English" : language === "th" ? "ไทย" : "廣東話";
  return <svg className="language-flag" viewBox="0 0 24 24" role="img" aria-label={label}>
    {language === "en" ? <><path fill="#012169" d="M0 0h24v24H0z"/><path stroke="#fff" strokeWidth="5" d="m0 0 24 24M24 0 0 24"/><path stroke="#c8102e" strokeWidth="2" d="m0 0 24 24M24 0 0 24"/><path stroke="#fff" strokeWidth="8" d="M12 0v24M0 12h24"/><path stroke="#c8102e" strokeWidth="4.5" d="M12 0v24M0 12h24"/></> : language === "th" ? <><path fill="#a51931" d="M0 0h24v24H0z"/><path fill="#f4f5f8" d="M0 4h24v16H0z"/><path fill="#2d2a4a" d="M0 8h24v8H0z"/></> : <><path fill="#de2910" d="M0 0h24v24H0z"/>{[0,72,144,216,288].map(angle => <ellipse key={angle} cx="12" cy="8.5" rx="1.8" ry="3.4" fill="#fff" transform={`rotate(${angle} 12 12)`}/>)}</>}
  </svg>;
}

function LanguageGlobe() {
  return <svg className="language-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18M5 6.5h14M5 17.5h14"/></svg>;
}

export function Settings() {
  const { dark, uiLanguage, voiceLanguage, set, t } = usePreferences();
  const dialog = useRef<HTMLDialogElement>(null);
  return <>
    <button className="settings-trigger" aria-label={t("Settings")} onClick={() => dialog.current?.showModal()}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 3-.7 2.4-2 .9-2.3-.6-2 3.5 1.7 1.8v2L2 14.8l2 3.5 2.3-.6 2 .9L9 21h4l.7-2.4 2-.9 2.3.6 2-3.5-1.7-1.8v-2L20 9.2l-2-3.5-2.3.6-2-.9L13 3z"/><circle cx="11" cy="12" r="3"/></svg>
    </button>
    <dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title" onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="settings-heading"><h2 id="settings-title">{t("Settings")}</h2><button className="settings-close" aria-label={t("Close")} onClick={() => dialog.current?.close()}>×</button></div>
      <label className="settings-row"><span>{t("Dark mode")}</span><button type="button" role="switch" aria-checked={dark} aria-label={t("Dark mode")} className="theme-switch" onClick={() => set({ dark: !dark })}><span /></button></label>
      <label className="settings-row" htmlFor="app-language"><span className="language-setting-label"><LanguageGlobe />{t("App language")}</span><span className="language-selection"><LanguageFlag language={uiLanguage} /><select id="app-language" value={uiLanguage} onChange={e => set({ uiLanguage: e.target.value as Language })}><option value="en">🇬🇧 English</option><option value="th">🇹🇭 ไทย</option><option value="yue">🇭🇰 廣東話</option></select></span></label>
      <label className="settings-row" htmlFor="voice-language"><span className="language-setting-label"><LanguageGlobe />{t("AI voice language")}</span><span className="language-selection"><LanguageFlag language={voiceLanguage} /><select id="voice-language" value={voiceLanguage} onChange={e => set({ voiceLanguage: e.target.value as Language })}><option value="th">🇹🇭 ไทย</option><option value="en">🇬🇧 English</option><option value="yue">🇭🇰 廣東話</option></select></span></label>
      <p className="settings-hint">{t("Used when Cally calls a shop.")}</p>
    </dialog>
  </>;
}

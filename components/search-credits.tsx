"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePreferences } from "./preferences";
import { priceBundle, type PaymentMethod } from "@/lib/payment-pricing";

type Wallet = { balance: number; reserved: number; orders: { id: string; credits: number; method: PaymentMethod; amount: number; status: string }[] };
const Context = createContext({ balance: null as number | null, reserve: async (): Promise<string | null> => null, release: async (_id: string) => {}, open: () => {} });
export const useSearchCredits = () => useContext(Context);

async function api(body?: object) {
  const res = await fetch("/api/credits", body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const value = await res.json();
  if (!res.ok) throw new Error(value.error || "Could not load credits.");
  return value;
}

export function SearchCreditsProvider({ children }: { children: ReactNode }) {
  const { uiLanguage } = usePreferences();
  const l = (en: string, th: string, yue: string) => uiLanguage === "th" ? th : uiLanguage === "yue" ? yue : en;
  const dialog = useRef<HTMLDialogElement>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [bundle, setBundle] = useState(5);
  const [customSelected, setCustomSelected] = useState(false);
  const [customAmount, setCustomAmount] = useState("20");
  const [method, setMethod] = useState<PaymentMethod>("utopia");
  const [order, setOrder] = useState<{ id: string; credits: number; method: PaymentMethod; totalSatang: number; qrVariant?: number | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const refresh = async () => setWallet(await api());
  useEffect(() => { void refresh().catch(() => setError(l("Could not load demo credits.", "โหลดเครดิตทดลองไม่สำเร็จ", "載入唔到示範額度。"))); }, []);
  const open = () => { setError(""); setMessage(""); dialog.current?.showModal(); void refresh().catch(e => setError(e.message)); };
  const reserve = async () => {
    setError("");
    try { const value = await api({ action: "reserve" }); setWallet(value); return value.reservationId as string; }
    catch (e) { dialog.current?.showModal(); setError(e instanceof Error ? e.message : "Could not reserve a credit."); return null; }
  };
  const release = async (id: string) => { const value = await api({ action: "release", id }); setWallet(value); };
  const quantity = customSelected ? Number(customAmount) : bundle;
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 1000;
  const quote = priceBundle(validQuantity ? quantity : 1, method);
  const animatePack = (button: HTMLButtonElement) => {
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) button.animate([{ transform: "scale(1)" }, { transform: "scale(.975)", offset: .35 }, { transform: "scale(1)" }], { duration: 220, easing: "cubic-bezier(.2,.8,.2,1)" });
  };
  const methodName = (value: PaymentMethod) => value === "utopia" ? "U-Topia" : value === "promptpay" ? "PromptPay QR" : value === "debit" ? l("Debit card", "บัตรเดบิต", "扣賬卡") : l("Standard", "ปกติ", "標準");
  const money = (satang: number) => new Intl.NumberFormat(uiLanguage === "th" ? "th-TH" : uiLanguage === "yue" ? "zh-HK" : "en-US", { style: "currency", currency: "THB" }).format(satang / 100);
  const statusName = (status: string) => status === "demo_paid" ? l("Simulated paid", "ชำระเงินจำลองแล้ว", "模擬付款完成") : status === "pending" ? l("Pending", "รอดำเนินการ", "處理中") : status === "expired" ? l("Expired", "หมดเวลา", "已過期") : l("Cancelled / failed", "ยกเลิก / ไม่สำเร็จ", "已取消／失敗");

  return <Context.Provider value={{ balance: wallet?.balance ?? null, reserve, release, open }}>
    {children}
    <button className="credits-trigger" onClick={open} aria-label={l(`${wallet?.balance ?? "–"} searches left. Search credits`, `เหลือค้นหาได้ ${wallet?.balance ?? "–"} ครั้ง เครดิตค้นหา`, `仲可以搜尋 ${wallet?.balance ?? "–"} 次。搜尋額度`)} title={l("Searches left", "จำนวนค้นหาที่เหลือ", "剩餘搜尋次數")}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m13 5-5 8h4l-1 6 5-9h-4z"/></svg><span>{wallet?.balance ?? "–"}</span><small>{l("left", "ครั้ง", "次")}</small></button>
    <dialog ref={dialog} className="settings-dialog credits-dialog" aria-labelledby="credits-title" onClick={e => { if (!busy && e.currentTarget === e.target) dialog.current?.close(); }}>
      <div className="settings-heading"><h2 id="credits-title">{l("Search credits", "เครดิตค้นหา", "搜尋額度")}</h2><button className="settings-close" aria-label={l("Close", "ปิด", "關閉")} onClick={() => dialog.current?.close()}>×</button></div>
      <span className="demo-label">{order?.method === "promptpay" ? l("DEMO CREDITS · SAMPLE QR", "เครดิตทดลอง · QR ตัวอย่าง", "示範額度 · 示範 QR") : l("DEMO · NO REAL MONEY", "ทดลอง · ไม่มีการใช้เงินจริง", "示範 · 不涉及真實付款")}</span>
      <div className="credit-balance"><b>{wallet?.balance ?? "–"}</b><span>{l("demo credits available", "เครดิตทดลองที่ใช้ได้", "可用示範額度")}{!!wallet?.reserved && <small>{l(`${wallet.reserved} reserved`, `สำรองไว้ ${wallet.reserved}`, `${wallet.reserved} 已預留`)}</small>}</span></div>
      <p className="credit-description">{l("Each search uses 1 credit and asks up to 5 nearby shops for a price. You start with 3 free demo credits.", "การค้นหาแต่ละครั้งใช้ 1 เครดิต และถามราคาจากร้านใกล้คุณได้สูงสุด 5 ร้าน เริ่มต้นด้วยเครดิตทดลองฟรี 3 เครดิต", "每次搜尋用 1 個額度，最多會問附近 5 間舖報價。開始時有 3 個免費示範額度。")}</p>
      {!order ? <>
        <div className="bundle-options" role="group" aria-label={l("Credit pack", "แพ็กเครดิต", "額度組合")}>
          {[1, 5, 10].map(n => <button key={n} type="button" className={!customSelected && bundle === n ? "selected" : ""} aria-pressed={!customSelected && bundle === n} onClick={e => { animatePack(e.currentTarget); setBundle(n); setCustomSelected(false); setMessage(""); }}>
            <span className="pack-check" aria-hidden="true">✓</span><b>{n}</b><span>{l(n === 1 ? "credit" : "credits", "เครดิต", "額度")}</span>
          </button>)}
          <button type="button" className={customSelected ? "custom-pack selected" : "custom-pack"} aria-pressed={customSelected} aria-expanded={customSelected} aria-controls="custom-credit-editor" onClick={e => { animatePack(e.currentTarget); setCustomSelected(true); setMessage(""); }}>
            <span className="pack-check" aria-hidden="true">✓</span><b>{l("Custom", "กำหนดเอง", "自訂")}</b><span>{customSelected && validQuantity ? quantity + " " + l("credits", "เครดิต", "額度") : l("Choose your amount", "เลือกจำนวนเครดิต", "揀你需要嘅數量")}</span>
          </button>
        </div>
        {customSelected && <div id="custom-credit-editor" className="custom-credit-editor">
          <label htmlFor="custom-credit-quantity">{l("Your credit amount", "จำนวนเครดิตของคุณ", "你嘅額度數量")}<small>{l("1–1,000 credits", "1–1,000 เครดิต", "1–1,000 個額度")}</small></label>
          <div className="credit-stepper">
            <button type="button" aria-label={l("Decrease credits", "ลดจำนวนเครดิต", "減少額度")} disabled={Number(customAmount) <= 1} onClick={() => setCustomAmount(String(Math.max(1, (Number(customAmount) || 1) - 1)))}>−</button>
            <input id="custom-credit-quantity" type="number" inputMode="numeric" min="1" max="1000" step="1" aria-label={l("Custom credit quantity", "จำนวนเครดิตที่ต้องการ", "自訂額度數量")} aria-invalid={!validQuantity} value={customAmount} onChange={e => { setCustomAmount(e.target.value); setMessage(""); }}/>
            <button type="button" aria-label={l("Increase credits", "เพิ่มจำนวนเครดิต", "增加額度")} disabled={Number(customAmount) >= 1000} onClick={() => setCustomAmount(String(Math.min(1000, (Number(customAmount) || 0) + 1)))}>+</button>
          </div>
        </div>}
        {customSelected && !validQuantity && <p className="sheet-note" role="alert">{l("Enter a whole number from 1 to 1000.", "ใส่จำนวนเต็มตั้งแต่ 1 ถึง 1000", "請輸入 1 至 1000 嘅整數。")}</p>}
        <fieldset className="payment-methods"><legend>{l("Payment method preview", "ตัวอย่างวิธีชำระเงิน", "付款方式預覽")}</legend>
          <label className={method === "utopia" ? "selected" : ""}><input type="radio" name="payment-method" checked={method === "utopia"} onChange={() => setMethod("utopia")}/><span><b>U-Topia</b><small>{l("Demo wallet checkout", "เช็กเอาต์กระเป๋าเงินจำลอง", "示範錢包結帳")}</small></span><em className="utopia-saving">{l("Save 5%", "ลด 5%", "慳 5%")}</em></label>
          <label className={method === "promptpay" ? "selected" : ""}><input type="radio" name="payment-method" checked={method === "promptpay"} onChange={() => setMethod("promptpay")}/><span><b>PromptPay QR</b><small>{l("Sample QR · demo only", "QR ตัวอย่าง · สำหรับทดลองเท่านั้น", "示範 QR · 只作示範")}</small></span></label>
          <label className={method === "debit" ? "selected" : ""}><input type="radio" name="payment-method" checked={method === "debit"} onChange={() => setMethod("debit")}/><span><b>{l("Debit card", "บัตรเดบิต", "扣賬卡")}</b><small>{l("Test card preview", "ตัวอย่างบัตรทดสอบ", "測試卡預覽")}</small></span></label>
        </fieldset>
        <div className="checkout-totals"><div><span>{l("Credits", "เครดิต", "額度")}</span><span>{validQuantity ? money(quote.subtotalSatang) : "—"}</span></div>{method === "utopia" && <div className="discount"><span>{l("U-Topia discount · 5%", "ส่วนลด U-Topia · 5%", "U-Topia 優惠 · 5%")}</span><span>−{validQuantity ? money(quote.discountSatang) : "—"}</span></div>}<div className="total"><b>{l("Demo total", "ยอดรวมจำลอง", "示範總額")}</b><b>{validQuantity ? money(quote.totalSatang) : "—"}</b></div></div>
        <button className="btn btn-primary credits-buy" disabled={busy || !wallet || !validQuantity} onClick={async () => { setBusy(true); setError(""); setMessage(""); try { setOrder(await api({ action: "order", credits: quantity, method })); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? "…" : l("Preview checkout", "ดูตัวอย่างการชำระเงิน", "預覽結帳")}</button>
      </> : <div className="demo-checkout">
        <h3>{methodName(order.method)}</h3><strong>{money(order.totalSatang)}</strong>
        {order.method === "promptpay" && <div className="promptpay-preview"><p className="qr-reference-warning">{l("SAMPLE QR · This is a placeholder, not a real account. Nothing can be paid with it.", "QR ตัวอย่าง · เป็นภาพตัวอย่าง ไม่ใช่บัญชีจริง ใช้ชำระเงินไม่ได้", "示範 QR · 只係示意圖，唔係真實戶口，唔可以用嚟付款。")}</p><img src={order.qrVariant === 1 ? "/payments/sample-qr-2.png" : "/payments/sample-qr-1.png"} alt={l("Sample QR (not a real account)", "QR ตัวอย่าง (ไม่ใช่บัญชีจริง)", "示範 QR（唔係真實戶口）")} width="228" height="278"/><small>{l("QR reference", "QR อ้างอิง", "QR 參考")} {(order.qrVariant ?? 0) + 1} · {l("Fixed for this order", "ใช้สำหรับรายการนี้", "呢張訂單固定使用")}</small></div>}
        {order.method === "debit" && <div className="debit-preview"><span>{l("Test card only · no card data is collected", "บัตรทดสอบเท่านั้น · ไม่เก็บข้อมูลบัตร", "只限測試卡 · 唔會收集卡資料")}</span><label>{l("Card number", "หมายเลขบัตร", "卡號")}<input readOnly value="4242 4242 4242 4242" aria-label={l("Test card number", "หมายเลขบัตรทดสอบ", "測試卡號")}/></label><div><label>{l("Expiry", "วันหมดอายุ", "到期日")}<input readOnly value="12 / 30" aria-label="Test expiry"/></label><label>CVC<input readOnly value="123" aria-label="Test CVC"/></label></div></div>}
        <p hidden={order.method === "promptpay"}>{l("Simulate approving this purchase. No wallet is connected and no money will move.", "จำลองการอนุมัติรายการนี้ ยังไม่ได้เชื่อมต่อกระเป๋าเงินและไม่มีการโอนเงินจริง", "模擬批准呢筆交易。未連接錢包，唔會轉走任何真實資金。")}</p>
        <button className="btn btn-primary credits-buy" disabled={busy} onClick={async () => { setBusy(true); setError(""); try { const value = await api({ action: "resolve", id: order.id, approve: true }); setWallet(value); setOrder(null); setMessage(value.status === "demo_paid" ? l("Demo purchase complete. Demo credits added.", "รายการจำลองสำเร็จ เพิ่มเครดิตทดลองแล้ว", "模擬購買完成，已加入示範額度。") : statusName(value.status)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? "…" : l("Simulate approval", "จำลองการอนุมัติ", "模擬批准")}</button>
        <button className="btn-text" disabled={busy} onClick={async () => { setBusy(true); try { const value = await api({ action: "resolve", id: order.id, approve: false }); setWallet(value); setOrder(null); setMessage(statusName(value.status)); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{l("Cancel demo payment", "ยกเลิกการชำระเงินจำลอง", "取消示範付款")}</button>
      </div>}
      {message && <p className="credit-message" role="status">{message}</p>}{error && <p className="sheet-note" role="alert">{error}</p>}
      {!!wallet?.orders.length && <details className="credit-history"><summary>{l("Demo activity", "กิจกรรมทดลอง", "示範記錄")}</summary>{wallet.orders.map(o => <div key={o.id}><span>{o.credits} × {methodName(o.method)}</span><span>{statusName(o.status)}</span></div>)}</details>}
      <p className="credit-footnote">{l("Real payments and U-bot auto-refill are not connected. This is a Cally-funded discount preview, not an official U-Topia checkout.", "ยังไม่เชื่อมต่อการชำระเงินจริงหรือเติมเครดิตอัตโนมัติ U-bot นี่เป็นตัวอย่างส่วนลดที่ Cally รับผิดชอบ ไม่ใช่เช็กเอาต์ทางการของ U-Topia", "未接通真實付款或 U-bot 自動增值。呢個係 Cally 提供嘅優惠預覽，唔係 U-Topia 官方結帳。")}</p>
      <a className="utopia-reference" href="https://u-topia.com/" target="_blank" rel="noreferrer">{l("Explore U-Topia", "รู้จัก U-Topia", "認識 U-Topia")} ↗</a>
    </dialog>
  </Context.Provider>;
}

# CallAround: UI spec for the app

**How to use this file:** paste or upload it into ChatGPT together with the 5 screen images, and say:
"Build these screens into our app exactly as described. Match the layout, text, colors and flow. Wire the buttons to our existing ElevenLabs calling logic where noted."

---

## 1. What the app does

The user says what they need fixed. The AI repeats it back. The user confirms. The AI calls 3–5 nearby shops at the same time and shows the options, cheapest first, with price, distance from home, and when it's ready.

The user never chooses how many shops to call. The app decides.

## 2. Flow

```
Speak  →  Confirm  →  Calling  →  Options  →  Call details
  ↑          │ "No, say it again"
  └──────────┘
```

- **Speak:** tap mic → record voice → speech-to-text → go to Confirm.
- **Confirm:** "Yes, find me a shop" → start calls → Calling. "No, say it again" → back to Speak.
- **Calling:** goes to Options automatically when all calls finish (or after a timeout). "Show results" jumps early. "Cancel" ends all calls.
- **Options:** "Book this one" calls the chosen shop back to book. Tapping any shop opens Call details. The X button returns to Speak.
- **Call details:** back arrow returns to Options.

## 3. Look and feel

Apple's current iOS style (Liquid Glass): frosted glass buttons and bars, soft blurred color behind, big bold titles, fully rounded buttons. Mobile only, designed at 390 × 844.

| Token | Value |
|---|---|
| Background | `#F1F2F5` |
| Text | `#111318` |
| Secondary text | `#5B606B` |
| Accent (green) | `#0F6E3B` |
| Accent light (badges) | `#E3F1E8` |
| Warning (orange text) | `#9A3F10` on `#FBEDE4` |
| Danger (Cancel) | `#A3231A` |
| Cards | white `#FFFFFF`, radius 22–28px |
| Font | `-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif` |
| Page padding | 20px sides, 58px top |

**Glass style** (back buttons, floating bars, highlight card):
```css
background: rgba(255,255,255,0.62);
backdrop-filter: blur(24px) saturate(180%);
-webkit-backdrop-filter: blur(24px) saturate(180%);
border: 1px solid rgba(255,255,255,0.85);
box-shadow: 0 12px 32px rgba(17,19,24,0.12), inset 0 1px 0 rgba(255,255,255,0.95);
```

**Background glow:** one blurred circle of the accent color, about 300px, `opacity: 0.16–0.22; filter: blur(70px)`, placed behind the main element of each screen.

**Buttons:** primary = accent fill, white text, 52–60px tall, fully rounded. Secondary = white/glass with a `#D9DCE2` border. Icons are simple line icons (2px stroke), no emoji. Minimum tap size 44px.

## 4. Screens

### Screen 1: Speak
- Top left: glass pill "Home · Asok" with a house line icon. Top right: round glass history button (clock icon).
- Centered title: **"What needs fixing?"** (34px bold). Below: "Just say it. I'll find the cheapest shop." (17px, secondary).
- Center: **big mic button**. Outer glass ring 228px, inner green circle 172px, white mic icon 72px.
- Under it: **"Tap and talk"** (17px semibold), then example text in grey: *"My phone screen is cracked, I need it fixed today"*.
- Bottom: secondary pill button "Type instead" (keyboard icon) for text input.

### Screen 2: Confirm
- Back button (glass, top left).
- Title: **"Is this right?"**
- White card, label "YOU SAID", then the exact transcript in quotes.
- Glass card with green border, label "I'LL ASK NEARBY SHOPS" and a small **Listen** button (speaker icon) that reads the summary aloud. Then 4 rows, label left (grey), value right (bold):
  - Fix: Cracked screen
  - Phone: iPhone 15
  - When: Today
  - Near: Home · Asok
- Bottom: primary button **"Yes, find me a shop"** with a check icon (60px). Below it: secondary button **"No, say it again"** (mic icon).

### Screen 3: Calling
- Centered: green phone circle (104px) inside two faint concentric rings (150px and 196px). Pulse these rings while calling.
- Title: **"Calling shops for you"**. Sub: "About a minute. You can put your phone down."
- White card listing each shop, one row each (52px tall), name left, status right:
  - Got a price (green), Talking… (blue `#1D4FA8`), Ringing… (grey), No answer (orange).
- Bottom: glass button "Show results", then red text button "Cancel".

### Screen 4: Options (results)
- Top: X button (glass, top left), "4 shops answered" (grey, top right).
- Title: **"Cheapest first"**.
- **Top pick card** (glass, green border): shop name + green badge "CHEAPEST". Then 3 big numbers side by side (26px bold), each with a small grey label:
  - **฿2,500** (Price, green), **1.2 km** (From home), **4:30** (Ready today)
- Primary button **"Book this one"** (phone icon).
- Then one white row per other shop, 4 columns: name | price | distance | ready time. If not available today, show the time in orange (e.g. "Tomorrow").
- Bottom line: "1 shop didn't pick up, so it's left out."

### Screen 5: Call details
- Back button + shop name title, sub "Call · 1:12 · completed".
- 3 chips: price (green), distance from home, ready time.
- Shield-check line: "The assistant said it was calling for a customer."
- Chat bubbles: AI on the right (green, white text), shop on the left (white).
- Bottom glass bar: play button (play the call recording) + primary "Book this one".

## 5. Data each shop result needs

```json
{
  "shop_name": "Soi 11 Mobile",
  "phone": "+66...",
  "status": "done | talking | ringing | no_answer | failed",
  "price_thb": 2500,
  "distance_km": 1.2,
  "ready_time": "2026-10-16T16:30:00+07:00",
  "available_today": true,
  "transcript": [{ "speaker": "agent|shop", "text": "..." }],
  "recording_url": "..."
}
```

**Ranking:** sort answered shops by `price_thb` ascending. Shops with `no_answer`/`failed` are hidden and counted in the bottom line. The top one gets the "CHEAPEST" card.

## 6. Notes

- All shop names and prices above are **sample demo data**.
- The voice agent must open each call with: "Hi, I'm a booking assistant calling for a customer."
- Calls are placed through ElevenLabs Agents (outbound call API) with a Twilio number. The app starts 3–5 calls at once and fills the Calling screen statuses as each call updates.

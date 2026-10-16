# Payment integration status

## Implemented
- Local demo-only credit wallet with three welcome credits; no real money or crypto token.
- Server-priced one/five-credit bundles at THB49/245, with merchant-funded U-topia demo discount of 5% (THB46.55/232.75). Integer satang calculations.
- Explicitly simulated checkout/approval, cancellation and activity history. Pending orders expire after ten minutes; expired state is evaluated on access.
- Server-side SQLite demo account, orders, search reservations and auditable ledger in .cally-data/demo-payments.sqlite; excluded from Git. Duplicate order approvals and reservation releases are idempotent, balances cannot go negative. Anonymous HttpOnly cookie identifies the local demo wallet, not a verified customer identity. Clearing cookies creates a new demo wallet.
- UI flow reserves one demo credit before search and releases it when finished/cancelled. Stale reservations are released on next wallet access after ten minutes. It always returns the credit until genuine quote comparability can be verified server-side. Client-reported/mock results cannot trigger paid settlement. The demo UI gate is not authentication or a production paid-call quota.
- At most the first three configured destinations are sent live calls; remaining demo shops stay mock. Existing voice time limits are provider/agent settings, not enforced by this credit module.
- English/Thai/Cantonese payment UI; U-topia official-site reference link.

## Not implemented / cannot claim
No merchant/payment provider, wallet connection, blockchain transaction, live payment callback, U-topia eligibility verification, real payment receipt/refund, U-bot access, auto-refill, monthly spending delegation or production billing. U-topia is a clearly disclosed preview selected by the user, not proof of integration. No real charges are made. No credit consumption is earned from mock quotes.

Do not use similarly named unrelated Utopia payment APIs. Official reference supplied by user: https://u-topia.com/. Live integration awaits organizer docs/merchant onboarding and verified settlement/eligibility signals. Customer authentication, durable hosted database and secured calling endpoints are also required before production. Local SQLite is for this laptop demo and is not suitable for Vercel serverless storage.

## Verification
Production build and TypeScript passed. node tests/demo-payments.cjs checks all prices, invalid packs/methods, account isolation, duplicate approval, cancellation, expiry, nonnegative reservations and repeated release. A browser purchase was simulated: balance went from 3 to 8 exactly once after explicit demo approval. No actual money or paid calls were used for testing.

## Running
Use Node 24 as in the app README; node:sqlite is required. Start the app normally. Click the small credit-count button beside settings. For isolated ledger tests run node tests/demo-payments.cjs. No new API keys are needed for the preview.

## Expanded checkout
Packs now include 1, 5, 10 and a custom whole quantity from 1 to 1000. Prices remain server-calculated at THB49 each, with the 5% U-topia-only discount. PromptPay QR and debit-card preview methods were added. The two user-provided QR images alternate per new PromptPay order per demo wallet (first/second/first); each order stores its assigned variant so it does not change mid-checkout. These static QR images may represent real recipients; the UI explicitly says not to transfer money for this demo and no bank payment verification or automatic credit delivery exists. Debit fields are read-only test data; real card details are never collected. No live provider processing was enabled. Tests cover 10/custom quantities, fractional/negative/oversized rejection, QR alternation, and all previous ledger checks. Browser checks confirmed custom pricing, both alternating QR references, and the debit-card preview. Local SQLite schema migrates existing demo accounts without losing balances.

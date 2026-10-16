# Cally payments proposal — standby, not implemented

Prepared 16 October 2026. No live payments, app changes, provider setup or repository pushes authorized by this planning document.

## Product
Sell non-transferable service credits, called search credits in the app. One credit covers one comparison attempt across at most three shops, with up to two connected minutes per shop, no unlimited retries. Proposed launch price: THB49; validate costs with 20–30 searches before promising profitability. Define a qualifying comparison as at least two genuinely comparable usable quotes. Show partial results honestly. Never use mock results for paid fulfillment.

## U-topia incentive
Apply a merchant-funded 5% discount to credit purchases made through a verified eligible U-topia payment method. Regular one-credit price THB49.00; U-topia THB46.55. Five credits: THB245.00 regular; THB232.75 U-topia. Calculate in integer satang on the server. Do not stack other promotions initially. The discount is on Cally credits, not on shop repair bills. Maximum contribution margin before other costs is reduced by THB2.45 per credit; no claim that U-topia funds the discount or offers lower processing fees.

## Proposed purchase flow
User selects a bundle, sees normal price, 5% discount and final payable amount, then explicitly approves payment in the supported provider flow. Pending / paid / failed / expired statuses are shown. Credit only after verified settlement/payment confirmation. A redirect, wallet connection or user-selected payment label is not proof of payment or U-topia eligibility. Store unique order/provider transaction identifiers and process confirmation once. Use signed provider callbacks or provider-supported server-side verification; exact mechanism requires organizer documentation.

## Spending a credit
Reserve a credit atomically before calls. Consume it once if the comparison qualifies; otherwise release it. Track concurrent searches centrally. Keep an auditable account credit ledger. Credit restoration is distinct from a monetary refund, and real refund terms need confirmation. Mock and live credits/results must be separated. Anonymous localStorage balances are for demo display only, not real paid credits.

## U-bot proposal, capability-dependent
U-bot can assist with purchasing the chosen bundle after explicit approval. If supported, offer opt-in agent refill under a user-defined monthly baht cap and per-purchase ceiling. Default is no automatic refill. Show spending used this month, timezone Asia/Bangkok, pending reservations and reset date. A cap is not a deposit. Payment authorization and spending enforcement must be provider/server enforced, never left to the model. Do not promise unattended spending or wallet access without documentation and authorization.

## Questions for organizers
1. Official hackathon U-topia/U-bot SDK and sandbox docs? Confirm identity; similarly named Utopia payment sites may be unrelated.
2. Which flow is supported: merchant checkout, wallet transfer, U-Card, or U-bot agent purchase?
3. Supported currency/network/asset, conversion quote lifetime, fees, merchant onboarding and settlement?
4. How can the server verify an eligible U-topia payment and confirmed payment? Signed callbacks, polling, or transaction receipt?
5. Test wallet/faucet, payment failures, expirations, refunds, duplicate events and webhook retries?
6. Agent spending limits, one-off approvals and revocation supported? What constitutes a qualifying sponsor integration for judging?

## Demo
Give judges free demo credits. Show a clearly labeled sandbox or simulated purchase: five credits THB245 minus THB12.25 U-topia discount = THB232.75. Show verified sandbox transaction proof only if actual organizer tools are available. Never display a simulated payment as paid on the live network. Suggested pitch: Cally compares shop quotes; U-topia makes buying search credits easy and gives users 5% off.

## Verified sources and uncertainty
Official U-topia site https://u-topia.com/ describes a wallet/payment ecosystem; https://u-topia.com/about describes its Visa card and spending features. These pages do not establish a public hackathon merchant SDK, U-bot payment interface, eligibility signal, sandbox or automatic-spending capability. Request the organizer's exact developer docs before choosing integration endpoints. A discount alone cannot guarantee judging points.

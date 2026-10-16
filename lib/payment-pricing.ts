export type PaymentMethod = "standard" | "utopia" | "promptpay" | "debit";
export function priceBundle(credits: number, method: PaymentMethod) {
  if (!Number.isInteger(credits) || credits < 1 || credits > 1000) throw new Error("Choose a whole number from 1 to 1000 credits.");
  if (!["standard", "utopia", "promptpay", "debit"].includes(method)) throw new Error("Unsupported payment method.");
  const subtotalSatang = credits * 4900;
  const discountSatang = method === "utopia" ? Math.round(subtotalSatang * 5 / 100) : 0;
  return { credits, method, subtotalSatang, discountSatang, totalSatang: subtotalSatang - discountSatang };
}

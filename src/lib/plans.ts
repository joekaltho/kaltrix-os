// Server-side source of truth for plan pricing (NGN, in naira — convert to
// kobo when comparing against Paystack amounts, which are in kobo).
//
// NOTE: this currently duplicates the pricing in
// src/app/(dashboard)/dashboard/upgrade/page.tsx. Keep the two in sync until
// that page is refactored to import from here directly. Drifting prices
// between the two means the webhook could reject legitimate payments (safe
// failure) or, worse, silently accept a mismatched one if you forget to
// update this file after a price change (unsafe) — so update this first.
export const PLAN_PRICES_NGN: Record<string, Record<'6month' | 'annual', number>> = {
  free: { '6month': 0, annual: 0 },
  growth: { '6month': 55000, annual: 99000 },
  pro: { '6month': 99000, annual: 179000 },
}

export function isValidPlanAmount(
  planKey: string,
  billing: '6month' | 'annual',
  amountInKobo: number
): boolean {
  const plan = PLAN_PRICES_NGN[planKey]
  if (!plan) return false
  const expectedNaira = plan[billing]
  if (expectedNaira === undefined) return false
  return amountInKobo === expectedNaira * 100
}

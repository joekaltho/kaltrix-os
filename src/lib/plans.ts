// Server-side source of truth for plan pricing (NGN, in naira — convert to
// kobo when comparing against Paystack amounts, which are in kobo).
//
// NOTE: this currently duplicates the pricing in
// src/app/(dashboard)/dashboard/upgrade/page.tsx and src/app/page.tsx (the
// landing page). Keep them in sync until those pages import from here
// directly. Drifting prices means the webhook could reject legitimate
// payments (safe failure) or, worse, silently accept a mismatched one if you
// forget to update this file after a price change (unsafe) — so update this
// first.
//
// Monthly is intentionally the worst per-month value and annual the best —
// longer commitments must stay cheaper per month. Don't change 6month/annual
// here without also updating the two pages above and confirming the ordering
// still holds via monthlyEquivNgn().
export type BillingPeriod = 'monthly' | '6month' | 'annual'

export const PLAN_PRICES_NGN: Record<string, Record<BillingPeriod, number>> = {
  free: { monthly: 0, '6month': 0, annual: 0 },
  growth: { monthly: 12000, '6month': 55000, annual: 99000 },
  pro: { monthly: 22000, '6month': 99000, annual: 179000 },
}

const BILLING_PERIOD_MONTHS: Record<BillingPeriod, number> = {
  monthly: 1,
  '6month': 6,
  annual: 12,
}

// Per-month cost of a given plan/billing combo, for display ("₦X/mo") — the
// single place this math happens so the landing page and upgrade page can't
// drift apart on it.
export function monthlyEquivNgn(planKey: string, billing: BillingPeriod): number {
  const plan = PLAN_PRICES_NGN[planKey]
  if (!plan) return 0
  return Math.round(plan[billing] / BILLING_PERIOD_MONTHS[billing])
}

export function isValidPlanAmount(
  planKey: string,
  billing: BillingPeriod,
  amountInKobo: number
): boolean {
  const plan = PLAN_PRICES_NGN[planKey]
  if (!plan) return false
  const expectedNaira = plan[billing]
  if (expectedNaira === undefined) return false
  return amountInKobo === expectedNaira * 100
}

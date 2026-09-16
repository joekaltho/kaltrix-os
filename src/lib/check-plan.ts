import { createClient, getSessionUser } from '@/lib/supabase/client'

export type Plan = 'free' | 'growth' | 'pro'

// Shape of a public.subscriptions row, as far as plan resolution cares.
// (See the fuller `Subscription` type in '@/types' for the whole table.)
export interface SubscriptionRecord {
  plan: string | null
  status: string | null
  expires_at: string | null
}

/**
 * The one place that turns a subscriptions row into an effective Plan.
 * Mirrors the server-side rules already enforced in Supabase (see the
 * provision_trial_subscription / expire_trial_subscriptions functions and
 * the protect_subscription_fields trigger on public.subscriptions):
 *
 *  - provision_trial_subscription() (AFTER INSERT trigger on businesses)
 *    creates plan='pro', status='trialing', expires_at = now() + 30 days
 *    for every new business — this is the existing 30-day Pro trial.
 *  - status 'active' (set by the Paystack webhook after a verified payment,
 *    or by either expiry sweep below) grants `plan` while expires_at is
 *    still in the future. The webhook sets expires_at to the end of the
 *    paid billing period (no auto-renewal — see Terms §5); a free-tier row
 *    has expires_at = null and never expires this way.
 *  - status 'trialing' grants `plan` only while expires_at is still in the
 *    future.
 *  - two pg_cron jobs, each every 15 minutes, keep the DB itself consistent
 *    with this function so nothing outside the app (admin views, direct
 *    queries) sees a stale plan: "expire-trial-subscriptions" flips a
 *    lapsed trial to plan='free'/status='active', and
 *    "expire-active-subscriptions" does the same for a lapsed paid plan.
 *    This function treats a lapsed-but-not-yet-swept row as free either
 *    way, so there's no window where an expired plan still reads as paid
 *    while waiting on the next cron tick.
 *  - no row, or any other status -> free.
 */
export function resolveEffectivePlan(row: SubscriptionRecord | null | undefined): Plan {
  if (!row || !row.plan) return 'free'
  const plan = row.plan as Plan

  if (row.status === 'active') {
    if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return 'free'
    return plan
  }
  if (row.status === 'trialing') {
    return row.expires_at && new Date(row.expires_at).getTime() > Date.now() ? plan : 'free'
  }
  return 'free'
}

export interface SubscriptionState {
  plan: Plan
  status: string | null
  isTrialing: boolean
  trialExpired: boolean
  expiresAt: string | null
  trialDaysLeft: number | null
  hasSubscription: boolean
}

const NO_SUBSCRIPTION: SubscriptionState = {
  plan: 'free',
  status: null,
  isTrialing: false,
  trialExpired: false,
  expiresAt: null,
  trialDaysLeft: null,
  hasSubscription: false,
}

/**
 * Fetches and resolves the subscription state for a known business.
 * This is the single source of truth the dashboard, the upgrade page, and
 * every Pro-only guard/component read from — nothing should query
 * `subscriptions` directly outside of this file and the Paystack webhook.
 */
export async function getSubscriptionState(businessId: string): Promise<SubscriptionState> {
  const supabase = createClient()
  const { data: row } = await supabase
    .from('subscriptions')
    .select('plan, status, expires_at')
    .eq('business_id', businessId)
    .maybeSingle()

  if (!row) return NO_SUBSCRIPTION

  const plan = resolveEffectivePlan(row)
  const expiresAtMs = row.expires_at ? new Date(row.expires_at).getTime() : null
  const rawTrialing = row.status === 'trialing'
  const notExpired = expiresAtMs !== null && expiresAtMs > Date.now()
  const isTrialing = rawTrialing && notExpired

  return {
    plan,
    status: row.status,
    isTrialing,
    trialExpired: rawTrialing && !notExpired,
    expiresAt: row.expires_at,
    trialDaysLeft:
      isTrialing && expiresAtMs !== null
        ? Math.max(0, Math.ceil((expiresAtMs - Date.now()) / 86_400_000))
        : null,
    hasSubscription: true,
  }
}

/**
 * Convenience wrapper for callers (the Pro-feature guards) that only need
 * the plan and don't already have the business_id in scope. Resolves the
 * caller's own business, then delegates to getSubscriptionState().
 *
 * Perf note (Sep 2026 flow-by-flow performance pass): this used to resolve
 * business.id internally and then discard it, returning only the plan --
 * which meant every guard's children (the bookings/invoices/customers/
 * listings "new" pages) had to re-run the exact same `businesses` query a
 * second time in their submit handlers just to get an id this function
 * already had. getCurrentBusinessAndPlan() below returns it; guards pass
 * it down via BusinessContext (see business-context.tsx) so it's resolved
 * once per page visit, not once per component. getCurrentPlan() is kept
 * as a thin wrapper since nothing outside this pass needs to change.
 */
export interface CurrentBusinessAndPlan {
  userId: string | null
  businessId: string | null
  plan: Plan
}

export async function getCurrentBusinessAndPlan(): Promise<CurrentBusinessAndPlan> {
  const supabase = createClient()
  const { data: { user } } = await getSessionUser(supabase)
  if (!user) return { userId: null, businessId: null, plan: 'free' }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!business) return { userId: user.id, businessId: null, plan: 'free' }

  const { plan } = await getSubscriptionState(business.id)
  return { userId: user.id, businessId: business.id, plan }
}

export async function getCurrentPlan(): Promise<Plan> {
  return (await getCurrentBusinessAndPlan()).plan
}

export function hasFeature(plan: Plan, feature: 'bookings' | 'crm' | 'invoices' | 'analytics'): boolean {
  switch (plan) {
    case 'pro':
      return true
    case 'growth':
      return ['bookings', 'crm', 'invoices'].includes(feature)
    case 'free':
      return false
    default:
      return false
  }
}

// Listings are available on every plan, unlike the gated features above -
// free tier is capped, Growth and Pro are unlimited (returns null = no cap).
export const LISTING_FREE_LIMIT = 10

export function getListingLimit(plan: Plan): number | null {
  return plan === 'free' ? LISTING_FREE_LIMIT : null
}

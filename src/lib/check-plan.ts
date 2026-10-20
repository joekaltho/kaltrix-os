import { createClient, getSessionUser } from '@/lib/supabase/client'
import { subscriptionStateFromRow, type Plan, type SubscriptionState } from '@/lib/plan-state'
import { writeIdentityCache } from '@/lib/session-cache'

export {
  resolveEffectivePlan,
  subscriptionStateFromRow,
  hasFeature,
  type Plan,
  type SubscriptionRecord,
  type SubscriptionState,
} from '@/lib/plan-state'

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

  return subscriptionStateFromRow(row)
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

// Perf note: this used to be getSession (local) -> businesses -> subscriptions, two
// sequential network round trips on every guarded page. The subscription row now
// comes back embedded in the same business query (one round trip; RLS applies to the
// embedded table exactly as to a direct query), and the result is remembered in the
// in-memory session cache (see session-cache.ts) so the guards can show the page at
// once next time and re-validate in the background.
export async function getCurrentBusinessAndPlan(): Promise<CurrentBusinessAndPlan> {
  const supabase = createClient()
  const { data: { user } } = await getSessionUser(supabase)
  if (!user) return { userId: null, businessId: null, plan: 'free' }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, subscriptions(plan, status, expires_at)')
    .eq('user_id', user.id)
    .maybeSingle()

  let result: CurrentBusinessAndPlan
  if (error) {
    // Embedded lookup failed: fall back to the plain two-step lookup.
    const { data: plain } = await supabase.from('businesses').select('id').eq('user_id', user.id).maybeSingle()
    if (!plain) return { userId: user.id, businessId: null, plan: 'free' }
    const { plan } = await getSubscriptionState(plain.id)
    result = { userId: user.id, businessId: plain.id, plan }
  } else if (!business) {
    return { userId: user.id, businessId: null, plan: 'free' }
  } else {
    const sub = Array.isArray(business.subscriptions) ? business.subscriptions[0] : business.subscriptions
    result = { userId: user.id, businessId: business.id, plan: subscriptionStateFromRow(sub).plan }
  }

  writeIdentityCache({ userId: user.id, businessId: result.businessId, plan: result.plan })
  return result
}

export async function getCurrentPlan(): Promise<Plan> {
  return (await getCurrentBusinessAndPlan()).plan
}

// Listings are available on every plan, unlike the gated features above -
// free tier is capped, Growth and Pro are unlimited (returns null = no cap).
export const LISTING_FREE_LIMIT = 10

export function getListingLimit(plan: Plan): number | null {
  return plan === 'free' ? LISTING_FREE_LIMIT : null
}

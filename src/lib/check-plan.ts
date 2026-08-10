import { createClient } from '@/lib/supabase/client'

export type Plan = 'free' | 'growth' | 'pro'

export async function getCurrentPlan(): Promise<Plan> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'free'

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!business) return 'free'

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('plan')
    .eq('business_id', business.id)
    .eq('status', 'active')
    .single()

  return (subscription?.plan as Plan) || 'free'
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
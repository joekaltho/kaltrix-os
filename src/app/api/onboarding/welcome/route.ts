import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  apiError,
  checkRateLimits,
  getClientIp,
  rateLimitResponse,
  scopedIpHash,
} from '@/lib/api-guard'
import { isEmailConfigured, sendEmail } from '@/lib/resend'
import { buildWelcomeEmail } from '@/lib/welcome-email'
import { deliverWelcomeEmail } from '@/lib/welcome-delivery'

// Sends the welcome email for the SIGNED-IN user's own business.
//
// Nothing is taken from the request: no body, no business id, no address. The
// recipient is the confirmed email on the caller's session; the business is
// looked up by that session's user id. So this endpoint can only ever email a
// person about their own account, and calling it repeatedly (the dashboard does,
// once per session, to retry a failed send) is harmless: the outbox claim in the
// database guarantees at most one email.
//
// Email problems never surface as errors to the caller: the response is always
// { status } with 200, and registration/dashboard use never depend on it.

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Please sign in', 401)

    // Only ever write to an address the user has confirmed they control.
    if (!user.email || !user.email_confirmed_at) {
      return NextResponse.json({ status: 'skipped' })
    }

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (err) {
      console.error('Welcome email: service client unavailable:', err instanceof Error ? err.message : err)
      return apiError('Service temporarily unavailable — please try again shortly', 503)
    }

    const limit = await checkRateLimits(service, [
      { key: `welcome:user:${user.id}`, max: 10, windowSeconds: 3600 },
      { key: `welcome:ip:${scopedIpHash(getClientIp(request), 'rl-welcome')}`, max: 30, windowSeconds: 3600 },
    ])
    if (limit.status !== 'ok') return rateLimitResponse(limit)

    // No key configured (e.g. a preview deploy): leave the outbox row pending so
    // it is sent once the key exists. Checked before claiming so no attempt is used.
    if (!isEmailConfigured()) return NextResponse.json({ status: 'not_configured' })

    const { data: business, error: businessError } = await service
      .from('businesses')
      .select('id, business_name, slug')
      .eq('user_id', user.id)
      .maybeSingle()
    if (businessError) {
      console.error('Welcome email: business lookup failed:', businessError.code)
      return NextResponse.json({ status: 'failed' })
    }
    if (!business) return NextResponse.json({ status: 'skipped' })

    const status = await deliverWelcomeEmail({
      service,
      businessId: business.id,
      recipient: user.email,
      email: buildWelcomeEmail({ businessName: business.business_name ?? '', slug: business.slug }),
      send: sendEmail,
    })

    return NextResponse.json({ status })
  } catch (err) {
    console.error('Welcome email error:', err instanceof Error ? err.message : err)
    return NextResponse.json({ status: 'failed' })
  }
}

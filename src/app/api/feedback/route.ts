import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  apiError,
  checkRateLimits,
  getClientIp,
  rateLimitResponse,
  readJsonBody,
  scopedIpHash,
} from '@/lib/api-guard'
import { validateFeedbackInput } from '@/lib/validation'

// Product feedback from businesses and customers. This is the ONLY write path
// for public.feedback: the browser never inserts into Supabase directly, and
// anon/authenticated have no INSERT privilege on the table.
//
// The server owns the row. `source` and `business_id` are derived from the
// caller's session, never read from the request body:
//   - signed in AND owns a business -> source 'business', that business_id
//   - anyone else (anonymous visitor, or a signed-in non-owner) -> 'customer'

export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request)
    if (!parsedBody.ok) return parsedBody.response

    const input = validateFeedbackInput(parsedBody.body)
    if (!input.ok) return apiError(input.error, 400)
    const feedback = input.value

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (err) {
      console.error('Feedback submission: service client unavailable:', err instanceof Error ? err.message : err)
      return apiError('Service temporarily unavailable — please try again shortly', 503)
    }

    // Who is this? Session lookup only; failure just means "anonymous".
    let businessId: string | null = null
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: business } = await service
          .from('businesses')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
        businessId = business?.id ?? null
      }
    } catch {
      businessId = null
    }

    const subject = scopedIpHash(getClientIp(request), 'rl-feedback')
    const limit = await checkRateLimits(service, [
      { key: `feedback:ip:${subject}`, max: 5, windowSeconds: 3600 },
      ...(businessId ? [{ key: `feedback:biz:${businessId}`, max: 10, windowSeconds: 86400 }] : []),
    ])
    if (limit.status !== 'ok') return rateLimitResponse(limit)

    const { error } = await service.from('feedback').insert({
      source: businessId ? 'business' : 'customer',
      kind: feedback.kind,
      message: feedback.message,
      contact: feedback.contact,
      business_id: businessId,
    })
    if (error) {
      console.error('Feedback submission failed:', error.code)
      return apiError('Could not send feedback', 500)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Feedback submission error:', err instanceof Error ? err.message : err)
    return apiError('Invalid request', 400)
  }
}

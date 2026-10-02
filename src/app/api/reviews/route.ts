import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  apiError,
  checkRateLimits,
  getClientIp,
  hashIp,
  rateLimitResponse,
  readJsonBody,
  scopedIpHash,
} from '@/lib/api-guard'
import { validateReviewInput } from '@/lib/validation'

// Reviews stay anonymous/frictionless by product decision (see
// reviews_public_insert.sql) -- but they are no longer written by the browser
// straight to Supabase. This route is the ONLY write path for reviews: it
// validates the input, rate-limits, checks the business exists, captures a
// *hashed* submitter IP server-side for the review-integrity signals (burst
// detection etc.) and inserts with the service-role client. Direct anon/
// authenticated INSERT on public.reviews is revoked at the database level.
//
// The raw IP is never stored or exposed -- only a one-way sha256 hash. Set
// REVIEW_IP_SALT in production so the hash can't be reversed by brute-forcing
// the (small) IPv4 space.
//
// Moderation fields are not settable here: the insert below never includes
// them, and protect_review_integrity_fields_trigger resets them on INSERT.

export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request)
    if (!parsedBody.ok) return parsedBody.response

    const input = validateReviewInput(parsedBody.body)
    if (!input.ok) return apiError(input.error, 400)
    const review = input.value

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (err) {
      console.error('Review submission: service client unavailable:', err instanceof Error ? err.message : err)
      return apiError('Service temporarily unavailable — please try again shortly', 503)
    }

    const ip = getClientIp(request)
    const subject = scopedIpHash(ip, 'rl-review')
    const limit = await checkRateLimits(service, [
      { key: `review:ip:${subject}`, max: 10, windowSeconds: 3600 },
      { key: `review:ip-biz:${subject}:${review.business_id}`, max: 3, windowSeconds: 86400 },
      { key: `review:biz:${review.business_id}`, max: 100, windowSeconds: 3600 },
    ])
    if (limit.status !== 'ok') return rateLimitResponse(limit)

    const { data: business, error: businessError } = await service
      .from('businesses')
      .select('id')
      .eq('id', review.business_id)
      .maybeSingle()
    if (businessError) {
      console.error('Review submission: business lookup failed:', businessError.code)
      return apiError('Could not submit review', 500)
    }
    if (!business) return apiError('Business not found', 404)

    const { data, error } = await service
      .from('reviews')
      .insert({
        business_id: review.business_id,
        reviewer_name: review.reviewer_name,
        rating: review.rating,
        comment: review.comment,
        reviewer_phone: review.reviewer_phone,
        reviewer_email: review.reviewer_email,
        reviewer_ip_hash: ip ? hashIp(ip) : null,
      })
      .select('id, reviewer_name, rating, comment, created_at, moderation_status')
      .single()

    if (error) {
      console.error('Review submission failed:', error.code)
      return apiError('Could not submit review', 500)
    }

    return NextResponse.json({ review: data })
  } catch (err) {
    console.error('Review submission error:', err instanceof Error ? err.message : err)
    return apiError('Invalid request', 400)
  }
}

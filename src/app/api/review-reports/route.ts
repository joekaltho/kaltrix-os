import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  apiError,
  checkRateLimits,
  getClientIp,
  rateLimitResponse,
  readJsonBody,
  scopedIpHash,
} from '@/lib/api-guard'
import { validateReportInput } from '@/lib/validation'

// Public "report this review" endpoint. This is the ONLY write path for
// public.review_reports: the browser no longer inserts into Supabase directly,
// and direct anon/authenticated INSERT on that table is revoked at the
// database level.
//
// One report per visitor per review: the route hashes the caller's IP (never
// stored raw) and passes it to public.submit_review_report(), which records a
// (review_id, hash) fingerprint and the report in ONE transaction. A repeat
// from the same visitor returns 'duplicate'. The existing triggers still do
// the rest (business_id fill, status forced to 'open', and auto-flagging a
// review at 3+ open reports) -- moderation behaviour is unchanged.
//
// Note: visitors behind a shared IP (e.g. carrier-grade NAT) share one report
// per review. That is the accepted trade-off of "one report per visitor/IP".

export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request)
    if (!parsedBody.ok) return parsedBody.response

    const input = validateReportInput(parsedBody.body)
    if (!input.ok) return apiError(input.error, 400)
    const report = input.value

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (err) {
      console.error('Report submission: service client unavailable:', err instanceof Error ? err.message : err)
      return apiError('Service temporarily unavailable — please try again shortly', 503)
    }

    const ip = getClientIp(request)
    const limit = await checkRateLimits(service, [
      { key: `report:ip:${scopedIpHash(ip, 'rl-report')}`, max: 20, windowSeconds: 3600 },
    ])
    if (limit.status !== 'ok') return rateLimitResponse(limit)

    const { data, error } = await service.rpc('submit_review_report', {
      p_review_id: report.review_id,
      p_reason: report.reason,
      p_details: report.details,
      p_reporter_hash: scopedIpHash(ip, 'report-dedupe'),
    })
    if (error) {
      console.error('Report submission failed:', error.code)
      return apiError('Could not submit report', 500)
    }

    if (data === 'duplicate') {
      return apiError('You have already reported this review', 409)
    }
    if (data === 'not_found') return apiError('Review not found', 404)
    if (data !== 'ok') {
      console.error('Report submission: unexpected RPC result')
      return apiError('Could not submit report', 500)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Report submission error:', err instanceof Error ? err.message : err)
    return apiError('Invalid request', 400)
  }
}

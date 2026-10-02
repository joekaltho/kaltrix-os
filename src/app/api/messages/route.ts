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
import { validateMessageInput } from '@/lib/validation'

// Public "send a message to this business" endpoint. This is the ONLY write
// path for public.messages: the browser no longer inserts into Supabase
// directly, and direct anon/authenticated INSERT on that table is revoked at
// the database level.
//
// The server owns the row: the insert below sets only business_id,
// sender_name, sender_phone, content and is_read=false. created_at comes from
// the column default (server clock) and nothing else is client-settable.

export async function POST(request: Request) {
  try {
    const parsedBody = await readJsonBody(request)
    if (!parsedBody.ok) return parsedBody.response

    const input = validateMessageInput(parsedBody.body)
    if (!input.ok) return apiError(input.error, 400)
    const message = input.value

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (err) {
      console.error('Message submission: service client unavailable:', err instanceof Error ? err.message : err)
      return apiError('Service temporarily unavailable — please try again shortly', 503)
    }

    const subject = scopedIpHash(getClientIp(request), 'rl-message')
    const limit = await checkRateLimits(service, [
      { key: `message:ip:${subject}`, max: 10, windowSeconds: 3600 },
      { key: `message:ip-biz:${subject}:${message.business_id}`, max: 3, windowSeconds: 3600 },
      { key: `message:biz:${message.business_id}`, max: 100, windowSeconds: 3600 },
    ])
    if (limit.status !== 'ok') return rateLimitResponse(limit)

    const { data: business, error: businessError } = await service
      .from('businesses')
      .select('id')
      .eq('id', message.business_id)
      .maybeSingle()
    if (businessError) {
      console.error('Message submission: business lookup failed:', businessError.code)
      return apiError('Could not send message', 500)
    }
    if (!business) return apiError('Business not found', 404)

    const { error } = await service.from('messages').insert({
      business_id: message.business_id,
      sender_name: message.sender_name,
      sender_phone: message.sender_phone,
      content: message.content,
      is_read: false,
    })
    if (error) {
      console.error('Message submission failed:', error.code)
      return apiError('Could not send message', 500)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Message submission error:', err instanceof Error ? err.message : err)
    return apiError('Invalid request', 400)
  }
}

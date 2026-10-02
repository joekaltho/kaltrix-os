import 'server-only'
import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import type { createServiceClient } from '@/lib/supabase/service'

// Shared guards for the public write endpoints (/api/reviews, /api/messages,
// /api/review-reports). SERVER-ONLY: the `server-only` import above makes the
// build fail if any client component ever imports this file (directly or
// transitively), so nothing here -- or the service-role client these routes
// use -- can reach a browser bundle.

export type ServiceClient = ReturnType<typeof createServiceClient>

const MAX_BODY_BYTES = 16 * 1024

// Vercel overwrites x-forwarded-for with the real client address, so the
// first hop is the client. (Same logic /api/reviews has always used.)
export function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}

function salt(): string {
  return process.env.REVIEW_IP_SALT || 'kaltrix-review-integrity-fallback-salt'
}

// UNCHANGED from the original /api/reviews implementation on purpose:
// reviews.reviewer_ip_hash values already stored (and the burst-detection
// signal that compares them) must keep matching.
export function hashIp(ip: string): string {
  return createHash('sha256').update(salt() + ip).digest('hex')
}

// Domain-separated hash for rate-limit keys and the report de-duplication
// fingerprint, so those values can't be correlated with reviewer_ip_hash.
// Raw IPs are never stored anywhere.
export function scopedIpHash(ip: string | null, scope: string): string {
  if (!ip) return 'unknown'
  return createHash('sha256').update(`${salt()}:${scope}:${ip}`).digest('hex').slice(0, 32)
}

export function apiError(message: string, status: number, headers?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers })
}

type BodyResult = { ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }

// Reads a small JSON object body. Rejects oversized, malformed or non-object
// payloads before any validation or database work happens.
export async function readJsonBody(request: Request): Promise<BodyResult> {
  const declared = Number(request.headers.get('content-length') ?? 0)
  if (declared > MAX_BODY_BYTES) return { ok: false, response: apiError('Request too large', 413) }

  let text: string
  try {
    text = await request.text()
  } catch {
    return { ok: false, response: apiError('Invalid request', 400) }
  }
  if (text.length > MAX_BODY_BYTES) return { ok: false, response: apiError('Request too large', 413) }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, response: apiError('Invalid request', 400) }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, response: apiError('Invalid request', 400) }
  }
  return { ok: true, body: parsed as Record<string, unknown> }
}

export interface RateLimitRule {
  key: string
  max: number
  windowSeconds: number
}

export type RateLimitOutcome =
  | { status: 'ok' }
  | { status: 'limited'; retryAfterSeconds: number }
  | { status: 'error' }

// Evaluates every rule through public.check_rate_limit() (SECURITY DEFINER,
// executable only by service_role). Fixed windows, so Retry-After is the time
// left in the current window.
//
// FAILS CLOSED: if the limiter itself errors, the request is refused rather
// than waved through -- an attacker must not be able to switch the limiter off
// by making it fail.
export async function checkRateLimits(
  service: ServiceClient,
  rules: RateLimitRule[]
): Promise<RateLimitOutcome> {
  for (const rule of rules) {
    const { data, error } = await service.rpc('check_rate_limit', {
      p_key: rule.key,
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
    })
    if (error || typeof data !== 'boolean') {
      console.error('Rate limit check failed:', error?.code ?? 'unexpected response')
      return { status: 'error' }
    }
    if (data === false) {
      const nowSeconds = Math.floor(Date.now() / 1000)
      return { status: 'limited', retryAfterSeconds: rule.windowSeconds - (nowSeconds % rule.windowSeconds) }
    }
  }
  return { status: 'ok' }
}

export function rateLimitResponse(outcome: Exclude<RateLimitOutcome, { status: 'ok' }>) {
  if (outcome.status === 'limited') {
    return apiError('Too many requests — please wait a while and try again', 429, {
      'Retry-After': String(outcome.retryAfterSeconds),
    })
  }
  return apiError('Service temporarily unavailable — please try again shortly', 503)
}

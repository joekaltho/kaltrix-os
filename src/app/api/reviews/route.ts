import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { createHash } from 'crypto'

// Reviews stay anonymous/frictionless by product decision (see
// reviews_public_insert.sql) -- this route exists only so we can capture a
// *hashed* submitter IP server-side for the review-integrity signals
// (burst detection etc). The client can't see or set this itself: a
// browser has no way to know its own public-facing IP as Supabase/Vercel
// sees it, and routing through this route (vs a direct client insert)
// means we're the ones reading it from request headers, not trusting
// whatever a client claims.
//
// This never stores or exposes the raw IP -- only a one-way sha256 hash,
// used purely to notice "many reviews from the same place, fast." Set
// REVIEW_IP_SALT in production so the hash can't be reversed by brute-
// forcing the (small) IPv4 space; falls back to a fixed salt otherwise so
// this still degrades gracefully rather than breaking review submission.
function hashIp(ip: string): string {
  const salt = process.env.REVIEW_IP_SALT || 'kaltrix-review-integrity-fallback-salt'
  return createHash('sha256').update(salt + ip).digest('hex')
}

function getClientIp(request: Request): string | null {
  // Vercel sets x-forwarded-for; take the first (client) hop.
  const forwardedFor = request.headers.get('x-forwarded-for')
  if (forwardedFor) return forwardedFor.split(',')[0].trim()
  const realIp = request.headers.get('x-real-ip')
  if (realIp) return realIp.trim()
  return null
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { business_id, reviewer_name, rating, comment, reviewer_phone, reviewer_email } = body

    if (!business_id || !reviewer_name || !comment) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    const numericRating = Number(rating)
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return NextResponse.json({ error: 'Rating must be an integer from 1 to 5' }, { status: 400 })
    }

    const ip = getClientIp(request)
    const reviewer_ip_hash = ip ? hashIp(ip) : null

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('reviews')
      .insert({
        business_id,
        reviewer_name,
        rating: numericRating,
        comment,
        reviewer_phone: reviewer_phone || null,
        reviewer_email: reviewer_email || null,
        reviewer_ip_hash,
      })
      .select('id, reviewer_name, rating, comment, created_at, moderation_status')
      .single()

    if (error) {
      console.error('Review submission failed:', error)
      return NextResponse.json({ error: 'Could not submit review' }, { status: 500 })
    }

    return NextResponse.json({ review: data })
  } catch (err) {
    console.error('Review submission error:', err)
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
}

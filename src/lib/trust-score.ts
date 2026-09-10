// KaltrixOS TrustScore — shared types + display helpers.
//
// The score itself is computed server-side, in Postgres, by
// calculate_trust_score_from_fields() (see
// supabase/migrations/20260909_trust_score_v2.sql). It runs automatically
// on every business insert/update and whenever a review, booking, or
// invoice changes. There is no client-side scoring logic anymore — the
// client only reads business.trust_score and business.trust_signals and
// displays them. This file used to contain a client-side
// calculateTrustScore() built entirely from self-reported form fields
// (name length, description length, has-a-website, etc); that function
// wrote a fabricated-looking number straight to the database and has been
// removed.

export type TrustSignalTier = 'verified' | 'behavioral' | 'self_reported'
export type TrustSignalStatus = 'complete' | 'partial' | 'none'

export interface TrustSignal {
  key: string
  label: string
  tier: TrustSignalTier
  status: TrustSignalStatus
  detail: string
  points: number
  max_points: number
}

export const TRUST_TIER_LABEL: Record<TrustSignalTier, string> = {
  verified: 'Verified',
  behavioral: 'Activity',
  self_reported: 'Self-reported',
}

export function trustSignalIcon(status: TrustSignalStatus): string {
  if (status === 'complete') return '🟢'
  if (status === 'partial') return '🟡'
  return '⚪'
}

export function trustScoreTone(score: number): 'high' | 'medium' | 'low' {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

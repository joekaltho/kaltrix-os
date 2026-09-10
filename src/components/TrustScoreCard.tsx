'use client'

import { TrustSignal, trustSignalIcon, trustScoreTone } from '@/lib/trust-score'

const toneClass: Record<'high' | 'medium' | 'low', string> = {
  high: 'text-brand border-brand/20 bg-brandBg',
  medium: 'text-amber-600 border-amber-200 bg-amber-50',
  low: 'text-red-500 border-red-200 bg-red-50',
}

// What the business owner can actually do about each not-yet-earned signal.
// Only ever shown for signals that exist in this list — never invented.
const IMPROVE_ACTIONS: Record<string, string> = {
  admin_verified: 'Reach out for business verification',
  email_verified: 'Confirm your email address',
  reviews: 'Ask happy customers to leave a review',
  activity: 'Log bookings and invoices as you take them',
  longevity: 'Keeps growing the longer you stay active',
  profile: 'Complete your business profile (logo, website, description)',
}

export default function TrustScoreCard({ score, signals }: { score: number; signals: TrustSignal[] }) {
  const tone = trustScoreTone(score)
  const toImprove = signals.filter((s) => s.status !== 'complete')

  return (
    <div className="bg-surface rounded-2xl p-6 border border-border shadow-card space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black text-ink uppercase tracking-wider">TrustScore</h2>
          <p className="text-inkFaint text-xs mt-1">Built from verification and real activity, not just what you fill in</p>
        </div>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-black ${toneClass[tone]}`}>
          {score}<span className="text-xs font-bold opacity-70">/100</span>
        </div>
      </div>

      <div className="space-y-2">
        {signals.map((signal) => (
          <div key={signal.key} className="flex items-start justify-between gap-3 text-sm py-1.5 border-b border-border last:border-0">
            <div className="flex items-start gap-2 min-w-0">
              <span className="mt-0.5">{trustSignalIcon(signal.status)}</span>
              <div className="min-w-0">
                <p className="font-semibold text-ink">{signal.label}</p>
                <p className="text-inkFaint text-xs">{signal.detail}</p>
              </div>
            </div>
            <span className="text-inkFaint text-xs font-bold shrink-0 pt-0.5">{signal.points}/{signal.max_points}</span>
          </div>
        ))}
      </div>

      {toImprove.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-bold text-inkMid uppercase tracking-wider mb-2">Improve your TrustScore</p>
          <ul className="space-y-1.5">
            {toImprove.map((signal) => (
              IMPROVE_ACTIONS[signal.key] ? (
                <li key={signal.key} className="text-xs text-inkFaint flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-inkFaint shrink-0" />
                  {IMPROVE_ACTIONS[signal.key]}
                </li>
              ) : null
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

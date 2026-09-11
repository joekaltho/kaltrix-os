// Types + formatting helpers for Business Pulse. All numbers here come
// from public.get_business_pulse() (see supabase/migrations/20260910_business_pulse.sql) --
// nothing on this page is computed or estimated client-side.

export interface PulseHealthFactor {
  key: string
  label: string
  detail: string
  points: number
  max_points: number
}

export interface BusinessPulseData {
  period_days: number
  period_start: string
  period_end: string
  previous_period_start: string
  previous_period_end: string
  has_comparison_period: boolean
  has_any_data: boolean
  business_created_at: string
  revenue: { current: number; previous: number }
  expenses: { current: number; previous: number; tracked: boolean }
  profit: { available: boolean; current?: number; previous?: number }
  invoices: {
    total: number
    paid: number
    unpaid: number
    overdue: number
    outstanding_count: number
    outstanding_amount: number
    period_count: number
  }
  transactions: { period_count: number; period_amount: number }
  customers: { total: number; new_current: number; new_previous: number }
  bookings: {
    total: number
    period_count: number
    confirmed: number
    completed: number
    cancelled: number
    pending: number
  }
  listings: { total: number; active: number }
  growth: { status: 'growing' | 'declining' | 'stable' | 'not_enough_data'; basis: string }
  business_health: {
    available: boolean
    score: number | null
    factors: PulseHealthFactor[]
  }
  error?: string
}

export function formatNaira(amount: number): string {
  return `₦${Math.round(amount).toLocaleString()}`
}

export type ChangeDirection = 'up' | 'down' | 'flat' | 'new' | 'unknown'

export interface ChangeInfo {
  direction: ChangeDirection
  pct: number | null
}

/** Period-over-period change. Never invents a comparison -- if there's
 * no real baseline to compare against, direction is 'unknown' or 'new'
 * rather than a fabricated percentage. */
export function getChange(current: number, previous: number, hasComparison: boolean): ChangeInfo {
  if (!hasComparison) return { direction: 'unknown', pct: null }
  if (previous === 0 && current === 0) return { direction: 'flat', pct: null }
  if (previous === 0 && current > 0) return { direction: 'new', pct: null }
  const pct = ((current - previous) / previous) * 100
  if (pct > 1) return { direction: 'up', pct }
  if (pct < -1) return { direction: 'down', pct }
  return { direction: 'flat', pct }
}

export function changeLabel(change: ChangeInfo): string {
  switch (change.direction) {
    case 'up': return `+${change.pct!.toFixed(0)}%`
    case 'down': return `${change.pct!.toFixed(0)}%`
    case 'flat': return 'No change'
    case 'new': return 'New this period'
    case 'unknown': return 'Not enough history yet'
  }
}

export const growthCopy: Record<BusinessPulseData['growth']['status'], { label: string; color: string; bg: string }> = {
  growing: { label: 'Growing', color: 'text-brand', bg: 'bg-brandBg' },
  declining: { label: 'Declining', color: 'text-red-500', bg: 'bg-red-50' },
  stable: { label: 'Stable', color: 'text-inkMid', bg: 'bg-ivoryDim' },
  not_enough_data: { label: 'Not enough data yet', color: 'text-inkFaint', bg: 'bg-ivoryDim' },
}

export function healthTone(score: number): { color: string; bg: string; label: string } {
  if (score >= 75) return { color: 'text-brand', bg: 'bg-brandBg', label: 'Strong' }
  if (score >= 50) return { color: 'text-amber-600', bg: 'bg-amber-50', label: 'Fair' }
  return { color: 'text-red-500', bg: 'bg-red-50', label: 'Needs attention' }
}

export const PERIOD_OPTIONS = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
] as const

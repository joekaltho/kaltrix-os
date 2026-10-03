import type { ReactNode } from 'react'

export type Tone = 'success' | 'warn' | 'danger' | 'info' | 'neutral'

const tones: Record<Tone, string> = {
  success: 'bg-brandBg text-brandText border-brand/25',
  warn: 'bg-warnBg text-warn border-warnBorder',
  danger: 'bg-dangerBg text-danger border-dangerBorder',
  info: 'bg-infoBg text-info border-infoBorder',
  neutral: 'bg-ivoryDim text-inkMid border-border',
}

export function StatusBadge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tones[tone]}`}>
      {children}
    </span>
  )
}

export const invoiceTone = (status: string): Tone =>
  status === 'paid' ? 'success' : status === 'overdue' ? 'danger' : 'warn'

export const bookingTone = (status?: string): Tone =>
  status === 'confirmed' ? 'success' : status === 'cancelled' ? 'danger' : status === 'completed' ? 'info' : 'warn'

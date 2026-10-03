'use client'

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import type { ReactNode } from 'react'

type Kind = 'success' | 'error' | 'warn' | 'info'

const styles: Record<Kind, { box: string; icon: typeof Info }> = {
  success: { box: 'bg-brandBg border-brand/25 text-ink', icon: CheckCircle2 },
  error: { box: 'bg-dangerBg border-dangerBorder text-ink', icon: AlertCircle },
  warn: { box: 'bg-warnBg border-warnBorder text-ink', icon: AlertCircle },
  info: { box: 'bg-infoBg border-infoBorder text-ink', icon: Info },
}

const iconColor: Record<Kind, string> = {
  success: 'text-brandText',
  error: 'text-danger',
  warn: 'text-warn',
  info: 'text-info',
}

// Inline, dismissible message. Replaces the full-screen "Created!" pages that
// made people wait ~1.5s before they could do anything else.
export default function Notice({
  kind = 'info',
  children,
  action,
  onDismiss,
}: {
  kind?: Kind
  children: ReactNode
  action?: ReactNode
  onDismiss?: () => void
}) {
  const { box, icon: Icon } = styles[kind]
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${box}`}
    >
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${iconColor[kind]}`} aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
      {action && <div className="shrink-0">{action}</div>}
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-inkFaint hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

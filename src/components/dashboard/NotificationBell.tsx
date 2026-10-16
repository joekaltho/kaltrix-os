'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  BadgeCheck,
  Bell,
  CalendarClock,
  CheckCheck,
  Flag,
  MessageSquare,
  Package,
  Star,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import type { NotificationsState } from '@/lib/use-notifications'
import { formatBadgeCount, formatRelativeTime, safeHref, type AppNotification } from '@/lib/notifications'

const ICONS: Record<string, LucideIcon> = {
  new_message: MessageSquare,
  new_review: Star,
  review_flagged: Flag,
  review_removed: Flag,
  verification_granted: BadgeCheck,
  verification_removed: BadgeCheck,
  plan_activated: Zap,
  plan_expired: CalendarClock,
  trial_ending: CalendarClock,
  trial_ended: CalendarClock,
  low_stock: Package,
  out_of_stock: Package,
}

// Types that need the owner's attention get the warning tint; the rest stay quiet.
const ATTENTION = new Set(['review_flagged', 'review_removed', 'verification_removed', 'plan_expired', 'trial_ending', 'trial_ended', 'low_stock', 'out_of_stock'])

function Row({ item, onOpen }: { item: AppNotification; onOpen: (item: AppNotification) => void }) {
  const Icon = ICONS[item.type] ?? Bell
  const href = safeHref(item.href)
  const unread = !item.read_at
  const content = (
    <>
      <span
        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          ATTENTION.has(item.type) ? 'bg-warnBg text-warn' : 'bg-brandBg text-brandText'
        }`}
      >
        <Icon className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${unread ? 'font-semibold text-ink' : 'font-medium text-inkMid'}`}>{item.title}</span>
        {item.body && <span className="mt-0.5 block break-words text-xs text-inkFaint">{item.body}</span>}
        <span className="mt-1 block text-xs text-inkFaint">{formatRelativeTime(item.created_at)}</span>
      </span>
      {unread && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brandDim" aria-label="Unread" />}
    </>
  )
  const cls = 'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-ivoryDim focus-visible:bg-ivoryDim focus-visible:outline-none'
  return href ? (
    <Link href={href} onClick={() => onOpen(item)} className={cls}>{content}</Link>
  ) : (
    <button type="button" onClick={() => onOpen(item)} className={cls}>{content}</button>
  )
}

// A bell with an unread count and a flyout list. It only exists because real
// notifications back it (see migration 20261015120200): messages, reviews,
// verification, billing, trials and low stock all create rows there.
export default function NotificationBell({ notifications }: { notifications: NotificationsState }) {
  const { items, unread, status, refresh, markRead, markAllRead } = notifications
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const openItem = (item: AppNotification) => {
    void markRead(item.id)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); if (!open) void refresh() }}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-inkMid transition-colors hover:bg-ivoryDim hover:text-ink"
      >
        <Bell className="h-[18px] w-[18px]" aria-hidden />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-warn px-1 text-center text-[10px] font-semibold leading-4 text-white dark:text-black">
            {formatBadgeCount(unread)}
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-label="Notifications"
            className="fixed inset-x-3 top-14 z-50 flex max-h-[70vh] flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-modal focus:outline-none md:inset-x-auto md:left-[15.5rem] md:top-3 md:w-96"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-ink">Notifications</h2>
              <Button size="sm" variant="ghost" onClick={() => void markAllRead()} disabled={unread === 0} className="h-8 px-2">
                <CheckCheck className="h-4 w-4" aria-hidden />
                Mark all read
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {status === 'error' && items.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <p className="text-sm text-inkMid">Couldn&apos;t load notifications.</p>
                  <div className="mt-3"><Button size="sm" variant="secondary" onClick={() => void refresh()}>Try again</Button></div>
                </div>
              ) : status !== 'ready' && items.length === 0 ? (
                <div className="flex justify-center py-10" role="status" aria-label="Loading notifications">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                </div>
              ) : items.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <p className="text-sm font-semibold text-ink">Nothing yet</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-inkFaint">
                    You&apos;ll see new messages and reviews, stock alerts, verification updates and plan changes here.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((item) => (
                    <li key={item.id}><Row item={item} onOpen={openItem} /></li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

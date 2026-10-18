// Client-side model for in-app notifications (table: public.notifications,
// created entirely by database triggers; see migration 20261015120200).
// Pure helpers only, so they are unit-testable without a browser.

export type NotificationType =
  | 'new_message'
  | 'new_review'
  | 'review_flagged'
  | 'review_removed'
  | 'verification_granted'
  | 'verification_removed'
  | 'plan_activated'
  | 'plan_expired'
  | 'trial_ending'
  | 'trial_ended'
  | 'low_stock'
  | 'out_of_stock'

export interface AppNotification {
  id: string
  type: string
  title: string
  body: string | null
  href: string | null
  created_at: string
  read_at: string | null
}

export const NOTIFICATION_COLUMNS = 'id, type, title, body, href, created_at, read_at'
export const NOTIFICATION_PAGE_SIZE = 20

// Same rule as the CHECK constraint on notifications.href: in-app paths only.
// Re-checked here so that even a row that somehow bypassed the database rule
// can never become an external or javascript: link.
const SAFE_HREF = /^\/(dashboard(\/[a-z-]+)?(\?tab=[a-z]+)?|business\/[A-Za-z0-9_-]+)$/

export function safeHref(href: string | null | undefined): string | null {
  return typeof href === 'string' && SAFE_HREF.test(href) ? href : null
}

export function countUnread(list: readonly AppNotification[]): number {
  return list.reduce((n, item) => (item.read_at ? n : n + 1), 0)
}

// "just now", "5 min ago", "3 h ago", "2 d ago", then a short date.
export function formatRelativeTime(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const seconds = Math.max(0, Math.floor((now - then) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Date(then).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

// "9+" keeps the badge a fixed, small size.
export function formatBadgeCount(count: number): string {
  return count > 9 ? '9+' : String(count)
}

// Merge a freshly fetched page into what's already on screen without losing a
// read-state change the user just made locally (optimistic updates that the
// server hasn't confirmed yet).
export function applyLocalReads(
  fetched: readonly AppNotification[],
  locallyRead: ReadonlySet<string>
): AppNotification[] {
  const stamp = new Date().toISOString()
  return fetched.map((n) => (!n.read_at && locallyRead.has(n.id) ? { ...n, read_at: stamp } : n))
}

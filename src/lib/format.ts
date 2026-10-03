// Small presentation helpers shared by the dashboard, forms and invoice page.

export const formatNaira = (amount: number) => `₦${amount.toLocaleString('en-NG')}`

// Postgres `date` columns come back as "YYYY-MM-DD". new Date("YYYY-MM-DD")
// parses that as UTC midnight, which renders as the previous day for anyone
// west of UTC. Parse date-only strings as local dates instead.
export function parseDate(value: string | Date): Date {
  if (value instanceof Date) return value
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
}

export function formatDate(value: string | Date): string {
  return parseDate(value).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDateTime(value: string | Date): string {
  const d = parseDate(value)
  const date = d.toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })
  const time = d.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' })
  return `${date}, ${time}`
}

export function isSameLocalDay(a: string | Date, b: Date = new Date()): boolean {
  return parseDate(a).toDateString() === b.toDateString()
}

// Whole days between today and a due date (negative = past due).
export function daysUntil(due: string | Date, now: Date = new Date()): number {
  const d = parseDate(due)
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((end - start) / 86_400_000)
}

// Origin for building shareable links in client components. Guarded so a
// component that ever gets server-rendered doesn't throw on `window`.
export const siteOrigin = () => (typeof window !== 'undefined' ? window.location.origin : '')

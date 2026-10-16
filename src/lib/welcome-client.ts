// Browser-side trigger for the welcome email (see /api/onboarding/welcome).
//
// Fire-and-forget by design: the request carries nothing (the server works out
// who you are and which business is yours from the session) and its outcome is
// deliberately invisible, so an email problem can never get in the way of
// registration or the dashboard. The server makes this safe to call repeatedly;
// the sessionStorage guard just avoids pointless requests within one tab.
const SESSION_KEY = 'kx:welcome-requested'

// A failed send is retried while the business is this young; after that it's
// left alone rather than emailing someone a "welcome" weeks later.
export const WELCOME_RETRY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

export function isWithinWelcomeWindow(createdAt: string | undefined | null, now: number = Date.now()): boolean {
  if (!createdAt) return false
  const created = new Date(createdAt).getTime()
  return Number.isFinite(created) && now - created >= 0 && now - created < WELCOME_RETRY_WINDOW_MS
}

export function requestWelcomeEmail(): void {
  try {
    if (sessionStorage.getItem(SESSION_KEY)) return
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // Storage blocked (private mode etc.): still try once.
  }
  void fetch('/api/onboarding/welcome', { method: 'POST', keepalive: true }).catch(() => {})
}

// In-memory, per-tab cache of the signed-in owner's own dashboard data, so coming back
// to the dashboard (or opening a guarded form page) from another page can show content
// immediately while the real data is re-fetched in the background.
//
// Deliberately safe for private data:
//   * lives only in this JS module's memory: never written to localStorage, cookies,
//     HTTP caches or the service worker, and gone on a full page reload;
//   * always keyed by user id, and callers pass the id of the session they are
//     actually running under, so one user's entry can never be returned for another;
//   * holds ONE entry at a time (a different user replaces it), expires after
//     MAX_AGE_MS, and is cleared on sign-out;
//   * it is only ever a first paint: every reader re-validates against Supabase
//     (RLS-enforced) straight afterwards and replaces what it showed.

export const SESSION_CACHE_MAX_AGE_MS = 5 * 60_000

type Entry<T> = { userId: string; at: number; value: T }

export interface IdentitySnapshot {
  userId: string
  businessId: string | null
  plan: 'free' | 'growth' | 'pro'
}

let identity: Entry<IdentitySnapshot> | null = null
let dashboard: Entry<unknown> | null = null

function fresh<T>(entry: Entry<T> | null, userId: string | null | undefined, now: number): T | null {
  if (!entry || !userId || entry.userId !== userId) return null
  if (now - entry.at > SESSION_CACHE_MAX_AGE_MS || now < entry.at) return null
  return entry.value
}

export function readIdentityCache(userId: string | null | undefined, now: number = Date.now()): IdentitySnapshot | null {
  return fresh(identity, userId, now)
}
export function writeIdentityCache(snapshot: IdentitySnapshot, now: number = Date.now()): void {
  identity = { userId: snapshot.userId, at: now, value: snapshot }
}

export function readDashboardCache<T>(userId: string | null | undefined, now: number = Date.now()): T | null {
  return fresh(dashboard, userId, now) as T | null
}
export function writeDashboardCache<T>(userId: string, value: T, now: number = Date.now()): void {
  dashboard = { userId, at: now, value }
}

// The dashboard snapshot is out of date (the owner just changed something in it).
export function clearDashboardCache(): void {
  dashboard = null
}

// Sign-out, and any moment the owner's data is known to have changed under us.
export function clearSessionCache(): void {
  identity = null
  dashboard = null
}

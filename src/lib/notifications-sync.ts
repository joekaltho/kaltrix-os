// How the bell stays current. Pure helpers so the rules are unit-testable.
//
// Realtime (migration 20261017100100) pushes new notifications to the open
// dashboard. It is an optimisation, never a dependency: if the subscription isn't
// established (migration not applied yet, websocket blocked, network drop) the bell
// falls back to polling, and when it IS live polling only runs as a slow safety net
// for events missed during a reconnect.

export const POLL_FAST_MS = 60_000 // no live connection: poll every minute
export const POLL_SLOW_MS = 5 * 60_000 // live connection: safety net only
export const REALTIME_DEBOUNCE_MS = 400 // coalesce bursts (e.g. several events in one transaction)

export type RealtimeState = 'connecting' | 'connected' | 'down'

// Statuses supabase-js reports from channel.subscribe().
export function realtimeStateFor(status: string): RealtimeState {
  switch (status) {
    case 'SUBSCRIBED':
      return 'connected'
    case 'CHANNEL_ERROR':
    case 'TIMED_OUT':
    case 'CLOSED':
      return 'down'
    default:
      return 'connecting'
  }
}

export function pollIntervalMs(state: RealtimeState): number {
  return state === 'connected' ? POLL_SLOW_MS : POLL_FAST_MS
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The Realtime filter is a string built from the business id; only ever build it
// from a real uuid so nothing else can be smuggled into the filter expression.
export function notificationFilter(businessId: string | null | undefined): string | null {
  return typeof businessId === 'string' && UUID.test(businessId) ? `business_id=eq.${businessId}` : null
}

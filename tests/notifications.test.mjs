// Notification + announcement helpers. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyLocalReads, countUnread, formatBadgeCount, formatRelativeTime, safeHref } from '../src/lib/notifications.ts'
import {
  INVENTORY_ANNOUNCEMENT, announcementKey, isAlreadyUsingInventory, isAnnouncementLive, readFlag, writeFlag,
} from '../src/lib/feature-announcements.ts'
import { isWithinWelcomeWindow } from '../src/lib/welcome-client.ts'
import { POLL_FAST_MS, POLL_SLOW_MS, REALTIME_DEBOUNCE_MS, notificationFilter, pollIntervalMs, realtimeStateFor } from '../src/lib/notifications-sync.ts'

test('safeHref allows only in-app paths', () => {
  for (const ok of ['/dashboard', '/dashboard?tab=inbox', '/dashboard?tab=inventory', '/dashboard/upgrade', '/dashboard/feedback', '/business/alpha-foods-x1']) {
    assert.equal(safeHref(ok), ok)
  }
  for (const bad of [
    'https://evil.example', '//evil.example', 'javascript:alert(1)', 'data:text/html,x', '/dashboard/../admin',
    '/admin', '/dashboard?tab=inbox&x=1', '/dashboard?tab=In box', '/business/a/b', '/business/', '', null, undefined, 42,
  ]) {
    assert.equal(safeHref(bad), null, `should reject ${JSON.stringify(bad)}`)
  }
})

test('countUnread / formatBadgeCount', () => {
  const n = (id, read) => ({ id, type: 't', title: 't', body: null, href: null, created_at: '2026-10-15T00:00:00Z', read_at: read ? '2026-10-15T01:00:00Z' : null })
  assert.equal(countUnread([n(1, false), n(2, true), n(3, false)]), 2)
  assert.equal(countUnread([]), 0)
  assert.equal(formatBadgeCount(0), '0'); assert.equal(formatBadgeCount(9), '9'); assert.equal(formatBadgeCount(10), '9+'); assert.equal(formatBadgeCount(250), '9+')
})

test('formatRelativeTime', () => {
  const now = Date.parse('2026-10-16T12:00:00Z')
  const ago = (ms) => new Date(now - ms).toISOString()
  assert.equal(formatRelativeTime(ago(5_000), now), 'just now')
  assert.equal(formatRelativeTime(ago(5 * 60_000), now), '5 min ago')
  assert.equal(formatRelativeTime(ago(3 * 3_600_000), now), '3 h ago')
  assert.equal(formatRelativeTime(ago(2 * 86_400_000), now), '2 d ago')
  assert.match(formatRelativeTime(ago(30 * 86_400_000), now), /\w/)
  assert.equal(formatRelativeTime('garbage', now), '')
  assert.equal(formatRelativeTime(new Date(now + 60_000).toISOString(), now), 'just now', 'clock skew never yields negatives')
})

test('applyLocalReads keeps optimistic reads when a stale fetch says unread', () => {
  const rows = [
    { id: 'a', type: 't', title: 'A', body: null, href: null, created_at: 'x', read_at: null },
    { id: 'b', type: 't', title: 'B', body: null, href: null, created_at: 'x', read_at: null },
  ]
  const out = applyLocalReads(rows, new Set(['a']))
  assert.ok(out[0].read_at); assert.equal(out[1].read_at, null)
})

test('announcements: live until expiry, keyed per business, storage failures are harmless', () => {
  assert.equal(isAnnouncementLive(INVENTORY_ANNOUNCEMENT, Date.parse('2026-10-16T00:00:00Z')), true)
  assert.equal(isAnnouncementLive(INVENTORY_ANNOUNCEMENT, Date.parse('2026-12-15T00:00:00Z')), false)
  assert.equal(isAnnouncementLive({ id: 'x', expiresAt: 'not a date' }), false)
  assert.notEqual(announcementKey('inventory', 'seen', 'biz-1'), announcementKey('inventory', 'seen', 'biz-2'))
  assert.notEqual(announcementKey('inventory', 'seen', 'biz-1'), announcementKey('inventory', 'intro-dismissed', 'biz-1'))

  const mem = new Map()
  const store = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) }
  assert.equal(readFlag(store, 'k'), false)
  writeFlag(store, 'k')
  assert.equal(readFlag(store, 'k'), true)
  const throwing = { getItem() { throw new Error('blocked') }, setItem() { throw new Error('blocked') } }
  assert.equal(readFlag(throwing, 'k'), false)
  assert.doesNotThrow(() => writeFlag(throwing, 'k'))
  assert.equal(readFlag(null, 'k'), false)
  assert.doesNotThrow(() => writeFlag(undefined, 'k'))
})

test('welcome retry window: first 7 days only', () => {
  const now = Date.parse('2026-10-16T00:00:00Z')
  assert.equal(isWithinWelcomeWindow('2026-10-15T00:00:00Z', now), true)
  assert.equal(isWithinWelcomeWindow('2026-10-09T00:00:01Z', now), true)
  assert.equal(isWithinWelcomeWindow('2026-10-09T00:00:00Z', now), false)
  assert.equal(isWithinWelcomeWindow('2026-01-01T00:00:00Z', now), false)
  assert.equal(isWithinWelcomeWindow('2026-10-17T00:00:00Z', now), false, 'future timestamps rejected')
  assert.equal(isWithinWelcomeWindow(undefined, now), false)
  assert.equal(isWithinWelcomeWindow('nope', now), false)
})

test('inventory intro/badge: only for people who have not started tracking stock', () => {
  assert.equal(isAlreadyUsingInventory(0), false)
  assert.equal(isAlreadyUsingInventory(1), true)
  assert.equal(isAlreadyUsingInventory(250), true)
  assert.equal(isAlreadyUsingInventory(null), false, 'unknown yet: do not decide')
  assert.equal(isAlreadyUsingInventory(undefined), false)
  assert.equal(isAlreadyUsingInventory(-1), false)
})

test('realtime status mapping: only SUBSCRIBED counts as live; failures fall back to polling', () => {
  assert.equal(realtimeStateFor('SUBSCRIBED'), 'connected')
  for (const bad of ['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']) assert.equal(realtimeStateFor(bad), 'down', bad)
  for (const other of ['JOINING', 'JOINED', '', 'something-new']) assert.equal(realtimeStateFor(other), 'connecting', other)
})

test('polling: every minute without a live connection, a slow safety net with one', () => {
  assert.equal(pollIntervalMs('connected'), POLL_SLOW_MS)
  assert.equal(pollIntervalMs('connecting'), POLL_FAST_MS)
  assert.equal(pollIntervalMs('down'), POLL_FAST_MS)
  assert.ok(POLL_SLOW_MS > POLL_FAST_MS && POLL_FAST_MS === 60_000)
  assert.ok(REALTIME_DEBOUNCE_MS > 0 && REALTIME_DEBOUNCE_MS < 2000)
})

test('SECURITY: the realtime filter is only ever built from a real uuid', () => {
  const id = '3f2c9c1e-aaaa-4bbb-8ccc-1234567890ab'
  assert.equal(notificationFilter(id), `business_id=eq.${id}`)
  for (const bad of [null, undefined, '', 'abc', `${id},role=eq.admin`, `${id}) or (1=1`, `${id}\n`, 42]) {
    assert.equal(notificationFilter(bad), null, JSON.stringify(bad))
  }
})

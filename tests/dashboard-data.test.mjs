// Dashboard loading: how many sequential network round trips it takes, that plan
// gating and ordering are unchanged, the fallback path, and the safety rules of the
// in-memory session cache. See src/lib/dashboard-data.ts and src/lib/session-cache.ts.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { loadDashboardData, loadSequential, DASHBOARD_BUSINESS_SELECT } from '../src/lib/dashboard-data.ts'
import { hasFeature, subscriptionStateFromRow } from '../src/lib/plan-state.ts'
import {
  SESSION_CACHE_MAX_AGE_MS,
  clearDashboardCache,
  clearSessionCache,
  readDashboardCache,
  readIdentityCache,
  writeDashboardCache,
  writeIdentityCache,
} from '../src/lib/session-cache.ts'

const helpers = { subscriptionStateFromRow, hasFeature }
const FUTURE = new Date(Date.now() + 10 * 86_400_000).toISOString()
const sub = (plan, status = 'active', expires_at = FUTURE) => ({ plan, status, expires_at })

const BUSINESS = { id: 'biz-1', user_id: 'u1', business_name: 'Acme', slug: 'acme', trust_score: 50, is_verified: false, created_at: '2026-01-01' }
const rows = (n, prefix) => Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}`, business_id: 'biz-1' }))

// A fake Supabase client. It models "round-trip depth": the number of requests that had
// to wait for an earlier one to finish, i.e. the sequential network hops the browser pays.
function fakeClient(opts = {}) {
  const { profile = { name: 'Joe', role: 'user' }, business = BUSINESS, subscription = sub('pro'), bank = { bank_name: 'GTB' },
    messages = rows(2, 'm'), bookings = rows(1, 'b'), customers = rows(3, 'c'), invoices = rows(4, 'i'),
    failBatched = false, embedAsArray = false, throwOn = null } = opts
  const log = { requests: [], orders: [] }
  let completedMaxDepth = 0
  let maxDepth = 0

  const exec = async (q) => {
    const depth = completedMaxDepth + 1
    maxDepth = Math.max(maxDepth, depth)
    log.requests.push({ table: q.table, select: q.cols })
    await new Promise((r) => setTimeout(r, 3))
    completedMaxDepth = Math.max(completedMaxDepth, depth)
    if (throwOn === q.table) throw new Error('network down')
    switch (q.table) {
      case 'profiles': return { data: profile, error: null }
      case 'businesses':
        if (String(q.cols).includes('subscriptions(')) {
          if (failBatched) return { data: null, error: { message: 'relationship not found' } }
          if (!business) return { data: null, error: null }
          const wrap = (v) => (embedAsArray ? (v ? [v] : []) : v)
          return { data: { ...business, subscriptions: wrap(subscription), business_payment_details: wrap(bank), messages, bookings, customers, invoices }, error: null }
        }
        return { data: business, error: null }
      case 'subscriptions': return { data: subscription, error: null }
      case 'business_payment_details': return { data: bank, error: null }
      case 'messages': return { data: messages, error: null }
      case 'bookings': return { data: bookings, error: null }
      case 'customers': return { data: customers, error: null }
      case 'invoices': return { data: invoices, error: null }
      default: throw new Error(`unexpected table ${q.table}`)
    }
  }
  const from = (table) => {
    const q = { table, cols: '' }
    const b = {
      select(cols) { q.cols = cols; return b },
      eq() { return b },
      order(col, o) { log.orders.push({ table, col, ...o }); return b },
      single: () => exec(q),
      maybeSingle: () => exec(q),
      then: (res, rej) => exec(q).then(res, rej),
    }
    return b
  }
  return { client: { from }, log, depth: () => maxDepth }
}

const load = (opts, onFallback = () => {}) => {
  const f = fakeClient(opts)
  return loadDashboardData(f.client, 'u1', helpers, onFallback).then((result) => ({ result, ...f }))
}

// --- round trips -----------------------------------------------------------------

test('PERF - the dashboard now loads in ONE round trip (it used to take three in sequence)', async () => {
  const batched = await load({})
  assert.equal(batched.result.status, 'ready')
  assert.equal(batched.result.usedFallback, false)
  assert.equal(batched.depth(), 1, 'profile and business-with-related-rows are fetched together, nothing waits on anything')
  assert.equal(batched.log.requests.length, 2)

  // the previous step-by-step path (the same code that shipped before), for comparison
  const before = fakeClient({})
  await loadSequential(before.client, 'u1', helpers)
  assert.equal(before.depth(), 3, 'before: profile+business, then subscription+messages+bank, then bookings+customers+invoices')

  // worst case: the batched query errors, so we pay one failed attempt and then the old chain
  const fallback = await load({ failBatched: true })
  assert.equal(fallback.result.usedFallback, true)
  assert.equal(fallback.depth(), 4)
})

test('the batched query asks for the same tables, newest first, through the existing foreign keys', async () => {
  const { log } = await load({})
  for (const t of ['subscriptions', 'business_payment_details', 'messages', 'bookings', 'customers', 'invoices']) {
    assert.ok(DASHBOARD_BUSINESS_SELECT.includes(`${t}(`), `${t} is embedded`)
  }
  assert.deepEqual(
    log.orders.map((o) => [o.table, o.col, o.referencedTable, o.ascending]),
    ['messages', 'bookings', 'customers', 'invoices'].map((t) => ['businesses', 'created_at', t, false])
  )
})

// --- data correctness ------------------------------------------------------------

test('returns the business without the embedded relations mixed in, plus the related data', async () => {
  const { result } = await load({})
  const d = result.data
  assert.deepEqual(d.business, BUSINESS)
  assert.equal(d.userName, 'Joe')
  assert.equal(d.plan, 'pro')
  assert.equal(d.subscription.plan, 'pro')
  assert.deepEqual(d.bank, { bank_name: 'GTB' })
  assert.equal(d.messages.length, 2)
})

test('GATING - plan decides which lists are returned, exactly as before', async () => {
  const free = (await load({ subscription: null })).result.data
  assert.equal(free.plan, 'free')
  assert.deepEqual([free.bookings.length, free.customers.length, free.invoices.length], [0, 0, 0], 'free sees none of the gated lists')
  assert.equal(free.messages.length, 2, 'messages are never plan-gated')

  const growth = (await load({ subscription: sub('growth') })).result.data
  assert.deepEqual([growth.bookings.length, growth.customers.length, growth.invoices.length], [1, 3, 4])

  const pro = (await load({ subscription: sub('pro') })).result.data
  assert.deepEqual([pro.bookings.length, pro.customers.length, pro.invoices.length], [1, 3, 4])

  const expiredTrial = (await load({ subscription: sub('pro', 'trialing', '2020-01-01T00:00:00Z') })).result.data
  assert.equal(expiredTrial.plan, 'free', 'a lapsed trial is treated as free')
  assert.equal(expiredTrial.invoices.length, 0)
})

test('the same gating applies on the fallback path', async () => {
  const { result } = await load({ failBatched: true, subscription: null })
  assert.equal(result.data.plan, 'free')
  assert.equal(result.data.invoices.length, 0)
  const grown = await load({ failBatched: true, subscription: sub('growth') })
  assert.equal(grown.result.data.invoices.length, 4)
})

test('one-to-one relations come back as an object or a one-item array; both are handled', async () => {
  const a = (await load({ embedAsArray: true })).result.data
  assert.equal(a.plan, 'pro')
  assert.deepEqual(a.bank, { bank_name: 'GTB' })
  const none = (await load({ embedAsArray: true, subscription: null, bank: null })).result.data
  assert.equal(none.plan, 'free')
  assert.equal(none.bank, null)
})

test('admins are sent to /admin and no dashboard data is returned', async () => {
  const { result } = await load({ profile: { name: 'Root', role: 'admin' } })
  assert.deepEqual(result, { status: 'admin' })
})

test('a user without a business gets an empty free dashboard state', async () => {
  const { result } = await load({ business: null })
  assert.equal(result.status, 'ready')
  assert.equal(result.data.business, null)
  assert.equal(result.data.plan, 'free')
  assert.equal(result.data.subscription, null)
  assert.equal(result.data.messages.length, 0)
})

// --- failure handling ------------------------------------------------------------

test('a failed batched query falls back to the step-by-step load and says why', async () => {
  const reasons = []
  const { result } = await load({ failBatched: true }, (r) => reasons.push(r))
  assert.equal(result.status, 'ready')
  assert.equal(result.data.business.id, 'biz-1')
  assert.equal(result.data.invoices.length, 4)
  assert.deepEqual(reasons, ['relationship not found'])
})

test('a network failure is NOT swallowed -- the page can show its retry screen', async () => {
  const f = fakeClient({ throwOn: 'profiles' })
  await assert.rejects(loadDashboardData(f.client, 'u1', helpers, () => {}), /network down/)
})

// --- session cache ---------------------------------------------------------------

const snap = { userId: 'u1', businessId: 'biz-1', plan: 'pro' }

test('CACHE SAFETY - an entry is only ever returned for the user it was stored for', () => {
  clearSessionCache()
  writeDashboardCache('u1', { secret: 'u1 data' })
  writeIdentityCache(snap)
  assert.deepEqual(readDashboardCache('u1'), { secret: 'u1 data' })
  assert.equal(readDashboardCache('u2'), null)
  assert.equal(readDashboardCache(null), null)
  assert.equal(readDashboardCache(undefined), null)
  assert.equal(readIdentityCache('u2'), null)
  assert.equal(readIdentityCache(null), null)
})

test('CACHE SAFETY - a different user replaces the entry; nothing of the first user survives', () => {
  clearSessionCache()
  writeDashboardCache('u1', { who: 'u1' })
  writeDashboardCache('u2', { who: 'u2' })
  assert.equal(readDashboardCache('u1'), null)
  assert.deepEqual(readDashboardCache('u2'), { who: 'u2' })
})

test('CACHE - entries expire, and clearing removes them', () => {
  clearSessionCache()
  const t0 = 1_000_000
  writeDashboardCache('u1', { x: 1 }, t0)
  writeIdentityCache(snap, t0)
  assert.deepEqual(readDashboardCache('u1', t0 + SESSION_CACHE_MAX_AGE_MS), { x: 1 })
  assert.equal(readDashboardCache('u1', t0 + SESSION_CACHE_MAX_AGE_MS + 1), null)
  assert.equal(readIdentityCache('u1', t0 + SESSION_CACHE_MAX_AGE_MS + 1), null)
  assert.equal(readDashboardCache('u1', t0 - 1), null, 'a clock that went backwards is not trusted')

  writeDashboardCache('u1', { x: 2 })
  writeIdentityCache(snap)
  clearDashboardCache()
  assert.equal(readDashboardCache('u1'), null)
  assert.deepEqual(readIdentityCache('u1'), snap, 'clearing the dashboard snapshot keeps the plan identity')
  clearSessionCache()
  assert.equal(readIdentityCache('u1'), null, 'sign-out clears everything')
})

// --- plan logic moved out of check-plan.ts is unchanged ---------------------------

test('subscriptionStateFromRow matches the rules the app always used', () => {
  assert.equal(subscriptionStateFromRow(null).plan, 'free')
  assert.equal(subscriptionStateFromRow(null).hasSubscription, false)
  const trial = subscriptionStateFromRow(sub('pro', 'trialing', FUTURE))
  assert.deepEqual([trial.plan, trial.isTrialing, trial.trialExpired, trial.hasSubscription], ['pro', true, false, true])
  assert.ok(trial.trialDaysLeft >= 9 && trial.trialDaysLeft <= 11)
  const lapsed = subscriptionStateFromRow(sub('pro', 'trialing', '2020-01-01T00:00:00Z'))
  assert.deepEqual([lapsed.plan, lapsed.isTrialing, lapsed.trialExpired], ['free', false, true])
  assert.equal(subscriptionStateFromRow(sub('growth', 'active', '2020-01-01T00:00:00Z')).plan, 'free')
  assert.equal(subscriptionStateFromRow(sub('growth', 'canceled', FUTURE)).plan, 'free')
  assert.equal(hasFeature('growth', 'analytics'), false)
  assert.equal(hasFeature('pro', 'analytics'), true)
})

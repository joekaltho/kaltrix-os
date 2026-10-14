// End-to-end check of the REAL client path: supabase-js -> PostgREST -> Postgres
// (RLS, grants, the SECURITY DEFINER functions, JWT subject, error shapes).
//
// Scratch databases only. Needs: Postgres with harness.sql + the inventory
// migration applied, and PostgREST running against it (see
// supabase/tests/README.md). Env: PGHOST PGPORT PGUSER PGDATABASE (psql),
// POSTGREST_URL (default http://127.0.0.1:3011), JWT_SECRET.
import { createHmac } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import { createClient } from '@supabase/supabase-js'
import { describeInventoryError } from '../../src/lib/inventory.ts'

const URL_ = process.env.POSTGREST_URL ?? 'http://127.0.0.1:3011'
const SECRET = process.env.JWT_SECRET
if (!SECRET) throw new Error('Set JWT_SECRET to the jwt-secret your scratch PostgREST was started with')
const A = 'a0000000-0000-0000-0000-00000000000a'
const B = 'b0000000-0000-0000-0000-00000000000b'
const BIZ_A = 'b1000000-0000-0000-0000-00000000000a'
const BIZ_B = 'b2000000-0000-0000-0000-00000000000b'
const LA1 = 'e1000000-0000-0000-0000-000000000001'
const LA2 = 'e1000000-0000-0000-0000-000000000002'
const LB1 = 'e2000000-0000-0000-0000-000000000001'

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (claims) => {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ exp: Math.floor(Date.now() / 1000) + 3600, ...claims })
  return `${head}.${body}.${createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')}`
}
const anonJwt = jwt({ role: 'anon' })
// supabase-js appends /rest/v1; PostgREST serves from /. Strip it.
const rewrite = (u, init) => fetch(String(u).replace('/rest/v1', ''), init)
const clientFor = (sub) =>
  createClient(URL_, anonJwt, {
    global: { fetch: rewrite },
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: async () => (sub ? jwt({ role: 'authenticated', sub }) : anonJwt),
  })

execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-c', `
  truncate public.businesses cascade;
  insert into public.businesses (id, user_id) values ('${BIZ_A}', '${A}'), ('${BIZ_B}', '${B}');
  insert into public.listings (id, business_id, name) values
    ('${LA1}', '${BIZ_A}', 'Ankara Tote'), ('${LA2}', '${BIZ_A}', 'Shea Butter'), ('${LB1}', '${BIZ_B}', 'B Product');
`], { stdio: ['ignore', 'ignore', 'inherit'] })

let passed = 0
const ok = (cond, name) => { assert.ok(cond, `FAIL: ${name}`); passed++; console.log(`PASS: ${name}`) }

const a = clientFor(A)
const b = clientFor(B)
const anon = clientFor(null)

// enable + shapes
let r = await a.rpc('inventory_enable_tracking', { p_listing_id: LA1, p_opening_quantity: 10, p_low_stock_threshold: 3, p_unit: 'pcs', p_idempotency_key: 'e2e-open-0001' })
ok(!r.error && r.data.quantity === 10 && r.data.stock_status === 'in_stock' && r.data.duplicate === false, 'rpc returns a plain object with quantity/stock_status/duplicate')
r = await a.rpc('inventory_enable_tracking', { p_listing_id: LA2, p_opening_quantity: 0, p_low_stock_threshold: null, p_unit: null, p_idempotency_key: 'e2e-open-0002' })
ok(!r.error && r.data.quantity === 0 && r.data.movement_id === null, 'null parameters pass through (no threshold, no unit)')

// success paths
r = await a.rpc('inventory_receive_stock', { p_listing_id: LA1, p_quantity: 5, p_reason: 'supplier', p_note: null, p_reference: 'INV-1', p_idempotency_key: 'e2e-recv-0001' })
ok(!r.error && r.data.quantity === 15, 'receive via the client')
const dup = await a.rpc('inventory_receive_stock', { p_listing_id: LA1, p_quantity: 5, p_reason: 'supplier', p_note: null, p_reference: 'INV-1', p_idempotency_key: 'e2e-recv-0001' })
ok(!dup.error && dup.data.duplicate === true && dup.data.quantity === 15 && dup.data.movement_id === r.data.movement_id, 'retrying the same submit returns the original, applied once')

// error contract the UI depends on: message = code, details = number
r = await a.rpc('inventory_issue_stock', { p_listing_id: LA1, p_quantity: 99, p_reason: 'sale', p_note: null, p_idempotency_key: 'e2e-issue-big1' })
ok(r.error?.message === 'insufficient_stock' && r.error?.details === '15', `insufficient_stock arrives as message="${r.error?.message}" details="${r.error?.details}"`)
ok(/only 15 on hand/.test(describeInventoryError(r.error)), 'UI wording for insufficient_stock uses the server-provided balance')

r = await a.rpc('inventory_adjust_stock', { p_listing_id: LA1, p_new_quantity: 5, p_reason: 'stock_count', p_note: null, p_expected_quantity: 99, p_idempotency_key: 'e2e-adj-stale1' })
ok(r.error?.message === 'stale_balance' && r.error?.details === '15', 'stale_balance arrives with the current balance in details')
r = await a.rpc('inventory_adjust_stock', { p_listing_id: LA1, p_new_quantity: 5, p_reason: 'other', p_note: null, p_expected_quantity: 15, p_idempotency_key: 'e2e-adj-note1' })
ok(r.error?.message === 'invalid_text' && r.error?.details === 'note_required' && /note/i.test(describeInventoryError(r.error)), 'note_required arrives and is worded')
r = await a.rpc('inventory_receive_stock', { p_listing_id: LA1, p_quantity: 3000000000, p_reason: 'supplier' })
ok(!!r.error && describeInventoryError(r.error) === 'Something went wrong and nothing was changed. Please try again.', 'out-of-range JSON number is rejected and no raw database text reaches the UI')
r = await a.rpc('inventory_receive_stock', { p_listing_id: LA1, p_quantity: 1.5, p_reason: 'supplier' })
ok(!!r.error, 'fractional quantity is rejected by the integer parameter type')
r = await a.rpc('inventory_receive_stock', { p_listing_id: LA1, p_quantity: '7', p_reason: 'supplier', p_idempotency_key: 'e2e-recv-str1' })
ok(!r.error && r.data.quantity === 22, 'numeric string is coerced by PostgREST (UI never sends this; server still validates the integer)')
await a.rpc('inventory_issue_stock', { p_listing_id: LA1, p_quantity: 7, p_reason: 'sale', p_note: null, p_idempotency_key: 'e2e-undo-str1' })

// tenant isolation through the real HTTP + JWT path
for (const [fn, args] of [
  ['inventory_receive_stock', { p_listing_id: LA1, p_quantity: 1, p_reason: 'supplier' }],
  ['inventory_issue_stock', { p_listing_id: LA1, p_quantity: 1, p_reason: 'sale' }],
  ['inventory_adjust_stock', { p_listing_id: LA1, p_new_quantity: 1, p_reason: 'stock_count' }],
  ['inventory_update_settings', { p_listing_id: LA1, p_low_stock_threshold: 1, p_unit: null }],
  ['inventory_enable_tracking', { p_listing_id: LA2, p_opening_quantity: 5 }],
]) {
  const res = await b.rpc(fn, args)
  ok(res.error?.message === 'not_found', `B calling ${fn} on A's product -> not_found`)
}
r = await b.rpc('get_inventory_overview', { p_business_id: BIZ_A, p_status: null, p_search: null, p_limit: 50, p_offset: 0 })
ok(r.error?.message === 'not_authorized' && /wasn't found/.test(describeInventoryError(r.error)), "B reading A's overview by business id -> not_authorized")
r = await b.from('inventory_items').select('*')
ok(!r.error && r.data.length === 0, 'B has no inventory_items yet and sees none of A\'s')
r = await b.from('inventory_movements').select('*').eq('business_id', BIZ_A)
ok(!r.error && r.data.length === 0, "B querying A's business id gets zero history rows (RLS)")
r = await b.from('inventory_movements').select('*').eq('listing_id', LA1)
ok(!r.error && r.data.length === 0, "B querying A's product id gets zero history rows (RLS)")

// direct writes / anon
r = await a.from('inventory_items').update({ quantity: 9999 }).eq('listing_id', LA1)
ok(!!r.error && /permission denied/i.test(r.error.message), 'direct UPDATE of inventory_items through the API is denied')
r = await a.from('inventory_items').insert({ listing_id: LA2, business_id: BIZ_A, quantity: 5 })
ok(!!r.error && /permission denied/i.test(r.error.message), 'direct INSERT into inventory_items through the API is denied')
r = await a.from('inventory_movements').delete().eq('business_id', BIZ_A)
ok(!!r.error && /permission denied/i.test(r.error.message), 'direct DELETE of history through the API is denied')
r = await anon.rpc('inventory_receive_stock', { p_listing_id: LA1, p_quantity: 1, p_reason: 'supplier' })
ok(!!r.error, 'anon cannot call inventory_receive_stock')
r = await anon.from('inventory_items').select('*')
ok(!!r.error, 'anon cannot read inventory_items')
r = await a.rpc('inventory_apply_movement', { p_listing_id: LA1, p_type: 'receipt', p_amount: 1, p_reason: 'supplier', p_note: null, p_reference: null, p_idempotency_key: null, p_expected: null, p_threshold: null, p_unit: null })
ok(!!r.error, 'internal inventory_apply_movement is not reachable from the API')

// read model + exact history query used by the app
r = await a.rpc('get_inventory_overview', { p_business_id: BIZ_A, p_status: null, p_search: null, p_limit: 50, p_offset: 0 })
ok(!r.error && r.data.summary.tracked === 2 && r.data.items.length === 2 && r.data.items[0].name === 'Shea Butter' && r.data.untracked_total === 0, 'overview: summary, urgency ordering (out of stock first), untracked count')
ok(r.data.last_30_days.received === 12 && r.data.last_30_days.issued === 7, `overview: 30-day totals (+${r.data.last_30_days.received} / -${r.data.last_30_days.issued})`)
r = await a.rpc('get_inventory_overview', { p_business_id: BIZ_A, p_status: 'low_stock', p_search: 'tote', p_limit: 50, p_offset: 0 })
ok(!r.error && r.data.total === 0, 'overview: status + search filters combine')
r = await a.from('inventory_movements')
  .select('id, listing_id, product_name, movement_type, quantity_change, balance_before, balance_after, reason, note, reference, created_at')
  .eq('business_id', BIZ_A).eq('listing_id', LA1)
  .order('created_at', { ascending: false }).order('id', { ascending: false })
  .range(0, 25)
ok(!r.error && r.data.length >= 4 && r.data[0].movement_type === 'issue' && r.data[0].balance_after === 15, 'history query (exact builder chain from the app) returns newest first')
ok(!('created_by' in r.data[0]) && !('idempotency_key' in r.data[0]), 'history query does not select internal columns')

console.log(`\nALL ${passed} E2E CHECKS PASSED`)

// Regression tests for the admin silent-failure bugs (verify + delete).
// Before the fix, the admin page ignored the write result and updated its own
// screen: a rejected/no-op write still showed "Verified" / removed the row.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { adminDeleteBusiness, adminSetBusinessVerified } from '../src/lib/admin-actions.ts'

const ID = '11111111-1111-1111-1111-111111111111'
const call = (result) => { const calls = []; const fn = async (name, args) => { calls.push({ name, args }); if (result instanceof Error) throw result; return result }; fn.calls = calls; return fn }

test('delete: success only when the database reports deleting exactly that row', async () => {
  const c = call({ data: { id: ID, business_name: 'Alpha Foods' }, error: null })
  const r = await adminDeleteBusiness(c, ID)
  assert.deepEqual(r, { ok: true, data: { id: ID, business_name: 'Alpha Foods', logo: null } })
  assert.deepEqual(c.calls, [{ name: 'admin_delete_business', args: { p_business_id: ID } }])
})

test('delete: an RPC error is a failure, and says nothing was deleted', async () => {
  const r = await adminDeleteBusiness(call({ data: null, error: { message: 'forbidden' } }), ID)
  assert.equal(r.ok, false)
  assert.match(r.message, /forbidden/)
  assert.match(r.message, /Nothing was deleted/)
})

test('delete: REGRESSION - a "successful" response that confirms nothing must not count as deleted', async () => {
  // This is what the old code effectively relied on: no error, but zero rows.
  for (const data of [null, undefined, [], {}, { id: 'some-other-id' }, { id: ID.replace('1', '2') }, 'ok', 1]) {
    const r = await adminDeleteBusiness(call({ data, error: null }), ID)
    assert.equal(r.ok, false, `data=${JSON.stringify(data)} must be a failure`)
    assert.match(r.message, /did not confirm/)
  }
})

test('delete: migration not applied yet gives a clear message instead of a schema-cache error', async () => {
  const r = await adminDeleteBusiness(call({ data: null, error: { message: 'Could not find the function public.admin_delete_business(p_business_id) in the schema cache' } }), ID)
  assert.equal(r.ok, false)
  assert.match(r.message, /has not been applied yet/)
  assert.doesNotMatch(r.message, /schema cache/)
})

test('delete: a thrown network error is contained', async () => {
  const r = await adminDeleteBusiness(call(new TypeError('fetch failed')), ID)
  assert.equal(r.ok, false)
  assert.match(r.message, /network error/)
})

test('delete: missing business name still succeeds (name is informational)', async () => {
  const r = await adminDeleteBusiness(call({ data: { id: ID }, error: null }), ID)
  assert.deepEqual(r, { ok: true, data: { id: ID, business_name: null, logo: null } })
})

test('verify: success returns the STORED state, not what was requested', async () => {
  const c = call({ data: { id: ID, is_verified: true, trust_score: 80, trust_signals: { a: 1 } }, error: null })
  const r = await adminSetBusinessVerified(c, ID, true)
  assert.deepEqual(r, { ok: true, data: { is_verified: true, trust_score: 80, trust_signals: { a: 1 } } })
  assert.deepEqual(c.calls, [{ name: 'admin_set_business_verified', args: { p_business_id: ID, p_verified: true } }])
})

test('verify: REGRESSION - the database saying "not verified" (or nothing) must never show as Verified', async () => {
  for (const data of [null, {}, { is_verified: false }, { is_verified: 'true' }, []]) {
    const r = await adminSetBusinessVerified(call({ data, error: null }), ID, true)
    assert.equal(r.ok, false, `data=${JSON.stringify(data)} must be a failure`)
    assert.match(r.message, /Nothing was changed/)
  }
  const un = await adminSetBusinessVerified(call({ data: { is_verified: true }, error: null }), ID, false)
  assert.equal(un.ok, false, 'asked to unverify but still verified in DB')
})

test('verify: errors and network failures are surfaced with the right verb', async () => {
  const e = await adminSetBusinessVerified(call({ data: null, error: { message: 'business not found' } }), ID, true)
  assert.match(e.message, /Couldn't verify this business: business not found/)
  const u = await adminSetBusinessVerified(call({ data: null, error: { message: 'forbidden' } }), ID, false)
  assert.match(u.message, /Couldn't remove verification from this business: forbidden/)
  const n = await adminSetBusinessVerified(call(new Error('boom')), ID, true)
  assert.equal(n.ok, false)
  assert.match(n.message, /network error/)
})

test('delete: the logo outcome from the server is passed through for the page to report', async () => {
  const r = await adminDeleteBusiness(call({ data: { id: ID, business_name: 'A', logo: 'failed' }, error: null }), ID)
  assert.deepEqual(r, { ok: true, data: { id: ID, business_name: 'A', logo: 'failed' } })
})

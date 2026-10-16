// Delivery orchestration (src/lib/welcome-delivery.ts) with a fake service client
// and fake sender. The real atomic claim is covered by supabase/tests/onboarding*.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deliverWelcomeEmail } from '../src/lib/welcome-delivery.ts'

const email = { subject: 'S', html: '<p>h</p>', text: 't' }

function harness({ claim = [{ id: 'd1', attempts: 1 }], claimError = null, updateError = null, send }) {
  const calls = { rpc: [], updates: [], sent: [] }
  const service = {
    rpc: async (name, args) => { calls.rpc.push({ name, args }); return { data: claimError ? null : claim, error: claimError } },
    from: (table) => ({
      update: (patch) => {
        const rec = { table, patch, filters: [] }
        calls.updates.push(rec)
        const chain = { eq: (c, v) => { rec.filters.push([c, v]); return chain }, then: (res) => res({ error: updateError }) }
        return chain
      },
    }),
  }
  const sender = async (p) => { calls.sent.push(p); return send(p) }
  return { calls, run: () => deliverWelcomeEmail({ service, businessId: 'biz-1', recipient: 'o@example.com', email, send: sender }) }
}

test('nothing claimable (already sent / in progress / no row): no email is sent', async () => {
  const h = harness({ claim: [], send: async () => ({ ok: true, id: 'x' }) })
  assert.equal(await h.run(), 'skipped')
  assert.equal(h.calls.sent.length, 0)
  assert.equal(h.calls.updates.length, 0)
  assert.deepEqual(h.calls.rpc[0], { name: 'claim_email_delivery', args: { p_business_id: 'biz-1', p_kind: 'welcome' } })
})

test('success: sends once with an idempotency key and records sent + provider id', async () => {
  const h = harness({ send: async () => ({ ok: true, id: 'em_9' }) })
  assert.equal(await h.run(), 'sent')
  assert.equal(h.calls.sent.length, 1)
  assert.equal(h.calls.sent[0].idempotencyKey, 'welcome-biz-1')
  assert.equal(h.calls.sent[0].to, 'o@example.com')
  const u = h.calls.updates[0]
  assert.equal(u.table, 'email_deliveries')
  assert.equal(u.patch.status, 'sent')
  assert.equal(u.patch.provider_id, 'em_9')
  assert.ok(u.patch.sent_at)
  assert.deepEqual(u.filters, [['id', 'd1'], ['status', 'sending']], 'only updates the row it claimed, and only while still claimed')
})

test('provider failure: row marked failed with a short reason (retried later)', async () => {
  const h = harness({ send: async () => ({ ok: false, error: 'resend_500' }) })
  const errors = []
  const orig = console.error; console.error = (...a) => errors.push(a.join(' '))
  try { assert.equal(await h.run(), 'failed') } finally { console.error = orig }
  assert.equal(h.calls.updates[0].patch.status, 'failed')
  assert.equal(h.calls.updates[0].patch.last_error, 'resend_500')
  assert.ok(!errors.join('\n').includes('o@example.com'), 'recipient is never logged')
})

test('sender throwing is contained and recorded as a failure', async () => {
  const h = harness({ send: async () => { throw new Error('boom') } })
  const orig = console.error; console.error = () => {}
  try { assert.equal(await h.run(), 'failed') } finally { console.error = orig }
  assert.equal(h.calls.updates[0].patch.status, 'failed')
  assert.equal(h.calls.updates[0].patch.last_error, 'send_exception')
})

test('not configured: attempt is given back so it sends once the key exists', async () => {
  const h = harness({ claim: [{ id: 'd1', attempts: 2 }], send: async () => ({ ok: false, notConfigured: true }) })
  assert.equal(await h.run(), 'not_configured')
  assert.equal(h.calls.updates[0].patch.status, 'pending')
  assert.equal(h.calls.updates[0].patch.attempts, 1)
})

test('claim errors fail safe: nothing is sent', async () => {
  const h = harness({ claimError: { code: '42501' }, send: async () => ({ ok: true, id: 'x' }) })
  const orig = console.error; console.error = () => {}
  try { assert.equal(await h.run(), 'failed') } finally { console.error = orig }
  assert.equal(h.calls.sent.length, 0)
})

test('a failure to record the outcome does not throw (Resend idempotency covers a re-send)', async () => {
  const h = harness({ updateError: { code: 'XX000' }, send: async () => ({ ok: true, id: 'x' }) })
  const orig = console.error; console.error = () => {}
  try { assert.equal(await h.run(), 'sent') } finally { console.error = orig }
})

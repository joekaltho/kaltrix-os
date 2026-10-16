// Resend transport (src/lib/resend.ts) with a fake fetch. Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EMAIL_FROM, sendEmail } from '../src/lib/resend.ts'

const payload = { to: 'owner@example.com', subject: 'Hi', html: '<p>x</p>', text: 'x', idempotencyKey: 'welcome-abc' }
const reply = (status, body) => async () => new Response(body === undefined ? null : JSON.stringify(body), { status })

test('the sender is updates@kaltrixos.com', () => {
  assert.equal(EMAIL_FROM, 'KaltrixOS <updates@kaltrixos.com>')
})

test('no API key: reports notConfigured and makes no request', async () => {
  let called = false
  const res = await sendEmail(payload, { apiKey: '', fetchImpl: async () => { called = true; return new Response('{}') } })
  assert.deepEqual(res, { ok: false, notConfigured: true })
  assert.equal(called, false)
})

test('sends the right request and returns the provider id', async () => {
  let seen
  const res = await sendEmail(payload, {
    apiKey: 'key_123',
    fetchImpl: async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ id: 'em_1' }), { status: 200 }) },
  })
  assert.deepEqual(res, { ok: true, id: 'em_1' })
  assert.equal(seen.url, 'https://api.resend.com/emails')
  assert.equal(seen.init.method, 'POST')
  assert.equal(seen.init.headers.Authorization, 'Bearer key_123')
  assert.equal(seen.init.headers['Idempotency-Key'], 'welcome-abc')
  const body = JSON.parse(seen.init.body)
  assert.equal(body.from, 'KaltrixOS <updates@kaltrixos.com>')
  assert.deepEqual(body.to, ['owner@example.com'])
  assert.equal(body.subject, 'Hi')
  assert.equal(body.text, 'x')
})

test('HTTP failures become short, non-sensitive error codes', async () => {
  const r1 = await sendEmail(payload, { apiKey: 'k', fetchImpl: reply(403, { name: 'validation_error', message: 'The kaltrixos.com domain is not verified' }) })
  assert.deepEqual(r1, { ok: false, error: 'resend_403_validation_error' })
  const r2 = await sendEmail(payload, { apiKey: 'k', fetchImpl: reply(500) })
  assert.deepEqual(r2, { ok: false, error: 'resend_500' })
  const r3 = await sendEmail(payload, { apiKey: 'k', fetchImpl: reply(429, { name: 'rate_limit_exceeded' }) })
  assert.deepEqual(r3, { ok: false, error: 'resend_429_rate_limit_exceeded' })
  for (const r of [r1, r2, r3]) {
    assert.ok(!JSON.stringify(r).includes('owner@example.com'), 'recipient never leaks into the error')
    assert.ok(!JSON.stringify(r).includes('domain is not verified'), 'free-text provider message is dropped')
  }
})

test('weird provider error names are sanitised', async () => {
  const r = await sendEmail(payload, { apiKey: 'k', fetchImpl: reply(422, { name: 'x<script>alert(1)</script>' + 'y'.repeat(200) }) })
  assert.ok(/^resend_422_[a-z0-9_]{1,60}$/i.test(r.error), r.error)
})

test('network errors and timeouts never throw', async () => {
  const net = await sendEmail(payload, { apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed') } })
  assert.deepEqual(net, { ok: false, error: 'resend_network_error' })

  const slow = await sendEmail(payload, {
    apiKey: 'k',
    timeoutMs: 20,
    fetchImpl: (_url, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })))),
  })
  assert.deepEqual(slow, { ok: false, error: 'resend_timeout' })
})

test('a 200 with an unreadable body is still a success (id unknown)', async () => {
  const res = await sendEmail(payload, { apiKey: 'k', fetchImpl: async () => new Response('not json', { status: 200 }) })
  assert.deepEqual(res, { ok: true, id: null })
})

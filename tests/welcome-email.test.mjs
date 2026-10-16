// Welcome email content (src/lib/welcome-email.ts). Run with: npm test
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildWelcomeEmail, cleanLine, escapeHtml } from '../src/lib/welcome-email.ts'

test('escapeHtml neutralises every HTML-significant character', () => {
  assert.equal(escapeHtml(`<a href="x" onclick='y'>&</a>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;')
})

test('hostile business names cannot inject markup', () => {
  const evil = [
    '<script>alert(1)</script>',
    '"><img src=x onerror=alert(1)>',
    `' onmouseover='alert(1)`,
    '</title><h1>pwned</h1>',
  ]
  for (const name of evil) {
    const { html, subject } = buildWelcomeEmail({ businessName: name, slug: 'ok-slug' })
    assert.ok(!html.includes(name), `raw name never appears in the HTML: ${name}`)
    assert.ok(html.includes(escapeHtml(name)), `escaped name does appear: ${name}`)
    assert.ok(!html.includes('<script'), 'no script element')
    assert.ok(!html.includes('<img'), 'no img element')
    assert.ok(!html.includes('<h1>pwned'), 'no injected heading')
    assert.ok(!subject.includes(name), 'subject never contains the business name')
  }
})

test('subject is fixed and single-line', () => {
  const { subject } = buildWelcomeEmail({ businessName: 'Line\r\nBcc: attacker@example.com' })
  assert.equal(subject, 'Welcome to KaltrixOS — your business profile is live')
  assert.ok(!/[\r\n]/.test(subject))
})

test('names are collapsed, capped, and fall back when empty', () => {
  assert.equal(cleanLine('  Ada\n\t  Foods  ', 80), 'Ada Foods')
  assert.equal(cleanLine('x'.repeat(200), 20).length, 20)
  assert.ok(cleanLine('x'.repeat(200), 20).endsWith('…'))
  assert.match(buildWelcomeEmail({ businessName: '   ' }).text, /your business is now live/)
})

test('public profile link only for a safe slug', () => {
  const good = buildWelcomeEmail({ businessName: 'A', slug: 'mamas-kitchen-lx9' })
  assert.ok(good.html.includes('https://kaltrixos.com/business/mamas-kitchen-lx9'))
  assert.ok(good.text.includes('https://kaltrixos.com/business/mamas-kitchen-lx9'))
  for (const slug of ['../admin', 'a b', 'x"><script>', '', null, undefined, 'a/b']) {
    const e = buildWelcomeEmail({ businessName: 'A', slug })
    assert.ok(!e.html.includes('/business/'), `no profile link for slug ${JSON.stringify(slug)}`)
    assert.ok(!e.text.includes('/business/'))
  }
})

test('has a plain-text alternative and links to the dashboard', () => {
  const e = buildWelcomeEmail({ businessName: 'Mama Put', slug: 'mama-put-1' })
  assert.ok(e.text.includes('Mama Put is now live on KaltrixOS'))
  assert.ok(e.text.includes('https://kaltrixos.com/dashboard'))
  assert.ok(e.html.includes('href="https://kaltrixos.com/dashboard"'))
  assert.ok(e.html.includes('<strong>Mama Put</strong>'))
})

test('claims stay within what the product does (no invented features)', () => {
  const { text } = buildWelcomeEmail({ businessName: 'X' })
  assert.ok(text.includes('30-day Pro trial'))
  for (const banned of ['KaltrixPay', 'Velocity', 'AI ', 'thousands', 'WhatsApp', 'support@']) {
    assert.ok(!text.includes(banned), `must not mention ${banned}`)
  }
})

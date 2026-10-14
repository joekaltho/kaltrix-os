// Unit tests for the pure inventory helpers (src/lib/inventory.ts).
// Run with: npm test   (Node's built-in runner; no extra dependencies)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_BALANCE,
  MAX_MOVEMENT_QUANTITY,
  cleanOptionalText,
  describeInventoryError,
  formatQuantity,
  formatSignedChange,
  newIdempotencyKey,
  parseCountedQuantity,
  parseMovementQuantity,
  parseOpeningQuantity,
  parseOptionalThreshold,
  reasonLabel,
  thresholdSummary,
} from '../src/lib/inventory.ts'

test('movement quantity: accepts whole numbers within range', () => {
  assert.deepEqual(parseMovementQuantity('1'), { ok: true, value: 1 })
  assert.deepEqual(parseMovementQuantity(' 250 '), { ok: true, value: 250 })
  assert.deepEqual(parseMovementQuantity(String(MAX_MOVEMENT_QUANTITY)), { ok: true, value: MAX_MOVEMENT_QUANTITY })
})

test('movement quantity: rejects zero, negatives, decimals, junk and overflow', () => {
  for (const bad of ['', '   ', '0', '00', '-1', '-0', '2.5', '2,5', '1e3', '0x10', 'abc', '12a', '+5', 'Infinity', 'NaN', '１２']) {
    assert.equal(parseMovementQuantity(bad).ok, false, `should reject "${bad}"`)
  }
  assert.equal(parseMovementQuantity(String(MAX_MOVEMENT_QUANTITY + 1)).ok, false)
  assert.equal(parseMovementQuantity('99999999999999999999999').ok, false) // beyond safe integer
})

test('counted / opening quantity: zero is allowed, ceiling enforced', () => {
  assert.deepEqual(parseCountedQuantity('0'), { ok: true, value: 0 })
  assert.deepEqual(parseOpeningQuantity('0'), { ok: true, value: 0 })
  assert.deepEqual(parseCountedQuantity(String(MAX_BALANCE)), { ok: true, value: MAX_BALANCE })
  assert.equal(parseCountedQuantity(String(MAX_BALANCE + 1)).ok, false)
  assert.equal(parseOpeningQuantity('').ok, false) // never silently defaults a quantity
  assert.equal(parseOpeningQuantity('-3').ok, false)
})

test('threshold: empty means "no threshold" (null), otherwise a whole number >= 0', () => {
  assert.deepEqual(parseOptionalThreshold(''), { ok: true, value: null })
  assert.deepEqual(parseOptionalThreshold('  '), { ok: true, value: null })
  assert.deepEqual(parseOptionalThreshold('0'), { ok: true, value: 0 })
  assert.deepEqual(parseOptionalThreshold('12'), { ok: true, value: 12 })
  assert.equal(parseOptionalThreshold('-1').ok, false)
  assert.equal(parseOptionalThreshold('1.5').ok, false)
  assert.equal(parseOptionalThreshold('lots').ok, false)
})

test('optional text: trims, nulls empty, enforces length', () => {
  assert.deepEqual(cleanOptionalText('  hi  ', 10, 'Note'), { ok: true, value: 'hi' })
  assert.deepEqual(cleanOptionalText('   ', 10, 'Note'), { ok: true, value: null })
  assert.equal(cleanOptionalText('x'.repeat(11), 10, 'Note').ok, false)
})

test('formatting', () => {
  assert.equal(formatQuantity(12, null), '12')
  assert.equal(formatQuantity(12, 'bags'), '12 bags')
  assert.equal(formatSignedChange(5), '+5')
  assert.equal(formatSignedChange(-3), '−3')
  assert.equal(formatSignedChange(0), '0')
  assert.equal(thresholdSummary(null), 'No low-stock alert set')
  assert.equal(thresholdSummary(5), 'Low-stock alert at 5')
  assert.equal(reasonLabel('sale'), 'Sold')
  assert.equal(reasonLabel('something_new'), 'Other')
})

test('server error codes become safe, specific messages', () => {
  assert.match(describeInventoryError({ message: 'insufficient_stock', details: '11' }), /only 11 on hand/)
  assert.match(describeInventoryError({ message: 'stale_balance', details: '17' }), /now 17/)
  assert.match(describeInventoryError({ message: 'invalid_text', details: 'note_required' }), /note/i)
  assert.match(describeInventoryError({ message: 'not_found' }), /wasn't found/)
  assert.match(describeInventoryError({ message: 'not_authenticated' }), /Sign in/)
})

test('unknown / raw database errors never leak to the screen', () => {
  const raw = describeInventoryError({ message: 'permission denied for table inventory_items', code: '42501' })
  assert.equal(raw, 'Something went wrong and nothing was changed. Please try again.')
  assert.equal(describeInventoryError(null), 'Something went wrong and nothing was changed. Please try again.')
  assert.doesNotMatch(raw, /inventory_items|permission|42501/)
})

test('network failures are not reported as "nothing was changed"', () => {
  for (const message of ['TypeError: fetch failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed']) {
    const out = describeInventoryError({ message })
    assert.match(out, /couldn't confirm whether this was saved/, message)
    assert.doesNotMatch(out, /nothing was changed/i, message)
  }
})

test('idempotency keys are unique and within the database length limits (8-100)', () => {
  const keys = new Set(Array.from({ length: 200 }, () => newIdempotencyKey()))
  assert.equal(keys.size, 200)
  for (const k of keys) assert.ok(k.length >= 8 && k.length <= 100)
})

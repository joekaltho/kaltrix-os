// Inventory & Stock Management -- pure helpers (no I/O, no React, no Supabase).
//
// Kept dependency-free on purpose so the rules are easy to audit and so they
// can be unit tested with plain `node --test` (see tests/inventory.test.mjs).
// The database is the authority: it re-validates every one of these rules and
// computes stock_status itself. Nothing here decides a status or a balance;
// this file only parses what the user typed and words what the server said.
import type { InventoryMovementType, StockStatus } from '@/types'

// Must match the limits in supabase/migrations/20261014055333_inventory_stock_management.sql
export const MAX_MOVEMENT_QUANTITY = 10_000_000
export const MAX_BALANCE = 1_000_000_000
export const NOTE_MAX = 500
export const REFERENCE_MAX = 100
export const UNIT_MAX = 20

export interface ReasonOption { value: string; label: string }

export const RECEIPT_REASONS: ReasonOption[] = [
  { value: 'supplier', label: 'From a supplier' },
  { value: 'customer_return', label: 'Customer return' },
  { value: 'other', label: 'Other' },
]

export const ISSUE_REASONS: ReasonOption[] = [
  { value: 'sale', label: 'Sold' },
  { value: 'internal_use', label: 'Used internally' },
  { value: 'damaged', label: 'Damaged or lost' },
  { value: 'other', label: 'Other' },
]

export const ADJUST_REASONS: ReasonOption[] = [
  { value: 'stock_count', label: 'Physical stock count' },
  { value: 'damaged', label: 'Damaged or lost' },
  { value: 'correction', label: 'Correcting a mistake' },
  { value: 'other', label: 'Other (explain in note)' },
]

const REASON_LABELS: Record<string, string> = {
  opening_balance: 'Opening balance',
  supplier: 'From a supplier',
  customer_return: 'Customer return',
  sale: 'Sold',
  internal_use: 'Used internally',
  damaged: 'Damaged or lost',
  stock_count: 'Physical stock count',
  correction: 'Correcting a mistake',
  other: 'Other',
}

export const reasonLabel = (reason: string) => REASON_LABELS[reason] ?? 'Other'

export const MOVEMENT_LABELS: Record<InventoryMovementType, string> = {
  opening: 'Opening balance',
  receipt: 'Received',
  issue: 'Issued',
  adjustment: 'Adjusted',
}

export const STATUS_LABELS: Record<StockStatus, string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Out of stock',
}

export const isStockStatus = (value: string | null): value is StockStatus =>
  value === 'in_stock' || value === 'low_stock' || value === 'out_of_stock'

export type ParseResult = { ok: true; value: number } | { ok: false; error: string }

const formatInt = (n: number) => n.toLocaleString('en-NG')

// Whole units only: KaltrixOS products have no fractional-unit model. Rejects
// empty input, decimals, negatives, exponent notation ("1e9"), and anything
// outside [min, max]. Digits-only matching means Number() can never see
// something surprising (hex, Infinity, "  ", etc.).
export function parseWholeQuantity(raw: string, opts: { min: number; max: number; label?: string }): ParseResult {
  const label = opts.label ?? 'Quantity'
  const text = raw.trim()
  if (text === '') return { ok: false, error: `Enter a ${label.toLowerCase()}` }
  if (!/^\d+$/.test(text)) return { ok: false, error: `${label} must be a whole number` }
  const value = Number(text)
  if (!Number.isSafeInteger(value)) return { ok: false, error: `${label} is too large` }
  if (value < opts.min) {
    return { ok: false, error: opts.min === 1 ? `${label} must be at least 1` : `${label} can't be below ${formatInt(opts.min)}` }
  }
  if (value > opts.max) return { ok: false, error: `${label} can't be more than ${formatInt(opts.max)}` }
  return { ok: true, value }
}

export const parseMovementQuantity = (raw: string) =>
  parseWholeQuantity(raw, { min: 1, max: MAX_MOVEMENT_QUANTITY })

export const parseCountedQuantity = (raw: string) =>
  parseWholeQuantity(raw, { min: 0, max: MAX_BALANCE, label: 'Counted quantity' })

export const parseOpeningQuantity = (raw: string) =>
  parseWholeQuantity(raw, { min: 0, max: MAX_BALANCE, label: 'Quantity on hand' })

// Empty = "no alert threshold" (stored as NULL; behaves like 0 -- the product
// is never shown as low, only in stock / out of stock).
export function parseOptionalThreshold(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (raw.trim() === '') return { ok: true, value: null }
  const parsed = parseWholeQuantity(raw, { min: 0, max: MAX_BALANCE, label: 'Low-stock level' })
  return parsed.ok ? { ok: true, value: parsed.value } : parsed
}

export function cleanOptionalText(raw: string, max: number, label: string): { ok: true; value: string | null } | { ok: false; error: string } {
  const value = raw.trim()
  if (value === '') return { ok: true, value: null }
  if (value.length > max) return { ok: false, error: `${label} must be ${max} characters or fewer` }
  return { ok: true, value }
}

export function formatQuantity(quantity: number, unit: string | null): string {
  return `${formatInt(quantity)}${unit ? ` ${unit}` : ''}`
}

export function formatSignedChange(change: number): string {
  return `${change > 0 ? '+' : change < 0 ? '−' : ''}${formatInt(Math.abs(change))}`
}

export function thresholdSummary(threshold: number | null): string {
  return threshold === null ? 'No low-stock alert set' : `Low-stock alert at ${formatInt(threshold)}`
}

// ---- Server error wording ------------------------------------------------------------
// The database raises short codes as the error message (and a number or hint in
// `details`). Anything we don't recognise gets one generic sentence: raw
// database text never reaches the screen.
export interface RpcErrorLike {
  message?: string | null
  details?: string | null
  code?: string | null
}

// When the request may or may not have reached the server we can't claim
// "nothing was changed": the response could have been lost after the save.
// Pressing the button again with the same values reuses the idempotency key,
// so it is applied at most once.
export const NETWORK_ERROR_MESSAGE =
  "We couldn't confirm whether this was saved. Check your connection, then press the button again without changing anything. It won't be applied twice."

const NETWORK_ERROR_PATTERN = /fetch failed|failed to fetch|network ?error|network request failed|load failed|timed? ?out|econn|enotfound/i

export function describeInventoryError(err: RpcErrorLike | null | undefined): string {
  const code = (err?.message ?? '').trim()
  const detail = (err?.details ?? '').trim()
  if (NETWORK_ERROR_PATTERN.test(code)) return NETWORK_ERROR_MESSAGE
  switch (code) {
    case 'insufficient_stock':
      return detail && /^\d+$/.test(detail)
        ? `Not enough stock: only ${formatInt(Number(detail))} on hand. Nothing was changed.`
        : 'Not enough stock for that. Nothing was changed.'
    case 'stale_balance':
      return detail && /^\d+$/.test(detail)
        ? `Stock changed while you were counting. It's now ${formatInt(Number(detail))}. Check the number and try again.`
        : 'Stock changed while you were counting. Check the number and try again.'
    case 'no_change':
      return 'The counted quantity matches the recorded stock, so there is nothing to adjust.'
    case 'invalid_quantity':
      return 'That quantity is not valid.'
    case 'quantity_too_large':
      return 'That would take the stock above the maximum this product can hold.'
    case 'invalid_reason':
      return 'Pick a reason from the list.'
    case 'invalid_text':
      return detail === 'note_required'
        ? 'Add a short note explaining this adjustment.'
        : 'The note or reference is too long.'
    case 'invalid_threshold':
      return 'The low-stock level must be a whole number of 0 or more.'
    case 'invalid_unit':
      return `The unit label must be ${UNIT_MAX} characters or fewer.`
    case 'invalid_idempotency_key':
    case 'idempotency_key_reused':
      return 'That request could not be processed. Close this window and try again.'
    case 'already_tracked':
      return 'Stock is already being tracked for this product. Refresh the page.'
    case 'not_tracked':
      return 'Stock tracking is not turned on for this product yet.'
    case 'not_found':
    case 'not_authorized':
      return "That product wasn't found in your business. Refresh the page and try again."
    case 'not_authenticated':
      return 'Your session has expired. Sign in again to continue.'
    default:
      return 'Something went wrong and nothing was changed. Please try again.'
  }
}

// One key per intended submission: a retry of the *same* form values reuses it
// (so a double click or a retry after a dropped connection cannot apply twice);
// the UI mints a new one whenever the user edits the form.
export function newIdempotencyKey(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes)
  else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { InventoryItem } from '@/types'
import { Button } from '@/components/ui/Button'
import Notice from '@/components/ui/Notice'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import {
  ADJUST_REASONS,
  ISSUE_REASONS,
  NOTE_MAX,
  RECEIPT_REASONS,
  REFERENCE_MAX,
  UNIT_MAX,
  cleanOptionalText,
  formatQuantity,
  formatSignedChange,
  newIdempotencyKey,
  parseCountedQuantity,
  parseMovementQuantity,
  parseOpeningQuantity,
  parseOptionalThreshold,
} from '@/lib/inventory'
import { adjustStock, enableTracking, issueStock, receiveStock, updateSettings, type MutationResult } from '@/lib/inventory-api'

// ---- Shared modal shell ------------------------------------------------------------------
// Same visual language as the existing Edit Listing modal, plus what that one
// lacks: role="dialog", Escape to close, focus moved in on open and restored on
// close, and no dismissal while a request is in flight.
function Modal({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: React.ReactNode }) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  // Latest props for the one-time key/focus effect below (so a parent re-render
  // never re-runs it and steals focus back to the first field).
  const latest = useRef({ onClose, busy })
  useEffect(() => { latest.current = { onClose, busy } })

  const close = useCallback(() => {
    if (!latest.current.busy) latest.current.onClose()
  }, [])

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button:not([data-modal-close])')
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close() }
      if (e.key === 'Tab' && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href]'
        )
        if (focusable.length === 0) return
        const firstEl = focusable[0]
        const lastEl = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus() }
        else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previouslyFocused?.focus?.()
    }
  }, [close])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={close}>
      <div className="absolute inset-0 bg-inkStatic/60 backdrop-blur-sm" aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold">{title}</h3>
          <button
            type="button"
            data-modal-close
            onClick={close}
            disabled={busy}
            aria-label="Close"
            className="rounded p-1 text-inkFaint transition hover:text-ink disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export type ItemMutationDone = (result: MutationResult, message: string) => void

// ---- Receive / Issue / Adjust ---------------------------------------------------------------------
export type StockAction = 'receive' | 'issue' | 'adjust'

const ACTION_COPY: Record<StockAction, { title: string; submit: string; quantityLabel: string }> = {
  receive: { title: 'Receive stock', submit: 'Add to stock', quantityLabel: 'Quantity received' },
  issue: { title: 'Issue stock', submit: 'Remove from stock', quantityLabel: 'Quantity issued' },
  adjust: { title: 'Adjust stock count', submit: 'Review adjustment', quantityLabel: 'Counted quantity' },
}

export function StockActionModal({
  action,
  item,
  onClose,
  onDone,
}: {
  action: StockAction
  item: InventoryItem
  onClose: () => void
  onDone: ItemMutationDone
}) {
  const supabase = useState(() => createClient())[0]
  const copy = ACTION_COPY[action]
  const reasons = action === 'receive' ? RECEIPT_REASONS : action === 'issue' ? ISSUE_REASONS : ADJUST_REASONS

  const [quantity, setQuantity] = useState('')
  const [reason, setReason] = useState(reasons[0].value)
  const [note, setNote] = useState('')
  const [reference, setReference] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  // Set synchronously, before the state update lands, so two clicks in the same
  // tick can't both send a request. The idempotency key below is the backstop.
  const inFlight = useRef(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  // One key per intended submission; a new one whenever the user edits anything,
  // so a retry of identical values can never apply twice but changed values are
  // never mistaken for the earlier attempt.
  const [key, setKey] = useState(() => newIdempotencyKey())
  const touch = () => { setKey(newIdempotencyKey()); setConfirming(false); setFormError(null) }

  const parsedQuantity = action === 'adjust' ? parseCountedQuantity(quantity) : parseMovementQuantity(quantity)
  const delta = parsedQuantity.ok
    ? action === 'receive' ? parsedQuantity.value
      : action === 'issue' ? -parsedQuantity.value
      : parsedQuantity.value - item.quantity
    : null
  const resulting = delta === null ? null : item.quantity + delta

  const emptiesStock = action === 'issue' && parsedQuantity.ok && parsedQuantity.value === item.quantity
  const needsConfirmation = action === 'adjust' || emptiesStock

  const validate = () => {
    if (!parsedQuantity.ok) { setFieldError(parsedQuantity.error); return null }
    if (action === 'issue' && parsedQuantity.value > item.quantity) {
      setFieldError(`Only ${formatQuantity(item.quantity, item.unit)} on hand`)
      return null
    }
    if (action === 'adjust' && parsedQuantity.value === item.quantity) {
      setFieldError('That matches the recorded stock, so there is nothing to adjust')
      return null
    }
    const cleanNote = cleanOptionalText(note, NOTE_MAX, 'Note')
    if (!cleanNote.ok) { setFormError(cleanNote.error); return null }
    if (action === 'adjust' && reason === 'other' && cleanNote.value === null) {
      setFormError('Add a short note explaining this adjustment.')
      return null
    }
    const cleanRef = cleanOptionalText(reference, REFERENCE_MAX, 'Reference')
    if (!cleanRef.ok) { setFormError(cleanRef.error); return null }
    setFieldError(null)
    return { quantity: parsedQuantity.value, note: cleanNote.value, reference: cleanRef.value }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current) return
    const valid = validate()
    if (!valid) return
    if (needsConfirmation && !confirming) { setConfirming(true); setFormError(null); return }

    inFlight.current = true
    setSubmitting(true)
    setFormError(null)
    const result =
      action === 'receive'
        ? await receiveStock(supabase, { listingId: item.listing_id, quantity: valid.quantity, reason, note: valid.note, reference: valid.reference, key })
        : action === 'issue'
          ? await issueStock(supabase, { listingId: item.listing_id, quantity: valid.quantity, reason, note: valid.note, key })
          : await adjustStock(supabase, { listingId: item.listing_id, newQuantity: valid.quantity, expectedQuantity: item.quantity, reason, note: valid.note, key })

    if (!result.ok) {
      inFlight.current = false
      setSubmitting(false)
      setConfirming(false)
      setFormError(result.error)
      return
    }

    const now = formatQuantity(result.data.quantity, item.unit)
    const message = result.data.duplicate
      ? `That was already recorded, so nothing was added twice. ${item.name} has ${now}.`
      : action === 'receive'
        ? `Received ${formatQuantity(valid.quantity, item.unit)}. ${item.name} now has ${now}.`
        : action === 'issue'
          ? `Issued ${formatQuantity(valid.quantity, item.unit)}. ${item.name} now has ${now}.`
          : `Stock count saved. ${item.name} now has ${now}.`
    onDone(result.data, message)
  }

  return (
    <Modal title={`${copy.title}: ${item.name}`} onClose={onClose} busy={submitting}>
      <p className="mb-4 text-sm text-inkMid">
        Currently <span className="font-semibold text-ink">{formatQuantity(item.quantity, item.unit)}</span> on hand.
      </p>

      {formError && <div className="mb-4"><Notice kind="error">{formError}</Notice></div>}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label={copy.quantityLabel}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={quantity}
          onChange={(e) => { setQuantity(e.target.value); setFieldError(null); touch() }}
          error={fieldError}
          hint={action === 'adjust' ? 'Enter what you actually counted. This replaces the recorded number.' : undefined}
          disabled={submitting}
          required
        />

        <SelectField
          label={action === 'receive' ? 'Where is it from?' : action === 'issue' ? 'Why is it leaving?' : 'Why are you adjusting?'}
          value={reason}
          onChange={(e) => { setReason(e.target.value); touch() }}
          disabled={submitting}
        >
          {reasons.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </SelectField>

        {action === 'receive' && (
          <TextField
            label="Reference"
            optional
            placeholder="e.g. supplier invoice number"
            maxLength={REFERENCE_MAX}
            value={reference}
            onChange={(e) => { setReference(e.target.value); touch() }}
            disabled={submitting}
          />
        )}

        <TextAreaField
          label="Note"
          optional={!(action === 'adjust' && reason === 'other')}
          rows={2}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => { setNote(e.target.value); touch() }}
          disabled={submitting}
        />

        {delta !== null && resulting !== null && (
          <p className="rounded-lg bg-ivoryDim px-3.5 py-2.5 text-sm text-inkMid" aria-live="polite">
            {item.quantity.toLocaleString('en-NG')} → <span className="font-semibold text-ink">{formatQuantity(resulting, item.unit)}</span>{' '}
            <span className="text-inkFaint">({formatSignedChange(delta)})</span>
          </p>
        )}

        {confirming && (
          <Notice kind="warn">
            {action === 'adjust'
              ? `This sets ${item.name} from ${item.quantity.toLocaleString('en-NG')} to ${resulting?.toLocaleString('en-NG')} and is saved permanently in the stock history. It can't be edited later, only corrected with another adjustment.`
              : `This removes all remaining stock, so ${item.name} will show as out of stock.`}
          </Notice>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={() => (confirming ? setConfirming(false) : onClose())} disabled={submitting} full>
            {confirming ? 'Go back' : 'Cancel'}
          </Button>
          <Button type="submit" variant="primary" loading={submitting} full>
            {confirming ? 'Confirm' : copy.submit}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Start tracking a product ----------------------------------------------------------------------------
export function TrackStockModal({
  listing,
  onClose,
  onDone,
}: {
  listing: { id: string; name: string }
  onClose: () => void
  onDone: (message: string) => void
}) {
  const supabase = useState(() => createClient())[0]
  const [opening, setOpening] = useState('')
  const [threshold, setThreshold] = useState('')
  const [unit, setUnit] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [thresholdError, setThresholdError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [key, setKey] = useState(() => newIdempotencyKey())
  const touch = () => { setKey(newIdempotencyKey()); setFormError(null) }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current) return
    const qty = parseOpeningQuantity(opening)
    const thr = parseOptionalThreshold(threshold)
    const cleanUnit = cleanOptionalText(unit, UNIT_MAX, 'Unit')
    setFieldError(qty.ok ? null : qty.error)
    setThresholdError(thr.ok ? null : thr.error)
    if (!qty.ok || !thr.ok) return
    if (!cleanUnit.ok) { setFormError(cleanUnit.error); return }

    inFlight.current = true
    setSubmitting(true)
    setFormError(null)
    const result = await enableTracking(supabase, {
      listingId: listing.id,
      openingQuantity: qty.value,
      threshold: thr.value,
      unit: cleanUnit.value,
      key,
    })
    if (!result.ok) {
      inFlight.current = false
      setSubmitting(false)
      setFormError(result.error)
      return
    }
    onDone(`Now tracking stock for ${listing.name}: ${formatQuantity(result.data.quantity, cleanUnit.value)} on hand.`)
  }

  return (
    <Modal title={`Track stock: ${listing.name}`} onClose={onClose} busy={submitting}>
      <p className="mb-4 text-sm text-inkMid">
        Count what you have right now. This becomes your starting balance; every change after it is recorded.
      </p>
      {formError && <div className="mb-4"><Notice kind="error">{formError}</Notice></div>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Quantity on hand now"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={opening}
          onChange={(e) => { setOpening(e.target.value); setFieldError(null); touch() }}
          error={fieldError}
          hint="Enter 0 if you have none right now."
          disabled={submitting}
          required
        />
        <TextField
          label="Low-stock level"
          optional
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={threshold}
          onChange={(e) => { setThreshold(e.target.value); setThresholdError(null); touch() }}
          error={thresholdError}
          hint="Flag this product as low once stock falls to this number. Leave empty for no low-stock flag."
          disabled={submitting}
        />
        <TextField
          label="Unit"
          optional
          placeholder="e.g. pcs, bags, boxes"
          maxLength={UNIT_MAX}
          value={unit}
          onChange={(e) => { setUnit(e.target.value); touch() }}
          hint="Only a label; stock is counted in whole units."
          disabled={submitting}
        />
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting} full>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting} full>Start tracking</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---- Low-stock level + unit -------------------------------------------------------------------------------------
export function StockSettingsModal({
  item,
  onClose,
  onDone,
}: {
  item: InventoryItem
  onClose: () => void
  onDone: (message: string) => void
}) {
  const supabase = useState(() => createClient())[0]
  const [threshold, setThreshold] = useState(item.low_stock_threshold === null ? '' : String(item.low_stock_threshold))
  const [unit, setUnit] = useState(item.unit ?? '')
  const [submitting, setSubmitting] = useState(false)
  const inFlight = useRef(false)
  const [thresholdError, setThresholdError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (inFlight.current) return
    const thr = parseOptionalThreshold(threshold)
    const cleanUnit = cleanOptionalText(unit, UNIT_MAX, 'Unit')
    setThresholdError(thr.ok ? null : thr.error)
    if (!thr.ok) return
    if (!cleanUnit.ok) { setFormError(cleanUnit.error); return }

    inFlight.current = true
    setSubmitting(true)
    setFormError(null)
    const result = await updateSettings(supabase, { listingId: item.listing_id, threshold: thr.value, unit: cleanUnit.value })
    if (!result.ok) {
      inFlight.current = false
      setSubmitting(false)
      setFormError(result.error)
      return
    }
    onDone(`Saved stock settings for ${item.name}.`)
  }

  return (
    <Modal title={`Stock settings: ${item.name}`} onClose={onClose} busy={submitting}>
      {formError && <div className="mb-4"><Notice kind="error">{formError}</Notice></div>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Low-stock level"
          optional
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={threshold}
          onChange={(e) => { setThreshold(e.target.value); setThresholdError(null); setFormError(null) }}
          error={thresholdError}
          hint="Shown as low once stock is at or below this number (and above 0). Empty means no low-stock flag."
          disabled={submitting}
        />
        <TextField
          label="Unit"
          optional
          placeholder="e.g. pcs, bags, boxes"
          maxLength={UNIT_MAX}
          value={unit}
          onChange={(e) => { setUnit(e.target.value); setFormError(null) }}
          disabled={submitting}
        />
        <p className="text-xs text-inkFaint">Changing these does not change your stock count or add to the history.</p>
        <div className="flex gap-2 pt-1">
          <Button variant="secondary" onClick={onClose} disabled={submitting} full>Cancel</Button>
          <Button type="submit" variant="primary" loading={submitting} full>Save</Button>
        </div>
      </form>
    </Modal>
  )
}

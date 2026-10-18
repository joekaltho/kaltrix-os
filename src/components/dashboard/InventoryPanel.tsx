'use client'

import { useEffect, useState } from 'react'
import { History, Package, Search } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { InventoryItem, InventoryMovement, StockStatus } from '@/types'
import { Button, ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import Notice from '@/components/ui/Notice'
import { StatusBadge, type Tone } from '@/components/ui/StatusBadge'
import { formatDateTime } from '@/lib/format'
import {
  MOVEMENT_LABELS,
  STATUS_LABELS,
  formatQuantity,
  formatSignedChange,
  reasonLabel,
  thresholdSummary,
} from '@/lib/inventory'
import {
  fetchInventoryOverview,
  fetchMovements,
  type InventoryOverview,
} from '@/lib/inventory-api'
import { StockActionModal, StockSettingsModal, TrackStockModal, type StockAction } from './InventoryDialogs'
import InventoryIntro from './InventoryIntro'
import { isAlreadyUsingInventory } from '@/lib/feature-announcements'

const STATUS_TONE: Record<StockStatus, Tone> = {
  in_stock: 'success',
  low_stock: 'warn',
  out_of_stock: 'danger',
}

type Modal =
  | { type: 'action'; action: StockAction; item: InventoryItem }
  | { type: 'settings'; item: InventoryItem }
  | { type: 'track'; listing: { id: string; name: string } }
  | null

type Result =
  | { key: string; overview: InventoryOverview; items: InventoryItem[]; error: null }
  | { key: string; overview: null; items: []; error: string }

const card = 'rounded-xl border border-border bg-surface'

export default function InventoryPanel({
  businessId,
  showIntro = false,
  onDismissIntro,
}: {
  businessId: string
  // First-visit introduction (see feature-announcements.ts); off by default.
  showIntro?: boolean
  onDismissIntro?: () => void
}) {
  const supabase = useState(() => createClient())[0]

  const [view, setView] = useState<'stock' | 'history'>('stock')
  const [status, setStatus] = useState<StockStatus | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const [modal, setModal] = useState<Modal>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<{ listingId: string; name: string } | null>(null)

  const queryKey = `${status ?? 'all'}|${search}|${reloadKey}`

  // Debounce the search box so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(t)
  }, [searchInput])

  // Load page 1 whenever the filter/search changes or something was mutated.
  // The previous result stays on screen while a refresh is in flight.
  useEffect(() => {
    let cancelled = false
    fetchInventoryOverview(supabase, { businessId, status, search, offset: 0 }).then((res) => {
      if (cancelled) return
      setLoadMoreError(null)
      setResult(
        res.ok
          ? { key: queryKey, overview: res.data, items: res.data.items, error: null }
          : { key: queryKey, overview: null, items: [], error: res.error }
      )
    })
    return () => { cancelled = true }
  }, [supabase, businessId, status, search, queryKey])

  const refresh = () => setReloadKey((n) => n + 1)

  // The intro is for people who haven't started tracking stock: if the business
  // already tracks something, don't show it and record it as dismissed.
  const alreadyUsing = isAlreadyUsingInventory(result?.overview?.summary.tracked)
  useEffect(() => {
    if (showIntro && alreadyUsing) onDismissIntro?.()
  }, [showIntro, alreadyUsing, onDismissIntro])

  const loadMore = async () => {
    if (!result?.overview || loadingMore) return
    setLoadingMore(true)
    setLoadMoreError(null)
    const res = await fetchInventoryOverview(supabase, { businessId, status, search, offset: result.items.length })
    setLoadingMore(false)
    if (!res.ok) { setLoadMoreError(res.error); return }
    setResult((prev) =>
      prev && prev.overview && prev.key === queryKey
        ? { ...prev, items: [...prev.items, ...res.data.items.filter((i) => !prev.items.some((p) => p.listing_id === i.listing_id))] }
        : prev
    )
  }

  const onMutated = (message: string) => {
    setModal(null)
    setNotice(message)
    refresh()
  }

  const showHistory = (item: InventoryItem | null) => {
    setHistoryFilter(item ? { listingId: item.listing_id, name: item.name } : null)
    setView('history')
  }

  // ── First load / hard error ───────────────────────────────────────────────────────────────────────
  if (!result) {
    return (
      <div className="flex justify-center py-16" role="status" aria-label="Loading inventory">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    )
  }

  if (result.error !== null) {
    return (
      <Notice kind="error" action={<Button size="sm" variant="secondary" onClick={refresh}>Try again</Button>}>
        Couldn&apos;t load your inventory. {result.error}
      </Notice>
    )
  }

  const { overview, items } = result
  const { summary } = overview
  const refreshing = result.key !== queryKey
  const nothingYet = summary.tracked === 0

  const tile = (key: StockStatus, label: string, value: number, tone: 'warn' | 'danger' | 'ok') => {
    const active = status === key
    const accent =
      tone === 'danger' && value > 0 ? 'text-danger' : tone === 'warn' && value > 0 ? 'text-warn' : 'text-ink'
    return (
      <button
        key={label}
        type="button"
        onClick={() => { setStatus(active ? null : key); setView('stock') }}
        aria-pressed={active}
        className={`${card} px-4 py-3 text-left transition-colors hover:bg-ivoryDim ${active ? 'border-brandDim ring-2 ring-brand/20' : ''}`}
      >
        <span className="block text-xs font-medium text-inkFaint">{label}</span>
        <span className={`mt-0.5 block text-2xl font-semibold tabular-nums ${accent}`}>{value.toLocaleString('en-NG')}</span>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {showIntro && onDismissIntro && !alreadyUsing && <InventoryIntro onDismiss={onDismissIntro} />}
      {notice && <Notice kind="success" onDismiss={() => setNotice(null)}>{notice}</Notice>}

      {/* Summary — real counts from the database; the tiles double as stock-status filters */}
      {!nothingYet && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className={`${card} px-4 py-3`}>
              <span className="block text-xs font-medium text-inkFaint">Tracked products</span>
              <span className="mt-0.5 block text-2xl font-semibold tabular-nums">{summary.tracked.toLocaleString('en-NG')}</span>
            </div>
            {tile('in_stock', 'In stock', summary.in_stock, 'ok')}
            {tile('low_stock', 'Low stock', summary.low_stock, 'warn')}
            {tile('out_of_stock', 'Out of stock', summary.out_of_stock, 'danger')}
          </div>
          <p className="text-xs text-inkFaint">
            Last 30 days: {overview.last_30_days.received.toLocaleString('en-NG')} units received ·{' '}
            {overview.last_30_days.issued.toLocaleString('en-NG')} issued
          </p>
        </>
      )}

      {/* View switch */}
      {!nothingYet && (
        <div className="flex gap-1 border-b border-border" role="group" aria-label="Inventory views">
          {([['stock', 'Stock', Package], ['history', 'History', History]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => { setView(id); if (id === 'stock') setHistoryFilter(null) }}
              aria-pressed={view === id}
              className={`-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${view === id ? 'border-brandDim text-brandText' : 'border-transparent text-inkFaint hover:text-ink'}`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      )}

      {view === 'history' && !nothingYet ? (
        <MovementHistory
          businessId={businessId}
          filter={historyFilter}
          onClearFilter={() => setHistoryFilter(null)}
          reloadKey={reloadKey}
        />
      ) : (
        <>
          {/* Search + active filter */}
          {!nothingYet && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-inkFaint" aria-hidden />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search products"
                  aria-label="Search products"
                  maxLength={100}
                  className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-3.5 text-sm text-ink placeholder:text-inkFaint focus:border-brandDim focus:outline-none focus:ring-2 focus:ring-brand/20"
                />
              </div>
              {status && (
                <p className="text-xs text-inkFaint" aria-live="polite">
                  Showing <span className="font-semibold text-inkMid">{STATUS_LABELS[status]}</span> only.{' '}
                  <button type="button" onClick={() => setStatus(null)} className="font-semibold text-brandText hover:underline">Clear filter</button>
                </p>
              )}
            </div>
          )}

          {/* Empty states */}
          {nothingYet && overview.untracked_total === 0 && (
            <EmptyState
              icon={Package}
              title="No products to track yet"
              description="Inventory tracks the products in your Shop. Add a listing first, then turn on stock tracking for it. Services and anything you don't count can stay untracked."
              action={<ButtonLink href="/dashboard/listings/new" variant="primary">Add a listing</ButtonLink>}
            />
          )}
          {nothingYet && overview.untracked_total > 0 && (
            <EmptyState
              icon={Package}
              title="Start tracking your stock"
              description="Pick a product below, enter how many you have right now, and KaltrixOS will keep the balance and a full history as you receive and sell stock."
            />
          )}

          {/* Tracked list */}
          {!nothingYet && (
            <div className={refreshing ? 'opacity-60 transition-opacity' : 'transition-opacity'} aria-busy={refreshing}>
              {items.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No products match"
                  description="Try a different search or clear the filter."
                  action={<Button variant="secondary" onClick={() => { setStatus(null); setSearchInput('') }}>Clear filters</Button>}
                />
              ) : (
                <>
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                    {items.map((item) => (
                      <InventoryRow
                        key={item.listing_id}
                        item={item}
                        stale={refreshing}
                        onAction={(action) => setModal({ type: 'action', action, item })}
                        onSettings={() => setModal({ type: 'settings', item })}
                        onHistory={() => showHistory(item)}
                      />
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-col items-center gap-2">
                    <p className="text-xs text-inkFaint">
                      Showing {items.length.toLocaleString('en-NG')} of {overview.total.toLocaleString('en-NG')}
                    </p>
                    {loadMoreError && <Notice kind="error">{loadMoreError}</Notice>}
                    {items.length < overview.total && (
                      <Button variant="secondary" onClick={loadMore} loading={loadingMore}>Show more</Button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Products that aren't tracked (optional per product) */}
          {overview.untracked_total > 0 && (
            <section aria-labelledby="untracked-heading" className="space-y-2">
              <div>
                <h2 id="untracked-heading" className="text-sm font-semibold">
                  Not tracking stock ({overview.untracked_total.toLocaleString('en-NG')})
                </h2>
                <p className="text-xs text-inkFaint">Tracking is optional. Turn it on only for products you count.</p>
              </div>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
                {overview.untracked.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <p className="min-w-0 truncate text-sm font-medium">{l.name}</p>
                    <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'track', listing: { id: l.id, name: l.name } })}>
                      Track stock
                    </Button>
                  </li>
                ))}
              </ul>
              {overview.untracked_total > overview.untracked.length && (
                <p className="text-xs text-inkFaint">Showing the first {overview.untracked.length} of {overview.untracked_total.toLocaleString('en-NG')} untracked products.</p>
              )}
            </section>
          )}
        </>
      )}

      {modal?.type === 'action' && (
        <StockActionModal
          action={modal.action}
          item={modal.item}
          onClose={() => setModal(null)}
          onDone={(_result, message) => onMutated(message)}
        />
      )}
      {modal?.type === 'settings' && (
        <StockSettingsModal item={modal.item} onClose={() => setModal(null)} onDone={onMutated} />
      )}
      {modal?.type === 'track' && (
        <TrackStockModal listing={modal.listing} onClose={() => setModal(null)} onDone={onMutated} />
      )}
    </div>
  )
}

function InventoryRow({
  item,
  stale,
  onAction,
  onSettings,
  onHistory,
}: {
  item: InventoryItem
  // True while the list is being re-fetched after a change: the numbers shown
  // may be out of date, so stock actions wait for the fresh balance.
  stale: boolean
  onAction: (action: StockAction) => void
  onSettings: () => void
  onHistory: () => void
}) {
  return (
    <li className="px-4 py-3.5 sm:px-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <button type="button" onClick={onHistory} className="min-w-0 truncate text-left text-sm font-semibold hover:text-brandText hover:underline" title="View this product's stock history">
              {item.name}
            </button>
            {!item.is_active && <StatusBadge tone="neutral">Hidden</StatusBadge>}
          </div>
          <p className="mt-0.5 text-xs text-inkFaint">{thresholdSummary(item.low_stock_threshold)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums leading-tight">{formatQuantity(item.quantity, item.unit)}</p>
          <div className="mt-1"><StatusBadge tone={STATUS_TONE[item.stock_status]}>{STATUS_LABELS[item.stock_status]}</StatusBadge></div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => onAction('receive')} disabled={stale}>Receive</Button>
        <Button size="sm" variant="secondary" onClick={() => onAction('issue')} disabled={stale || item.quantity === 0} title={item.quantity === 0 ? 'Nothing in stock to issue' : undefined}>Issue</Button>
        <Button size="sm" variant="secondary" onClick={() => onAction('adjust')} disabled={stale}>Count / adjust</Button>
        <Button size="sm" variant="ghost" onClick={onHistory}>History</Button>
        <Button size="sm" variant="ghost" onClick={onSettings} disabled={stale}>Settings</Button>
        <ButtonLink size="sm" variant="ghost" href="/dashboard?tab=listings">Edit product</ButtonLink>
      </div>
    </li>
  )
}

// ── History ──────────────────────────────────────────────────────────────────────────────────────────────────
type HistoryState = { key: string; rows: InventoryMovement[]; hasMore: boolean; error: string | null }

function MovementHistory({
  businessId,
  filter,
  onClearFilter,
  reloadKey,
}: {
  businessId: string
  filter: { listingId: string; name: string } | null
  onClearFilter: () => void
  reloadKey: number
}) {
  const supabase = useState(() => createClient())[0]
  const [state, setState] = useState<HistoryState | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const key = `${filter?.listingId ?? 'all'}|${reloadKey}|${attempt}`

  useEffect(() => {
    let cancelled = false
    fetchMovements(supabase, { businessId, listingId: filter?.listingId ?? null, offset: 0 }).then((res) => {
      if (cancelled) return
      setMoreError(null)
      setState(
        res.ok
          ? { key, rows: res.data.rows, hasMore: res.data.hasMore, error: null }
          : { key, rows: [], hasMore: false, error: res.error }
      )
    })
    return () => { cancelled = true }
  }, [supabase, businessId, filter?.listingId, key])

  const loadMore = async () => {
    if (!state || loadingMore) return
    setLoadingMore(true)
    setMoreError(null)
    const res = await fetchMovements(supabase, { businessId, listingId: filter?.listingId ?? null, offset: state.rows.length })
    setLoadingMore(false)
    if (!res.ok) { setMoreError(res.error); return }
    setState((prev) =>
      prev && prev.key === key
        ? { ...prev, rows: [...prev.rows, ...res.data.rows.filter((r) => !prev.rows.some((p) => p.id === r.id))], hasMore: res.data.hasMore }
        : prev
    )
  }

  if (!state) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Loading history">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      </div>
    )
  }

  if (state.error) {
    return (
      <Notice kind="error" action={<Button size="sm" variant="secondary" onClick={() => setAttempt((n) => n + 1)}>Try again</Button>}>
        Couldn&apos;t load the stock history. {state.error}
      </Notice>
    )
  }

  return (
    <div className="space-y-3">
      {filter && (
        <p className="text-xs text-inkFaint">
          History for <span className="font-semibold text-inkMid">{filter.name}</span>.{' '}
          <button type="button" onClick={onClearFilter} className="font-semibold text-brandText hover:underline">Show all products</button>
        </p>
      )}

      {state.rows.length === 0 ? (
        <EmptyState
          icon={History}
          title="No stock movements yet"
          description="Every time you receive, issue or adjust stock it is recorded here, with the balance before and after."
        />
      ) : (
        <>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {state.rows.map((m) => (
              <li key={m.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0">
                  {!filter && <p className="truncate text-sm font-semibold">{m.product_name}</p>}
                  <p className={`${filter ? 'text-sm font-semibold' : 'text-xs text-inkMid'}`}>
                    {MOVEMENT_LABELS[m.movement_type]} · {reasonLabel(m.reason)}
                  </p>
                  {(m.reference || m.note) && (
                    <p className="mt-0.5 break-words text-xs text-inkFaint">
                      {m.reference && <span>Ref: {m.reference}</span>}
                      {m.reference && m.note && ' · '}
                      {m.note}
                    </p>
                  )}
                  <p className="mt-0.5 text-xs text-inkFaint">{formatDateTime(m.created_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-semibold tabular-nums ${m.quantity_change > 0 ? 'text-brandText' : 'text-danger'}`}>
                    {formatSignedChange(m.quantity_change)}
                  </p>
                  <p className="text-xs text-inkFaint tabular-nums">
                    {m.balance_before.toLocaleString('en-NG')} → {m.balance_after.toLocaleString('en-NG')}
                  </p>
                </div>
              </li>
            ))}
          </ul>
          {moreError && <Notice kind="error">{moreError}</Notice>}
          {state.hasMore && (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={loadMore} loading={loadingMore}>Show older</Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

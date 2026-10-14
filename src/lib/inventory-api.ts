// Inventory & Stock Management -- thin client for the database functions.
//
// Every stock change goes through a SECURITY DEFINER RPC that re-checks, in the
// database, that the signed-in user owns the product's business. The business
// is never sent for writes: only the product (listing) id. The browser has no
// INSERT/UPDATE/DELETE privilege on the inventory tables at all.
import type { createClient } from '@/lib/supabase/client'
import type { InventoryItem, InventoryMovement } from '@/types'
import { NETWORK_ERROR_MESSAGE, describeInventoryError, type RpcErrorLike } from '@/lib/inventory'

type Supabase = ReturnType<typeof createClient>

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string }

export interface InventorySummary {
  tracked: number
  in_stock: number
  low_stock: number
  out_of_stock: number
}

export interface UntrackedListing {
  id: string
  name: string
  is_active: boolean
}

export interface InventoryOverview {
  summary: InventorySummary
  items: InventoryItem[]
  total: number
  untracked: UntrackedListing[]
  untracked_total: number
  last_30_days: { received: number; issued: number; adjustments: number }
}

export interface MutationResult {
  movement_id: string | null
  quantity: number
  stock_status: string
  duplicate: boolean
}

export const OVERVIEW_PAGE_SIZE = 50
export const HISTORY_PAGE_SIZE = 25

function fail<T>(err: RpcErrorLike | null | undefined): ApiResult<T> {
  return { ok: false, error: describeInventoryError(err) }
}

async function rpc<T>(supabase: Supabase, fn: string, args: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const { data, error } = await supabase.rpc(fn, args)
    if (error || data === null || typeof data !== 'object') return fail(error)
    return { ok: true, data: data as T }
  } catch {
    return { ok: false, error: NETWORK_ERROR_MESSAGE }
  }
}

export function fetchInventoryOverview(
  supabase: Supabase,
  args: { businessId: string; status: string | null; search: string; offset: number; limit?: number }
) {
  return rpc<InventoryOverview>(supabase, 'get_inventory_overview', {
    p_business_id: args.businessId,
    p_status: args.status,
    p_search: args.search || null,
    p_limit: args.limit ?? OVERVIEW_PAGE_SIZE,
    p_offset: args.offset,
  })
}

export function enableTracking(
  supabase: Supabase,
  args: { listingId: string; openingQuantity: number; threshold: number | null; unit: string | null; key: string }
) {
  return rpc<MutationResult>(supabase, 'inventory_enable_tracking', {
    p_listing_id: args.listingId,
    p_opening_quantity: args.openingQuantity,
    p_low_stock_threshold: args.threshold,
    p_unit: args.unit,
    p_idempotency_key: args.key,
  })
}

export function receiveStock(
  supabase: Supabase,
  args: { listingId: string; quantity: number; reason: string; note: string | null; reference: string | null; key: string }
) {
  return rpc<MutationResult>(supabase, 'inventory_receive_stock', {
    p_listing_id: args.listingId,
    p_quantity: args.quantity,
    p_reason: args.reason,
    p_note: args.note,
    p_reference: args.reference,
    p_idempotency_key: args.key,
  })
}

export function issueStock(
  supabase: Supabase,
  args: { listingId: string; quantity: number; reason: string; note: string | null; key: string }
) {
  return rpc<MutationResult>(supabase, 'inventory_issue_stock', {
    p_listing_id: args.listingId,
    p_quantity: args.quantity,
    p_reason: args.reason,
    p_note: args.note,
    p_idempotency_key: args.key,
  })
}

export function adjustStock(
  supabase: Supabase,
  args: { listingId: string; newQuantity: number; expectedQuantity: number; reason: string; note: string | null; key: string }
) {
  return rpc<MutationResult>(supabase, 'inventory_adjust_stock', {
    p_listing_id: args.listingId,
    p_new_quantity: args.newQuantity,
    p_reason: args.reason,
    p_note: args.note,
    p_expected_quantity: args.expectedQuantity,
    p_idempotency_key: args.key,
  })
}

export function updateSettings(
  supabase: Supabase,
  args: { listingId: string; threshold: number | null; unit: string | null }
) {
  return rpc<MutationResult>(supabase, 'inventory_update_settings', {
    p_listing_id: args.listingId,
    p_low_stock_threshold: args.threshold,
    p_unit: args.unit,
  })
}

// History is a plain RLS-scoped read (owners only see their own business's rows).
export async function fetchMovements(
  supabase: Supabase,
  args: { businessId: string; listingId: string | null; offset: number }
): Promise<ApiResult<{ rows: InventoryMovement[]; hasMore: boolean }>> {
  try {
    let query = supabase
      .from('inventory_movements')
      .select('id, listing_id, product_name, movement_type, quantity_change, balance_before, balance_after, reason, note, reference, created_at')
      .eq('business_id', args.businessId)
    if (args.listingId) query = query.eq('listing_id', args.listingId)
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(args.offset, args.offset + HISTORY_PAGE_SIZE) // one extra row => "has more"
    if (error) return fail(error)
    const all = (data ?? []) as InventoryMovement[]
    return { ok: true, data: { rows: all.slice(0, HISTORY_PAGE_SIZE), hasMore: all.length > HISTORY_PAGE_SIZE } }
  } catch {
    return { ok: false, error: 'Could not reach the server. Check your connection and try again.' }
  }
}

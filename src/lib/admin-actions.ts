// Admin writes that go through database functions (see migrations
// 20261015120000_admin_set_business_verified and 20261016100000_admin_delete_business).
//
// Why this exists: `businesses` has owner-only UPDATE/DELETE policies, so an
// admin's direct write used to match ZERO rows with NO error, while the admin
// page updated its own screen as if it had worked. These helpers make "the
// database confirmed it" the only way to get a success result, and turn
// everything else (RPC error, missing function, empty or mismatched response)
// into a message for the admin. Pure and dependency-free so it can be tested
// without a browser or a database.

export interface RpcError { message: string }
export type RpcCall = (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>

export type ActionResult<T> = { ok: true; data: T } | { ok: false; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// PostgREST says this when a migration hasn't been applied yet (new deploy, old
// database). Say so plainly instead of showing a cryptic schema-cache message.
function explain(error: RpcError): string {
  return /could not find the function|schema cache/i.test(error.message)
    ? 'the database update for this action has not been applied yet'
    : error.message
}

export interface VerifiedRow {
  is_verified: boolean
  trust_score?: number
  trust_signals?: unknown
}

export async function adminSetBusinessVerified(
  call: RpcCall,
  businessId: string,
  verified: boolean
): Promise<ActionResult<VerifiedRow>> {
  const verb = verified ? 'verify' : 'remove verification from'
  let res: Awaited<ReturnType<RpcCall>>
  try {
    res = await call('admin_set_business_verified', { p_business_id: businessId, p_verified: verified })
  } catch {
    return { ok: false, message: `Couldn't ${verb} this business: network error. Nothing was changed.` }
  }
  if (res.error) return { ok: false, message: `Couldn't ${verb} this business: ${explain(res.error)}. Nothing was changed.` }
  // The function returns what is actually stored; anything else means the write
  // did not land as asked.
  if (!isRecord(res.data) || res.data.is_verified !== verified) {
    return { ok: false, message: `Couldn't ${verb} this business: the database did not confirm the change. Nothing was changed.` }
  }
  return {
    ok: true,
    data: {
      is_verified: res.data.is_verified,
      trust_score: typeof res.data.trust_score === 'number' ? res.data.trust_score : undefined,
      trust_signals: res.data.trust_signals ?? undefined,
    },
  }
}

export async function adminDeleteBusiness(
  call: RpcCall,
  businessId: string
): Promise<ActionResult<{ id: string; business_name: string | null }>> {
  let res: Awaited<ReturnType<RpcCall>>
  try {
    res = await call('admin_delete_business', { p_business_id: businessId })
  } catch {
    return { ok: false, message: "Couldn't delete this business: network error. Nothing was deleted." }
  }
  if (res.error) return { ok: false, message: `Couldn't delete this business: ${explain(res.error)}. Nothing was deleted.` }
  // Success only if the database reports deleting exactly the row we asked for.
  if (!isRecord(res.data) || res.data.id !== businessId) {
    return { ok: false, message: "Couldn't delete this business: the database did not confirm the deletion. Nothing was removed from the list." }
  }
  return {
    ok: true,
    data: { id: businessId, business_name: typeof res.data.business_name === 'string' ? res.data.business_name : null },
  }
}

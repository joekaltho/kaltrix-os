// Admin "delete business": the database delete plus cleanup of the business's logo
// file. All collaborators are injected so the safety rules are unit- and
// integration-testable without a browser or a storage server.
//
// Order is the whole point:
//   1. read what we'll need to clean up (owner id + logo url),
//   2. delete the business through the admin-only database function (the database
//      decides who is allowed; non-admins stop here with 403),
//   3. ONLY IF that confirmed, remove the logo file.
// So a failed or refused delete never touches storage, and a failed storage
// cleanup never un-does or hides a successful delete (it is reported instead).
export type LogoOutcome = 'removed' | 'none' | 'skipped' | 'failed'

export interface DeleteBusinessDeps {
  readBusiness: (id: string) => Promise<{ user_id: string | null; logo_url: string | null } | null>
  callDelete: (id: string) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>
  // Does any remaining business still point at this exact logo url?
  logoStillReferenced: (logoUrl: string) => Promise<boolean>
  removeLogo: (name: string) => Promise<{ removed: boolean; error: string | null }>
  // From logo-storage.ts (bound to this project's storage origin): the object name
  // if and only if the url is the deleted owner's own logo file, else null.
  logoNameFor: (logoUrl: string, ownerUserId: string | null) => string | null
}

export type DeleteBusinessResult =
  | { ok: true; id: string; business_name: string | null; logo: LogoOutcome }
  | { ok: false; status: 403 | 404 | 500; message: string }

export async function deleteBusinessAndLogo(id: string, deps: DeleteBusinessDeps): Promise<DeleteBusinessResult> {
  let before: Awaited<ReturnType<DeleteBusinessDeps['readBusiness']>> = null
  try {
    before = await deps.readBusiness(id)
  } catch {
    // Not fatal for the delete itself; we just won't be able to clean the logo up.
    before = null
  }

  let res: Awaited<ReturnType<DeleteBusinessDeps['callDelete']>>
  try {
    res = await deps.callDelete(id)
  } catch {
    return { ok: false, status: 500, message: 'Database error' }
  }

  if (res.error) {
    const { code, message } = res.error
    if (code === '42501' || /^forbidden$/i.test(message)) return { ok: false, status: 403, message: 'Admins only' }
    if (code === 'P0002' || /business not found/i.test(message)) return { ok: false, status: 404, message: 'business not found' }
    // Surface "migration not applied yet" to the admin; keep other DB errors generic.
    const known = /could not find the function|schema cache/i.test(message)
    return { ok: false, status: 500, message: known ? message : 'Database error' }
  }

  const data = res.data
  if (typeof data !== 'object' || data === null || (data as { id?: unknown }).id !== id) {
    return { ok: false, status: 500, message: 'The database did not confirm the deletion' }
  }
  const business_name = typeof (data as { business_name?: unknown }).business_name === 'string'
    ? (data as { business_name: string }).business_name
    : null

  return { ok: true, id, business_name, logo: await cleanUpLogo(before, deps) }
}

async function cleanUpLogo(
  before: { user_id: string | null; logo_url: string | null } | null,
  deps: DeleteBusinessDeps
): Promise<LogoOutcome> {
  if (!before?.logo_url) return 'none'
  const name = deps.logoNameFor(before.logo_url, before.user_id)
  if (!name) return 'skipped' // a url that isn't this owner's own logo file: never delete it

  try {
    if (await deps.logoStillReferenced(before.logo_url)) return 'skipped'
  } catch {
    return 'skipped' // can't prove it's unshared: leave the file rather than risk deleting someone's logo
  }

  try {
    const r = await deps.removeLogo(name)
    if (r.error) return 'failed'
    return r.removed ? 'removed' : 'none'
  } catch {
    return 'failed'
  }
}

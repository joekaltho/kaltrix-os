// Which Storage object (if any) a business's logo_url refers to, and is it safe to
// delete when that business is deleted?
//
// logo_url is a free-text column the OWNER can write, so it must never be trusted
// as a delete target on its own: a business could point it at someone else's file.
// The app names every logo `<owner user id>-<timestamp>.<ext>` in the public
// `logos` bucket, so we only ever delete an object that
//   * lives on THIS project's storage origin, in the logos bucket,
//   * is a single flat file name (no folders, no traversal), and
//   * is named after the deleted business's own owner.
// Anything else returns null = "not ours, leave it alone".

export const LOGO_BUCKET = 'logos'
const PUBLIC_PATH = `/storage/v1/object/public/${LOGO_BUCKET}/`
const FILE_SUFFIX = /^\d{10,16}\.[A-Za-z0-9]{1,10}$/

export function logoObjectName(
  logoUrl: string | null | undefined,
  ownerUserId: string | null | undefined,
  supabaseUrl: string | null | undefined
): string | null {
  if (!logoUrl || !ownerUserId || !supabaseUrl) return null
  let url: URL
  let base: URL
  try {
    url = new URL(logoUrl)
    base = new URL(supabaseUrl)
  } catch {
    return null
  }
  if (url.origin !== base.origin || url.search || url.hash) return null
  if (!url.pathname.startsWith(PUBLIC_PATH)) return null

  let name: string
  try {
    name = decodeURIComponent(url.pathname.slice(PUBLIC_PATH.length))
  } catch {
    return null
  }
  if (!name || name.includes('/') || name.includes('\\') || name.includes('..')) return null

  const prefix = `${ownerUserId.toLowerCase()}-`
  if (!name.toLowerCase().startsWith(prefix)) return null
  if (!FILE_SUFFIX.test(name.slice(prefix.length))) return null
  return name
}

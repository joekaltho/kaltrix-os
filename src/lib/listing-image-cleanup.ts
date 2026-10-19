// When an admin deletes a business its listings cascade away, but the image files
// those listings uploaded would stay behind in Storage. This removes them.
//
// Same safety posture as the logo cleanup: collaborators are injected so the rules
// are unit-testable, only files under THIS owner's own `<owner>/<business>/` folder
// are ever considered, and a file that any remaining listing still points at is
// kept. It is best-effort and must never turn a successful delete into a failure.

export type ListingImagesOutcome = 'removed' | 'none' | 'skipped' | 'failed'

export interface ListingImageCleanupDeps {
  // File names directly inside the business's folder.
  listFiles: (folder: string) => Promise<string[]>
  publicUrlFor: (objectPath: string) => string
  // Of these URLs, which are still referenced by some listing?
  referencedUrls: (urls: string[]) => Promise<string[]>
  removeFiles: (objectPaths: string[]) => Promise<{ error: string | null }>
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i

export async function cleanUpBusinessListingImages(
  ownerUserId: string | null | undefined,
  businessId: string,
  deps: ListingImageCleanupDeps
): Promise<ListingImagesOutcome> {
  if (!ownerUserId || !UUID.test(ownerUserId) || !UUID.test(businessId)) return 'skipped'
  const folder = `${ownerUserId.toLowerCase()}/${businessId.toLowerCase()}`

  try {
    const names = (await deps.listFiles(folder)).filter((n) => FILE.test(n))
    if (names.length === 0) return 'none'

    const paths = names.map((n) => `${folder}/${n}`)
    const inUse = new Set(await deps.referencedUrls(paths.map((p) => deps.publicUrlFor(p))))
    const removable = paths.filter((p) => !inUse.has(deps.publicUrlFor(p)))
    if (removable.length === 0) return 'skipped'

    const { error } = await deps.removeFiles(removable)
    if (error) return 'failed'
    return removable.length < paths.length ? 'skipped' : 'removed'
  } catch {
    return 'failed'
  }
}

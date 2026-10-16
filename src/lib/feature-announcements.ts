// "NEW" badges and first-visit introductions for features existing users might
// not have noticed. Pure helpers (no React) so the rules are unit-testable;
// the hook that applies them lives in use-announcement.ts.
//
// Rules, in one place:
//   * A badge is shown only until the user opens the feature once, or until the
//     announcement expires (so "NEW" never becomes permanent wallpaper).
//   * The intro card is shown on the first visit until it is dismissed.
//   * State is per browser and per business (localStorage). Nothing is sent to
//     the server; the worst case of cleared storage is seeing the badge again.

export interface Announcement {
  id: string
  // ISO date after which neither the badge nor the intro is shown. Inventory
  // shipped Oct 14 2026; two months is long enough for people who log in
  // occasionally to see it, short enough not to linger.
  expiresAt: string
}

export const INVENTORY_ANNOUNCEMENT: Announcement = {
  id: 'inventory',
  expiresAt: '2026-12-15T00:00:00Z',
}

export function isAnnouncementLive(announcement: Announcement, now: number = Date.now()): boolean {
  const expires = Date.parse(announcement.expiresAt)
  return Number.isFinite(expires) && now < expires
}

export type AnnouncementFlag = 'seen' | 'intro-dismissed'

export function announcementKey(id: string, flag: AnnouncementFlag, ownerId: string): string {
  return `kx:ann:${id}:${flag}:${ownerId}`
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

// Storage can be missing or throw (private mode, blocked cookies): treat that as
// "not seen" on read and carry on silently on write.
export function readFlag(storage: ReadableStorage | null | undefined, key: string): boolean {
  try {
    return storage?.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeFlag(storage: WritableStorage | null | undefined, key: string): void {
  try {
    storage?.setItem(key, '1')
  } catch {
    // ignore
  }
}

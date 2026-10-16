'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  announcementKey,
  isAnnouncementLive,
  readFlag,
  writeFlag,
  type Announcement,
} from '@/lib/feature-announcements'

const CHANGE_EVENT = 'kx:announcement-change'

// If localStorage is blocked the flags still hold for this page session.
const memoryFlags = new Set<string>()

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

const hasFlag = (key: string) => memoryFlags.has(key) || readFlag(browserStorage(), key)

function setFlag(key: string) {
  memoryFlags.add(key)
  writeFlag(browserStorage(), key)
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onChange) // another tab changed it
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

// Drives a NEW badge + first-visit intro for one announcement. Nothing shows on
// the server render or without an owner id (business not loaded yet), so a user
// who already dismissed it never sees a flash of the badge.
export function useAnnouncement(announcement: Announcement, ownerId: string | null | undefined) {
  const { id } = announcement
  const seenKey = ownerId ? announcementKey(id, 'seen', ownerId) : null
  const introKey = ownerId ? announcementKey(id, 'intro-dismissed', ownerId) : null

  // A primitive snapshot ("<seen><introDismissed>" or "none") so React can
  // compare it cheaply and only re-render when something actually changed.
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (seenKey && introKey ? `${hasFlag(seenKey) ? 1 : 0}${hasFlag(introKey) ? 1 : 0}` : 'none'),
    () => 'none'
  )

  const markSeen = useCallback(() => { if (seenKey) setFlag(seenKey) }, [seenKey])
  const dismissIntro = useCallback(() => { if (introKey) setFlag(introKey) }, [introKey])

  const ready = snapshot !== 'none'
  const live = isAnnouncementLive(announcement)
  return {
    showBadge: ready && live && snapshot[0] === '0',
    showIntro: ready && live && snapshot[1] === '0',
    markSeen,
    dismissIntro,
  }
}

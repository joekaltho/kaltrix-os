'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  NOTIFICATION_COLUMNS,
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_POLL_MS,
  applyLocalReads,
  type AppNotification,
} from '@/lib/notifications'

export type NotificationsState = ReturnType<typeof useNotifications>

// Loads the owner's latest notifications + unread count, refreshes every minute
// while the tab is visible and whenever it regains focus, and lets the owner
// mark items read. All access is through the owner-only RLS policies on
// public.notifications (select + update of read_at); the browser can't create,
// edit or delete notifications.
export function useNotifications(businessId: string | null | undefined) {
  const supabase = useState(() => createClient())[0]
  const [items, setItems] = useState<AppNotification[]>([])
  const [unread, setUnread] = useState(0)
  const [status, setStatus] = useState<'idle' | 'ready' | 'error'>('idle')
  // Ids the user marked read that a stale in-flight fetch might still report as unread.
  const locallyRead = useRef<Set<string>>(new Set())
  const requestId = useRef(0)

  const refresh = useCallback(async () => {
    if (!businessId) return
    const mine = ++requestId.current
    const [list, count] = await Promise.all([
      supabase
        .from('notifications')
        .select(NOTIFICATION_COLUMNS)
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(NOTIFICATION_PAGE_SIZE),
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('read_at', null),
    ])
    if (mine !== requestId.current) return // a newer refresh superseded this one
    if (list.error || count.error) {
      setStatus((s) => (s === 'ready' ? s : 'error')) // keep showing what we have on a transient failure
      return
    }
    const rows = (list.data ?? []) as AppNotification[]
    // Items the user just marked read that this (possibly slightly stale) fetch
    // still reports unread: keep them read on screen and out of the count.
    const pending = rows.filter((n) => !n.read_at && locallyRead.current.has(n.id)).length
    setItems(applyLocalReads(rows, locallyRead.current))
    setUnread(Math.max(0, (count.count ?? 0) - pending))
    setStatus('ready')
    // Whatever the server already reports as read no longer needs protecting.
    for (const n of rows) if (n.read_at) locallyRead.current.delete(n.id)
  }, [supabase, businessId])

  useEffect(() => {
    if (!businessId) return
    // Deferred a tick so the first load isn't a synchronous state update inside
    // the effect body; later refreshes run from timers/events.
    const first = setTimeout(() => void refresh(), 0)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, NOTIFICATION_POLL_MS)
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [businessId, refresh])

  const markRead = useCallback(
    async (id: string) => {
      const target = items.find((n) => n.id === id)
      if (!target || target.read_at) return
      locallyRead.current.add(id)
      setItems((list) => list.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)))
      setUnread((n) => Math.max(0, n - 1))
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .is('read_at', null)
      // On success the id stays protected until a refresh sees the server agree
      // (a fetch that started before this write could otherwise flicker it back).
      if (error) {
        locallyRead.current.delete(id)
        void refresh() // roll back to the server's truth
      }
    },
    [items, supabase, refresh]
  )

  const markAllRead = useCallback(async () => {
    if (!businessId) return
    const stamp = new Date().toISOString()
    for (const n of items) if (!n.read_at) locallyRead.current.add(n.id)
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: stamp })))
    setUnread(0)
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: stamp })
      .eq('business_id', businessId)
      .is('read_at', null)
    if (error) {
      locallyRead.current.clear()
      void refresh()
    }
  }, [businessId, items, supabase, refresh])

  return { items, unread, status, refresh, markRead, markAllRead }
}

'use client'

import { Inbox } from 'lucide-react'
import type { Message } from '@/types'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

export default function InboxPanel({ messages, onMarkRead }: { messages: Message[]; onMarkRead: (id: string) => void }) {
  if (messages.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="No messages yet"
        description="When customers message you from your public page, they'll show up here."
      />
    )
  }

  return (
    <ul className="space-y-3">
      {messages.map((msg) => (
        <li
          key={msg.id}
          className={`rounded-xl border p-4 sm:p-5 ${msg.is_read ? 'border-border bg-surface' : 'border-brand/30 bg-brandBg/40'}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-ivoryDim text-xs font-bold text-inkMid">
                {msg.sender_name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className={`truncate text-sm ${msg.is_read ? 'font-medium' : 'font-semibold'}`}>{msg.sender_name}</p>
                {msg.sender_phone && (
                  <a href={`tel:${msg.sender_phone}`} className="text-xs text-inkFaint hover:text-brandText hover:underline">
                    {msg.sender_phone}
                  </a>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {!msg.is_read && <span className="h-2 w-2 rounded-full bg-brandDim" aria-label="Unread" />}
              <time className="text-xs text-inkFaint" dateTime={msg.created_at}>{formatDate(msg.created_at)}</time>
            </div>
          </div>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-inkMid">{msg.content}</p>
          {!msg.is_read && (
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={() => onMarkRead(msg.id)}>Mark as read</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

'use client'

import { CalendarDays } from 'lucide-react'
import type { Booking } from '@/types'
import { formatDateTime } from '@/lib/format'
import { Button, ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import { StatusBadge, bookingTone } from '@/components/ui/StatusBadge'

export default function BookingsPanel({
  bookings,
  onStatus,
}: {
  bookings: Booking[]
  onStatus: (id: string, status: Booking['status']) => void
}) {
  if (bookings.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No bookings yet"
        description="Add appointments here and confirm or complete them as they happen."
        action={<ButtonLink href="/dashboard/bookings/new" variant="primary">Create your first booking</ButtonLink>}
      />
    )
  }

  return (
    <ul className="space-y-3">
      {bookings.map((booking) => (
        <li key={booking.id} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold">{booking.customer_name ?? '—'}</p>
              <p className="text-sm text-inkMid">{booking.service_description ?? '—'}</p>
              <p className="mt-1 text-xs text-inkFaint">
                {booking.booking_date_time ? formatDateTime(booking.booking_date_time) : 'No date set'}
                {booking.customer_phone && (
                  <>
                    {' · '}
                    <a href={`tel:${booking.customer_phone}`} className="hover:text-brandText hover:underline">{booking.customer_phone}</a>
                  </>
                )}
              </p>
              {booking.notes && <p className="mt-1.5 text-xs italic text-inkFaint">{booking.notes}</p>}
            </div>
            <StatusBadge tone={bookingTone(booking.status)}>{booking.status ?? 'pending'}</StatusBadge>
          </div>

          {(booking.status === 'pending' || booking.status === 'confirmed') && (
            <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
              {booking.status === 'pending' ? (
                <Button size="sm" variant="secondary" onClick={() => onStatus(booking.id, 'confirmed')}>Confirm</Button>
              ) : (
                <Button size="sm" variant="secondary" onClick={() => onStatus(booking.id, 'completed')}>Mark complete</Button>
              )}
              <Button size="sm" variant="danger" onClick={() => onStatus(booking.id, 'cancelled')}>Cancel booking</Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

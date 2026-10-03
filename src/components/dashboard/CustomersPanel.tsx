'use client'

import { Users } from 'lucide-react'
import type { Customer } from '@/types'
import { formatDate } from '@/lib/format'
import { ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

export default function CustomersPanel({ customers }: { customers: Customer[] }) {
  if (customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No customers yet"
        description="Save the people you work with so their details are always one tap away."
        action={<ButtonLink href="/dashboard/customers/new" variant="primary">Add your first customer</ButtonLink>}
      />
    )
  }

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
      {customers.map((customer) => (
        <li key={customer.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-ivoryDim text-xs font-bold text-inkMid">
              {customer.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{customer.name}</p>
              <p className="truncate text-xs text-inkFaint">
                {customer.phone && <a href={`tel:${customer.phone}`} className="hover:text-brandText hover:underline">{customer.phone}</a>}
                {customer.phone && customer.email && ' · '}
                {customer.email && <a href={`mailto:${customer.email}`} className="hover:text-brandText hover:underline">{customer.email}</a>}
                {!customer.phone && !customer.email && 'No contact details'}
              </p>
            </div>
          </div>
          <p className="shrink-0 text-xs text-inkFaint">Added {formatDate(customer.created_at)}</p>
        </li>
      ))}
    </ul>
  )
}

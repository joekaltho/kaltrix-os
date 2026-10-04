'use client'

import { FileText } from 'lucide-react'
import type { Invoice } from '@/types'
import { daysUntil, formatDate, formatNaira, siteOrigin } from '@/lib/format'
import { Button, ButtonLink } from '@/components/ui/Button'
import CopyLinkButton from '@/components/CopyLinkButton'
import EmptyState from '@/components/ui/EmptyState'
import Notice from '@/components/ui/Notice'
import { StatusBadge, invoiceTone } from '@/components/ui/StatusBadge'

const copyClass =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink transition-colors hover:bg-ivoryDim'

export default function InvoicesPanel({
  invoices,
  paymentReady,
  onStatus,
}: {
  invoices: Invoice[]
  // false => the business hasn't set up any payment details yet
  paymentReady: boolean
  onStatus: (id: string, status: Invoice['status']) => void
}) {
  const outstanding = invoices.filter((i) => i.status !== 'paid').reduce((s, i) => s + i.total, 0)
  const paid = invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + i.total, 0)

  return (
    <div className="space-y-4">
      {!paymentReady && (
        <Notice
          kind="warn"
          action={<ButtonLink href="/dashboard/profile#payment" size="sm" variant="secondary">Add details</ButtonLink>}
        >
          Customers can&apos;t see how to pay you yet. Add your bank details once and they&apos;ll appear on every invoice.
        </Notice>
      )}

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create an invoice, then send the customer a link to view and pay it."
          action={<ButtonLink href="/dashboard/invoices/new" variant="primary">Create your first invoice</ButtonLink>}
        />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <dt className="text-xs font-medium text-inkFaint">Outstanding</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatNaira(outstanding)}</dd>
            </div>
            <div className="rounded-xl border border-border bg-surface px-4 py-3">
              <dt className="text-xs font-medium text-inkFaint">Paid</dt>
              <dd className="mt-1 text-lg font-semibold tabular-nums">{formatNaira(paid)}</dd>
            </div>
          </dl>

          <ul className="space-y-3">
            {invoices.map((invoice) => {
              const open = invoice.status !== 'paid'
              const pastDue = invoice.status === 'unpaid' && !!invoice.due_date && daysUntil(invoice.due_date) < 0
              return (
                <li key={invoice.id} className="rounded-xl border border-border bg-surface p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{invoice.customer_name}</p>
                      <p className="mt-0.5 text-xs text-inkFaint">
                        {invoice.customer_phone ? `${invoice.customer_phone} · ` : ''}Issued {formatDate(invoice.created_at)}
                        {invoice.due_date && (
                          <span className={pastDue ? 'text-danger' : ''}> · Due {formatDate(invoice.due_date)}{pastDue && ' (past due)'}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <p className="font-semibold tabular-nums">{formatNaira(invoice.total)}</p>
                      <StatusBadge tone={invoiceTone(invoice.status)}>{invoice.status}</StatusBadge>
                    </div>
                  </div>

                  <details className="group mt-3">
                    <summary className="cursor-pointer list-none text-xs text-inkFaint hover:text-ink [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Show {invoice.items.length} item{invoice.items.length === 1 ? '' : 's'}</span>
                      <span className="hidden group-open:inline">Hide items</span>
                    </summary>
                    <ul className="mt-2 space-y-1 rounded-lg bg-ivory p-3 text-xs">
                      {invoice.items.map((item, index) => (
                        <li key={index} className="flex justify-between gap-3">
                          <span className="text-inkMid">{item.name} × {item.quantity}</span>
                          <span className="font-medium tabular-nums text-inkMid">{formatNaira(item.quantity * item.price)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                    <CopyLinkButton
                      url={`${siteOrigin()}/invoice/${invoice.id}`}
                      label="Copy link"
                      copiedLabel="Link copied"
                      className={copyClass}
                    />
                    <ButtonLink href={`/invoice/${invoice.id}`} target="_blank" size="sm" variant="ghost">View</ButtonLink>
                    {open && <Button size="sm" variant="secondary" onClick={() => onStatus(invoice.id, 'paid')}>Mark as paid</Button>}
                    {invoice.status === 'unpaid' && (
                      <Button size="sm" variant="danger" onClick={() => onStatus(invoice.id, 'overdue')}>Mark overdue</Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}

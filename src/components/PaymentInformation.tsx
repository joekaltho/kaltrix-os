import type { ReactNode } from 'react'
import CopyLinkButton from '@/components/CopyLinkButton'
import { hasBankDetails, type BankFields } from '@/lib/payment'

// The "Payment information" block shown on invoices — and, identically, as the
// live preview in Business settings, so what the owner sees is what customers get.
// Presentational only (no hooks) so the invoice Server Component can render it.
export default function PaymentInformation({
  bank,
  instructions,
  fallback,
}: {
  bank?: Partial<BankFields> | null
  instructions?: string | null
  // Shown (under the same heading) when the business hasn't set anything up.
  fallback?: ReactNode
}) {
  const showBank = hasBankDetails(bank)
  const text = instructions?.trim()
  if (!showBank && !text && !fallback) return null

  return (
    <section aria-labelledby="payment-information" className="rounded-xl border border-border bg-ivory p-4 sm:p-5">
      <h2 id="payment-information" className="text-sm font-semibold text-ink">Payment information</h2>

      {showBank && (
        <dl className="mt-3 space-y-2.5 text-sm">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-inkFaint">Bank</dt>
            <dd className="text-right font-medium text-ink">{bank.bank_name}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-inkFaint">Account name</dt>
            <dd className="text-right font-medium text-ink">{bank.account_name}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-inkFaint">Account number</dt>
            <dd className="flex items-center gap-2">
              <span className="font-mono text-base font-semibold tracking-wider text-ink tabular-nums">
                {bank.account_number}
              </span>
              <CopyLinkButton
                url={bank.account_number}
                label="Copy"
                copiedLabel="Copied"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-inkMid transition hover:bg-ivoryDim"
              />
            </dd>
          </div>
        </dl>
      )}

      {!showBank && !text && <p className="mt-2 text-sm text-inkMid">{fallback}</p>}

      {text && (
        <p className={`whitespace-pre-line text-sm text-inkMid ${showBank ? 'mt-3 border-t border-border pt-3' : 'mt-2'}`}>
          {text}
        </p>
      )}
    </section>
  )
}

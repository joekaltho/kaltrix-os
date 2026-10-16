'use client'

import { Package, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

// First-visit introduction for Inventory. Says only what the feature does today
// (see docs/INVENTORY.md) and goes away for good once dismissed.
export default function InventoryIntro({ onDismiss }: { onDismiss: () => void }) {
  return (
    <section
      aria-labelledby="inventory-intro-title"
      className="relative rounded-xl border border-brand/25 bg-brandBg px-5 py-4"
    >
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss introduction"
        className="absolute right-3 top-3 rounded p-0.5 text-inkFaint hover:text-ink"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
      <div className="flex items-start gap-3 pr-6">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-brandText">
          <Package className="h-[18px] w-[18px]" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 id="inventory-intro-title" className="text-sm font-semibold text-ink">New: track your stock</h2>
          <p className="mt-1 text-sm text-inkMid">
            Keep count of the products in your Shop. Turn on tracking for a product, record stock coming in and
            going out, and set a low-stock level to see when it&apos;s time to restock. Every change is kept in a
            history you can look back at.
          </p>
          <p className="mt-1 text-xs text-inkFaint">
            Tracking is optional per product, so services and anything you don&apos;t count can stay as they are.
          </p>
          <div className="mt-3">
            <Button size="sm" variant="secondary" onClick={onDismiss}>Got it</Button>
          </div>
        </div>
      </div>
    </section>
  )
}

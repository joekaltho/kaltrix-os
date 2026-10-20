import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton'

const card = 'rounded-xl border border-border bg-surface'

// Loading state for one dashboard tab's content area (the page header above it is
// already real). One skeleton per layout family, used both while a tab's code is being
// downloaded and while its data is loading, so there is a single continuous loading
// state instead of a blank gap followed by a spinner.
//   cards  - Listings: two-column grid of image cards
//   stats  - Inventory / Business Pulse: a row of numbers, then a list or chart
export default function PanelSkeleton({ variant, label }: { variant: 'cards' | 'stats'; label: string }) {
  if (variant === 'cards') {
    return (
      <SkeletonRegion label={label} className="space-y-4">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
              <Skeleton className="aspect-video w-full rounded-none" />
              <div className="p-4">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="mt-2 h-4 w-16" />
                <Skeleton className="mt-2 h-3 w-full" />
                <div className="mt-3 flex gap-2 border-t border-border pt-3">
                  <Skeleton className="h-8 flex-1 rounded-lg" />
                  <Skeleton className="h-8 flex-1 rounded-lg" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SkeletonRegion>
    )
  }

  return (
    <SkeletonRegion label={label} className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${card} p-4`}>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-3 h-7 w-20" />
          </div>
        ))}
      </div>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
        {[0, 1, 2, 3, 4].map((i) => (
          <li key={i} className="flex items-center gap-3 px-4 py-3.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40 max-w-[60%]" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </li>
        ))}
      </ul>
    </SkeletonRegion>
  )
}

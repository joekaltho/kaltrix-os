import Logo from '@/components/Logo'
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton'

// Loading state for the stand-alone form screens (new booking / customer / invoice /
// listing, business settings). Mirrors FormPage's frame exactly -- same header bar,
// same max-width and padding, same back link / title rhythm, same section cards and
// 44px fields -- so when the real form replaces it nothing jumps.
// frame="classic" matches the older single-card layout the Add Listing page still uses
// (its own nav bar and roomier body), so that page doesn't shift either.
export default function FormPageSkeleton({
  sections = 2,
  fieldsPerSection = 3,
  frame = 'form',
}: { sections?: number; fieldsPerSection?: number; frame?: 'form' | 'classic' }) {
  if (frame === 'classic') {
    return (
      <SkeletonRegion label="Loading" className="min-h-screen bg-ivory font-sans text-ink">
        <nav className="glass sticky top-0 z-20 border-b border-border shadow-card">
          <div className="mx-auto flex h-14 max-w-2xl items-center justify-between px-4 sm:px-6">
            <Logo size="md" />
            <Skeleton className="h-4 w-20" />
          </div>
        </nav>
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="mb-8">
            <Skeleton className="h-8 w-44" />
            <Skeleton className="mt-2 h-5 w-72 max-w-full" />
          </div>
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
            <Skeleton className="h-4 w-32" />
            {[0, 1].map((i) => (
              <div key={i}>
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-11 w-full rounded-lg" />
              </div>
            ))}
            <div className="flex items-center gap-4">
              <Skeleton className="h-24 w-24 shrink-0 rounded-xl sm:h-28 sm:w-28" />
              <Skeleton className="h-9 w-32 rounded-lg" />
            </div>
            <div>
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="h-[72px] w-full rounded-lg" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
      </SkeletonRegion>
    )
  }

  return (
    <SkeletonRegion label="Loading" className="min-h-screen bg-ivory font-sans text-ink">
      <header className="glass sticky top-0 z-20 border-b border-border">
        <div className="mx-auto flex h-14 max-w-2xl items-center px-4 sm:px-6">
          <Logo size="md" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <Skeleton className="mb-4 h-5 w-24" />
        <div className="mb-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="mt-2 h-5 w-72 max-w-full" />
        </div>

        <div className="space-y-5">
          {Array.from({ length: sections }, (_, s) => (
            <section key={s} className="rounded-xl border border-border bg-surface p-5 sm:p-6">
              <Skeleton className="mb-5 h-4 w-36" />
              <div className="space-y-4">
                {Array.from({ length: fieldsPerSection }, (_, f) => (
                  <div key={f}>
                    <Skeleton className="mb-2 h-4 w-28" />
                    <Skeleton className="h-11 w-full rounded-lg" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    </SkeletonRegion>
  )
}

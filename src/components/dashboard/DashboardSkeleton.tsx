import Logo from '@/components/Logo'
import { Skeleton, SkeletonRegion } from '@/components/ui/Skeleton'

const card = 'rounded-xl border border-border bg-surface'

// First-paint stand-in for the dashboard. It reproduces the real shell -- the 240px
// desktop sidebar (logo row, business card, nav groups, footer), the mobile top bar and
// bottom nav, and Overview's setup / needs-attention / three-number layout -- at the real
// sizes, so the page can fill in without moving. It is also what the statically
// prerendered HTML contains, so it is on screen before any JavaScript has run.
// (The logo is real and static; everything that depends on the signed-in user is a block.)

function NavRows({ rows }: { rows: number }) {
  return (
    <div className="space-y-0.5">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2">
          <Skeleton className="h-[18px] w-[18px] shrink-0" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  )
}

export default function DashboardSkeleton() {
  return (
    <SkeletonRegion label="Loading your dashboard" className="min-h-screen bg-ivory text-ink font-sans flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface border-r border-border h-screen sticky top-0 overflow-hidden">
        <div className="flex h-full w-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-3.5">
            <Logo size="md" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
          <div className="shrink-0 border-b border-border px-4 py-3.5">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-9 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
          </div>
          <div className="flex-1 space-y-5 overflow-hidden px-3 py-4">
            <NavRows rows={2} />
            <div><Skeleton className="mb-2 ml-3 h-3 w-14" /><NavRows rows={3} /></div>
            <div><Skeleton className="mb-2 ml-3 h-3 w-14" /><NavRows rows={2} /></div>
            <div><Skeleton className="mb-2 ml-3 h-3 w-16" /><NavRows rows={3} /></div>
          </div>
          <div className="shrink-0 border-t border-border px-4 py-3">
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 glass border-b border-border px-4 h-12 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-8 max-w-4xl w-full mx-auto">
          {/* PageHeader: title, description, primary action */}
          <div className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            <div>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="mt-1.5 h-5 w-44" />
            </div>
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>

          <div className="space-y-6">
            {/* Finish setting up */}
            <section className={`${card} p-5`}>
              <div className="flex items-baseline justify-between gap-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
              <div className="mt-3 divide-y divide-border">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 py-2.5">
                    <Skeleton className="h-[18px] w-[18px] shrink-0 rounded-full" />
                    <Skeleton className="h-4 w-48 max-w-[70%]" />
                  </div>
                ))}
              </div>
            </section>

            {/* Needs attention */}
            <section className={card}>
              <div className="border-b border-border px-5 py-3"><Skeleton className="h-4 w-32" /></div>
              <div className="divide-y divide-border">
                {[0, 1].map((i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3">
                    <Skeleton className="h-8 w-8 shrink-0 rounded-lg" />
                    <Skeleton className="h-4 w-56 max-w-[70%]" />
                  </div>
                ))}
              </div>
            </section>

            {/* The numbers */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className={`${card} p-4 ${i === 2 ? 'col-span-2 sm:col-span-1' : ''}`}>
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-3 h-7 w-24" />
                  <Skeleton className="mt-2 h-3 w-28" />
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav aria-hidden className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5">
            <Skeleton className="h-5 w-5" />
            <Skeleton className="h-2.5 w-9" />
          </div>
        ))}
      </nav>
    </SkeletonRegion>
  )
}

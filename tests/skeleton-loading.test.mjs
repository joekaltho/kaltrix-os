// Skeleton loading states: they exist where the long waits were, are announced to
// assistive tech once, honour reduced motion, and the old full-screen spinners are
// gone from those spots. (Layout fidelity is checked by eye; these guard the wiring.)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const read = (p) => readFileSync(p, 'utf8')
const D = 'src/app/(dashboard)/dashboard'

test('the dashboard first paint (and its Suspense fallback) is the skeleton, not a spinner', () => {
  const page = read(`${D}/page.tsx`)
  assert.ok(page.includes('<DashboardSkeleton />'))
  assert.equal((page.match(/<DashboardSkeleton \/>/g) ?? []).length, 2, 'initial load state + Suspense fallback')
  assert.ok(!/Loading KaltrixOS/.test(page))
  assert.ok(!/animate-spin/.test(page.split('function Dashboard()')[0]), 'no spinner left before the dashboard component')
})

test('plan guards and the profile page show form skeletons instead of full-screen spinners', () => {
  for (const p of ['src/components/PremiumGuard.tsx', 'src/components/ListingCapGuard.tsx', `${D}/profile/page.tsx`]) {
    const src = read(p)
    assert.ok(/FormPageSkeleton/.test(src), `${p} uses FormPageSkeleton`)
    assert.ok(!/Checking access/.test(src), `${p} no longer shows the "Checking access" spinner`)
  }
  for (const p of ['src/components/PremiumGuard.tsx', 'src/components/ListingCapGuard.tsx']) {
    assert.ok(!/animate-spin/.test(read(p)), `${p} has no spinner left`)
  }
  assert.ok(/frame="classic"/.test(read('src/components/ListingCapGuard.tsx')), 'the listing form has its own matching frame')
})

test('tab panels use one skeleton for both code download and data loading', () => {
  const page = read(`${D}/page.tsx`)
  assert.equal((page.match(/<PanelSkeleton /g) ?? []).length, 3, 'Listings, Inventory and Pulse dynamic fallbacks')
  assert.ok(/<PanelSkeleton variant="cards"/.test(read('src/components/ListingsPanel.tsx')))
  assert.ok(/<PanelSkeleton variant="stats"/.test(read('src/components/dashboard/InventoryPanel.tsx')))
  assert.ok(/<PanelSkeleton variant="stats"/.test(read('src/components/BusinessPulsePanel.tsx')))
})

test('route-level loading.tsx exists only for the form routes whose layout the skeleton matches', () => {
  for (const r of ['profile', 'listings/new', 'invoices/new', 'bookings/new', 'customers/new']) {
    assert.ok(existsSync(`${D}/${r}/loading.tsx`), `${r}/loading.tsx`)
    assert.ok(/FormPageSkeleton/.test(read(`${D}/${r}/loading.tsx`)))
  }
  assert.ok(!existsSync(`${D}/loading.tsx`), 'no catch-all dashboard loading.tsx: it would also cover unrelated routes with the wrong skeleton')
})

test('accessibility: one status announcement per skeleton, decorative blocks hidden, reduced motion respected', () => {
  const sk = read('src/components/ui/Skeleton.tsx')
  assert.ok(/aria-hidden/.test(sk))
  assert.ok(/motion-reduce:animate-none/.test(sk))
  assert.ok(/role="status"/.test(sk) && /aria-busy="true"/.test(sk) && /sr-only/.test(sk))
  for (const p of ['src/components/dashboard/DashboardSkeleton.tsx', 'src/components/dashboard/PanelSkeleton.tsx', 'src/components/ui/FormPageSkeleton.tsx']) {
    assert.ok(/SkeletonRegion/.test(read(p)), p)
  }
})

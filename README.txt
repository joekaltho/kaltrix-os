KaltrixOS — Store / Listings feature
=====================================

Already done (live):
- Migration applied to your Supabase project (Kaltrix-os): new `listings`
  table + RLS. Additive only — no existing table, policy, or function
  touched.

Drop-in files (unzip into your repo root, same paths):
  NEW   src/components/ListingCapGuard.tsx
  NEW   src/components/ListingsPanel.tsx
  NEW   src/app/(dashboard)/listings/new/page.tsx
  EDIT  src/app/(dashboard)/dashboard/page.tsx        (added Listings tab only)
  EDIT  src/app/(public)/business/[slug]/page.tsx     (added Shop tab, now default)
  EDIT  src/lib/check-plan.ts                         (added getListingLimit, additive)
  EDIT  src/types/index.ts                            (added Listing type, additive)

Nothing else changed. hasFeature/PremiumGuard/getCurrentPlan are untouched,
so bookings/crm/invoices gating behaves exactly as before.

Verified: `tsc --noEmit` clean, `next build` clean, eslint clean, on your
actual package.json versions (Next 16.2, React 19.2).

How it works
------------
- Dashboard → "Listings" tab: always visible (free tier included), grid of
  cards, Edit (modal) + Delete inline, "Add Listing" → /dashboard/listings/new.
- /dashboard/listings/new: same shape as customers/new & bookings/new, but
  wrapped in ListingCapGuard instead of PremiumGuard — it counts the
  business's listings and redirects to /dashboard/upgrade if a Free-plan
  business is already at 10. Growth/Pro = unlimited (assumed — spec said
  "higher-or-unlimited", picked unlimited; change LISTING_FREE_LIMIT or
  getListingLimit() in check-plan.ts if you want a specific Growth ceiling
  instead).
- Public business/[slug] page: new "Shop" tab, grid layout, now the DEFAULT
  tab (was "about"). Pulls only is_active listings — public RLS policy only
  allows reading active ones, everything else requires the owner's auth.

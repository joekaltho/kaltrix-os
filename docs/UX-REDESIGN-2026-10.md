# UX redesign pass — Oct 2026

Framework: Fitts, Hick, Zeigarnik, Jakob, Goal Gradient, Von Restorff, Miller.

## Apply order (important)
1. Run `supabase/migrations/20261003000100_business_contact_and_payment_details.sql`
   (adds `businesses.email`, `businesses.address`, and the owner-only
   `business_payment_details` table). Additive; nothing existing changes.
2. Then deploy the app code. Deploying first makes the settings save and the
   public business page query columns that don't exist yet.

## What changed, by screen
- **Public business page** — fixed a live bug: it ran `select('*')` as anon, which
  has been "permission denied" since the Oct 2 column lockdown, so logged-out visitors
  saw "not found". Now selects explicit public columns. Contact tab/sidebar show
  phone, email, website, address as real `tel:` / `mailto:` links.
- **Dashboard shell** — same 7 destinations and plan gating; grouped (main / Manage /
  Insights), real URLs (`/dashboard?tab=invoices`), mobile bottom bar (4 slots + More).
- **Overview** — Finish-setting-up checklist with progress (only real, computable
  steps), Needs attention, 3 KPIs, TrustScore next steps, today's bookings.
  Removed: dark upgrade banner, 4 equal stat tiles, duplicate Quick Actions list.
- **Inbox / Bookings / Customers / Invoices** — one primary action per screen
  (top right), quiet secondary row actions, status badges themed for dark mode,
  phone/email are tappable, invoice items collapse, outstanding/paid summary,
  failed writes roll back and show an error instead of silently "succeeding".
- **Forms** (invoice, customer, booking, onboarding) — shared components, labels tied
  to inputs, optional fields marked (not every required one starred), sticky submit bar,
  no full-screen "Created!" interstitial (redirects with a dismissible notice; new
  invoices offer "Copy invoice link").
- **Business settings** (was "Edit profile") — Business / Contact details / Payment
  details sections, live preview of the invoice Payment information block, dirty-state
  save bar, logo upload errors surfaced.
- **Invoice (customer-facing)** — business contact line, "Billed to", total as the one
  big number, dedicated "Payment information" section (bank, account name, account
  number with Copy, instructions), hidden once paid. Falls back to the old free-text
  instructions or a contact line for businesses that haven't set bank details.
- **Discover** — removed mouse-glow, floating blobs, scale/translate hover effects and
  the staggered 1s fade-in; added Clear filters on the empty state.

## Deliberately NOT changed
- Information architecture (ids, labels, gating) — grouping only.
- Pulse panel, Listings panel, admin, upgrade, landing, auth screens.
- No new features: no invoice search/filters, no customer picker, no bulk actions.

## Follow-ups worth a decision
- ~~`payment_instructions` readable by anon / any signed-in user~~ — resolved (Oct 9):
  free-text payment instructions now live in `business_payment_details` (owner-only RLS)
  next to the bank details; the old `businesses.payment_instructions` column is dropped.
  Two-step rollout: `20261009025227_..._expand.sql` (before deploy), then
  `20261009030329_..._contract.sql` (after deploy). `businesses_select` is still
  `using (true)` with table-wide SELECT for `authenticated`, so `user_id` and
  `trust_signals` remain readable by signed-in users — separate decision.
- White text on the brand green is ~3.3:1 (AA wants 4.5:1 for small text). Primary buttons
  use #16a34a; switching to #15803d fixes it at the cost of a darker green.

## Polish pass + new logo (Oct 4)
- **Light is the default theme.** The pre-paint script in `layout.tsx` no longer reads the
  OS preference; dark only applies after the user picks it with the toggle (localStorage).
  `color-scheme` is set per theme so scrollbars/date pickers match.
- **Theme toggle added to the dashboard** (sidebar footer + mobile top bar). It previously
  only existed on the landing page and Discover.
- **Dark-mode fixes:** public business page nav (was light grey), TrustScore pill, error/warn
  boxes on auth, Listings, Pulse and Upgrade now use the semantic tokens. Small green text
  uses `text-brandText` (AA contrast). Decorative hover-scale/glow removed on the business page.
- **New logo.** Master artwork vectorised into `public/brand/` (stacked logo + mark, dark and
  white), `src/components/Logo.tsx` (`<Logo/>` horizontal lockup, `<LogoMark/>`; tones auto /
  onDark / onLight), replacing every text wordmark. App icons: `src/app/icon.svg`,
  `apple-icon.png`, `favicon.ico` (mint tile + dark-green mark).
  - The horizontal lockup is derived from the stacked master for nav bars; swap if you
    commission an official one.
  - Transactional emails (`src/lib/resend.ts`) still use the text wordmark: email clients
    don't render inline SVG, so they need a hosted PNG of the logo.
  - Admin (`/admin`) is untouched apart from the logo; it is still hard-coded dark.

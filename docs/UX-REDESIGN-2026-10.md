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
- `businesses_select` is `using (true)` and `authenticated` has table-wide SELECT, so any
  signed-in user can read other businesses' `payment_instructions` (and `user_id`,
  `trust_signals`) through the API; `anon` can read `payment_instructions` via the column
  grant. Bank details avoid this (own table, owner-only RLS). Consider moving
  `payment_instructions` into `business_payment_details` and dropping it from the anon grant.
- White text on the brand green is ~3.3:1 (AA wants 4.5:1 for small text). Primary buttons
  use #16a34a; switching to #15803d fixes it at the cost of a darker green.

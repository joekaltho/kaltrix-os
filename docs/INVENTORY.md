# Inventory & Stock Management

Native KaltrixOS feature: track how many units of each product (Listing) a
business has, record stock coming in and going out, and keep a permanent
history. Lives in the dashboard under **Manage → Inventory**.

## What it is (and isn't)

- `listings` is still the only product catalog. Inventory adds an owner-only
  table keyed by listing; no product, price, image, category or public URL is
  touched. Tracking is **optional per product** (services and uncounted items
  just stay untracked).
- Quantities are **whole units**. `unit` ("pcs", "bags") is a display label.
- Stock never goes negative. There is no backorder model.
- Available on **all plans** (no plan gate): it extends Listings, which are
  free. Gating it later is a one-line change to the nav filter in
  `dashboard/page.tsx` (and a check inside the functions if it must hold at the
  database layer, like bookings/CRM/invoices do).

## Stock status (one rule, computed by the database)

`inventory_items.stock_status` is a generated column:

| Condition | Status |
| --- | --- |
| quantity = 0 | Out of stock |
| 0 < quantity <= low-stock level | Low stock |
| otherwise | In stock |

**No low-stock level set = treated as 0**, so the product is only ever "in
stock" or "out of stock". Nothing is defaulted to a hidden non-zero number.

## Data model (migration `20261014055333_inventory_stock_management.sql`)

- `inventory_items` — one row per tracked listing: `quantity`,
  `low_stock_threshold`, `unit`, generated `stock_status`. The row's existence
  *is* "tracking is on". The balance lives only here (no duplicate source of
  truth).
- `inventory_movements` — append-only history: movement type
  (`opening` / `receipt` / `issue` / `adjustment`), signed `quantity_change`,
  `balance_before`, `balance_after`, reason, note, reference, acting user,
  timestamp, product name snapshot. Constraints force
  `balance_after = balance_before + quantity_change`, valid sign per type and
  valid reason per type. Updates/deletes are refused by a trigger; the only
  exceptions are the database's own foreign-key actions (deleting a product
  keeps its history with `listing_id = NULL`; deleting a business removes it).
- No stock is invented. A product has no inventory row until the owner turns
  tracking on and types the opening count. Opening 0 writes no movement.

## Write path (atomic, server-side)

All writes go through `SECURITY DEFINER` functions (`inventory_enable_tracking`,
`inventory_receive_stock`, `inventory_issue_stock`, `inventory_adjust_stock`,
`inventory_update_settings`), which share one internal function. In one
transaction it: authorises from the database (the caller must own the business
that owns the listing; the client never supplies a business id), validates,
takes a per-product advisory lock + `FOR UPDATE`, checks the idempotency key,
updates the balance and inserts the movement. Either both happen or neither.

- **Concurrency:** per-product serialisation; competing calls each see the
  previous one's committed balance.
- **Duplicate submits:** client-generated idempotency key (unique per
  business). A repeat returns the original result and writes nothing.
- **Adjustments:** the counted balance replaces the recorded one; the
  displayed balance is sent as `expected`, and if stock moved meanwhile the
  call fails with `stale_balance` instead of overwriting.
- **Limits:** a movement is 1 – 10,000,000 units; a balance can't exceed
  1,000,000,000; notes ≤ 500 chars, references ≤ 100, unit label ≤ 20.
- Neither table grants INSERT/UPDATE/DELETE to `anon` or `authenticated`.
  Owners can SELECT their own rows through RLS. The browser can't write
  inventory any other way.

Read side: `get_inventory_overview(business_id, status, search, limit, offset)`
(SECURITY INVOKER, ownership pre-check, RLS applies) returns summary counts,
30-day received/issued totals, one page of tracked products (out of stock →
low → in stock, then by name) and the untracked listings.

## Integrations — what is and isn't connected

- **Invoices / payments / revenue: not connected, on purpose.** Invoice items
  are free-text (name, qty, price) with no link to a listing, and invoice
  status is set by hand — there is no order/fulfilment/refund lifecycle to make
  an automatic deduction idempotent. Creating or paying an invoice does **not**
  change stock, and inventory movements never touch revenue calculations.
  Record sales with *Issue stock → Sold* for now.
- **CRM, bookings, TrustScore:** untouched.
- **Public Shop:** untouched; stock is not exposed publicly (anon has no access
  to the new tables).
- **Team members:** KaltrixOS currently has a single owner per business and no
  staff-permission model, so "owner only" is the whole authorization model. If
  staff accounts arrive, extend the ownership check inside the functions and
  the two RLS policies.

## Known limitations

- Manual stock movements only (see above).
- Whole units only; no fractional quantities, no variants/SKUs, no multiple
  locations, no cost/valuation.
- No notifications (email/SMS/push) for low stock; the dashboard shows it.
- Tracking can't be switched off once on (it would break the history chain).
  Set the balance with an adjustment instead.
- Deleting a product removes its live balance row but keeps its history. The
  existing "Delete listing" confirmation does not mention this.
- `created_by` is a plain UUID (no FK to `auth.users`) so history survives
  user deletion paths; it is stored but not shown in the UI.

## Deployment status

- **Database:** the migration was applied to production (project
  `fgkdkyhnokijbxyxcgug`) on Oct 14, 2026 as remote version
  `20261014055333`; the local file carries the same version so the CLI ledger
  matches. The deployed function definitions were hash-compared against the
  tested ones and are byte-identical.
- **Verified on production (read-only + a rolled-back smoke test):** RLS on for
  both tables; `anon` has no privileges; `authenticated` has `SELECT` only;
  `inventory_apply_movement` and the guard trigger function are not executable
  by API roles; 0 rows created. In a transaction that was rolled back, an owner
  could track/receive/issue/adjust and read the overview, a second business got
  `not_found` / `not_authorized` / zero rows, direct UPDATE/DELETE and anon
  calls were denied.
- **App:** inert until the app deploy ships the Inventory tab. The migration is
  already live, so deploy order is satisfied.
- Re-check any time:
  - `select relrowsecurity from pg_class where relname in ('inventory_items','inventory_movements');` → both `true`
  - `select grantee, privilege_type from information_schema.role_table_grants where table_name like 'inventory_%' and grantee in ('anon','authenticated');` → only `authenticated` + `SELECT`
  - `select has_function_privilege('anon','public.inventory_receive_stock(uuid,integer,text,text,text,text)','execute');` → `false`
- Rollback (only while no real stock history exists): drop the two tables and
  the `inventory_*` / `get_inventory_overview` functions. Never after real
  history exists.

## Tests

See `supabase/tests/README.md` for the database, concurrency and end-to-end
suites (scratch Postgres only) and `npm test` for the unit tests.

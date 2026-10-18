# Inventory tests

These run against a **scratch** PostgreSQL (never a shared or production
database). `harness.sql` stands in for the Supabase bits the migration needs
(roles, `auth.uid()`, minimal `businesses` / `listings`).

```bash
createdb kx_test
psql -d kx_test -v ON_ERROR_STOP=1 -f supabase/tests/harness.sql
psql -d kx_test -v ON_ERROR_STOP=1 -f supabase/migrations/20261014055333_inventory_stock_management.sql

# 1. SQL tests: grants/RLS, validation, ledger math, tenant isolation,
#    idempotency, append-only history, atomic rollback, read model.
psql -d kx_test -f supabase/tests/inventory.test.sql      # ends with ALL INVENTORY DB TESTS PASSED

# 2. Concurrency tests: real parallel sessions (xargs -P).
bash supabase/tests/inventory_concurrency.sh              # ends with ALL INVENTORY CONCURRENCY TESTS PASSED
```

Run `inventory.test.sql` on a fresh database (it truncates the fixture tables).

`e2e_postgrest.mjs` exercises the real client path (supabase-js → PostgREST →
Postgres, with signed JWTs). It needs [PostgREST](https://postgrest.org)
pointed at the scratch DB (`jwt-secret` matching `JWT_SECRET`, `db-anon-role =
anon`, login role `authenticator`, which `harness.sql` creates):

```bash
POSTGREST_URL=http://127.0.0.1:3011 JWT_SECRET=... \
  node --experimental-strip-types supabase/tests/e2e_postgrest.mjs
```

Unit tests for the pure helpers (`src/lib/inventory.ts`) run with `npm test`.

## Onboarding / notifications / verification (Oct 15 2026)

Scratch database + the harness `onboarding_harness.sql` (Supabase stand-ins;
table shapes and RLS copied from production), then the three
`20261015120*` migrations in order:

```bash
createdb kx_notif
for f in supabase/tests/onboarding_harness.sql \
         supabase/migrations/20261015120000_admin_set_business_verified.sql \
         supabase/migrations/20261015120100_welcome_email_outbox.sql \
         supabase/migrations/20261015120200_business_notifications.sql \
         supabase/migrations/20261016100000_admin_delete_business.sql \
         supabase/migrations/20261017100000_notifications_retention.sql \
         supabase/migrations/20261017100100_notifications_realtime.sql; do
  psql -d kx_notif -v ON_ERROR_STOP=1 -q -f "$f"; done
psql -d kx_notif -v ON_ERROR_STOP=1 -q -f supabase/tests/onboarding.test.sql   # prints ALL ... PASSED
psql -d kx_notif -v ON_ERROR_STOP=1 -q -f supabase/tests/admin_delete.test.sql
psql -d kx_notif -v ON_ERROR_STOP=1 -q -f supabase/tests/trial_notifications.test.sql
psql -d kx_notif -v ON_ERROR_STOP=1 -q -f supabase/tests/notifications_retention.test.sql   # run from the repo root (uses \i)
DB=kx_notif bash supabase/tests/onboarding_concurrency.sh                      # claim race
POSTGREST_URL=... JWT_SECRET=... PGDATABASE=kx_notif \
  node --experimental-strip-types supabase/tests/onboarding_e2e.mjs            # supabase-js -> PostgREST
```

The e2e script also runs the real `deliverWelcomeEmail()` against the database
with a fake sender, and checks the public-profile query the badge renders from.

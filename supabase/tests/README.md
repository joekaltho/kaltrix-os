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

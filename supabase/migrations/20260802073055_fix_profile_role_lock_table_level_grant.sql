-- Previous REVOKE UPDATE (role) didn't actually restrict anything: Postgres
-- treats table-level and column-level UPDATE grants as additive, and
-- `authenticated` already had a blanket table-level UPDATE grant (covering
-- every column) from the original schema setup — a narrower column-level
-- revoke can't shadow that. Verified empirically: the role column still
-- changed after the earlier revoke. Fix: drop the table-level grant and
-- re-grant only the columns that should ever be client-editable (just
-- `name`, matching the only realistic future use — nothing today actually
-- updates profiles at all). `role`, `email`, `id`, `created_at` are now
-- untouchable via the anon/authenticated API path, full stop.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (name) ON public.profiles TO authenticated;
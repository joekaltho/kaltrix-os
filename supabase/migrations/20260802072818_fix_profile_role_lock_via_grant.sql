-- The trigger-based approach for `role` recurses (BEFORE trigger on profiles
-- calling a function that queries profiles again, during an active UPDATE on
-- that same table, hits genuine Postgres RLS-in-trigger recursion — verified
-- empirically, not a theoretical concern). Nothing in the app ever updates
-- profiles client-side today (grep confirms zero `.update()` calls on this
-- table), so a column-level privilege revoke closes the hole with no
-- recursion risk and no functional impact: `authenticated` simply loses the
-- ability to include `role` in any UPDATE, checked before RLS even runs.
-- service_role / postgres / direct SQL are untouched, so bootstrapping the
-- first admin still works the same way it always has.
DROP TRIGGER IF EXISTS protect_profile_role_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.protect_profile_role();

REVOKE UPDATE (role) ON public.profiles FROM authenticated;
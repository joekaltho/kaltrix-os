-- Root cause found: "Admins can view all profiles" is a policy ON profiles
-- that ALSO queries profiles inline (naked EXISTS subquery, no privilege
-- boundary crossed). Postgres's RLS rewriter re-applies the same policy set
-- to that inner subquery, recursing forever. This is pre-existing — verified
-- it throws "infinite recursion detected in policy for relation profiles"
-- on ANY update to profiles (even one that doesn't touch role) and on a
-- plain SELECT count(*) run as the admin account, meaning the admin
-- dashboard's user list is currently broken in production. is_admin() is
-- SECURITY DEFINER, so calling it (instead of inlining the same subquery)
-- crosses a real privilege boundary and breaks the cycle.
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (public.is_admin());
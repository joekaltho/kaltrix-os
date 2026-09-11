-- is_admin() queries public.profiles from inside a SECURITY DEFINER
-- function. Testing surfaced that this can recurse into RLS on profiles
-- itself (the "Admins can view all profiles" policy is a self-referencing
-- subquery on the same table), throwing "infinite recursion detected in
-- policy for relation profiles" — which would have hit every profile
-- update once the role-protection trigger started calling is_admin() on
-- every write. Disabling row_security for the duration of this specific,
-- narrow, internally-controlled lookup (no attacker-controlled input beyond
-- auth.uid(), which is the whole point of the check) is the standard fix.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security = off
AS $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$function$;
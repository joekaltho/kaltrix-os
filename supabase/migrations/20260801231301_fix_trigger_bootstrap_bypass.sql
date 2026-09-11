-- Refinement: the previous versions of these triggers fired for every
-- caller, including direct SQL (Supabase SQL editor / service-role key),
-- because auth.uid() is NULL outside a PostgREST request and is_admin()
-- returns false when it can't resolve a caller. That would have silently
-- reverted a superuser's own manual `UPDATE profiles SET role='admin'`
-- (the only current path to create the first admin) and blocked legitimate
-- service-role bulk operations. Now the protection only engages for an
-- actual authenticated-but-non-admin caller going through PostgREST/RLS —
-- direct SQL, the service-role key, and admin users are unaffected.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_business_trust_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      NEW.trust_score := 0;
      NEW.is_verified := false;
    ELSIF TG_OP = 'UPDATE' THEN
      NEW.trust_score := OLD.trust_score;
      NEW.is_verified := OLD.is_verified;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
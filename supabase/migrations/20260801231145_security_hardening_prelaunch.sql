-- 1. Harden handle_new_user() against search_path hijacking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'name', 'User'),
    'business'
  );
  RETURN NEW;
END;
$$;

-- 2. Prevent self role-escalation: only an existing admin can change `role`.
-- RLS is row-scoped, not column-scoped, so "update own profile" otherwise
-- lets any user PATCH their own role to 'admin'.
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role_trigger ON public.profiles;
CREATE TRIGGER protect_profile_role_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_profile_role();

-- 3. Prevent trust_score / is_verified forgery on businesses. Same class of
-- bug: computed client-side and written straight through RLS, which only
-- checks row ownership. New rows always start at 0/false; only an admin can
-- change either afterward.
CREATE OR REPLACE FUNCTION public.protect_business_trust_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.trust_score := 0;
    NEW.is_verified := false;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NOT public.is_admin() THEN
      NEW.trust_score := OLD.trust_score;
      NEW.is_verified := OLD.is_verified;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_business_trust_fields_trigger ON public.businesses;
CREATE TRIGGER protect_business_trust_fields_trigger
BEFORE INSERT OR UPDATE ON public.businesses
FOR EACH ROW EXECUTE FUNCTION public.protect_business_trust_fields();

-- 4. bookings: drop the wide-open policies letting anyone (including
-- unauthenticated visitors) insert into or read every business's bookings.
-- bookings_all_own already covers the legitimate case.
DROP POLICY IF EXISTS "Anyone can create bookings" ON public.bookings;
DROP POLICY IF EXISTS "Public can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Users can view their bookings" ON public.bookings;

-- 5. Dedupe redundant duplicate policies left over from overlapping past
-- migrations (functionally identical pairs — safe to drop one of each).
DROP POLICY IF EXISTS "messages_insert_public" ON public.messages;
DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Business owners can manage their invoices" ON public.invoices;
DROP POLICY IF EXISTS "Admin can view waitlist" ON public.waitlist;

-- 6. logos bucket: cap file size and restrict to real image types (was
-- unlimited size, any MIME type accepted).
UPDATE storage.buckets
SET file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp','image/gif']
WHERE id = 'logos';

-- 7. logos bucket had zero RLS policies on storage.objects at all, meaning
-- every upload was silently rejected — logo upload was completely broken
-- for every user. Scope uploads to the caller's own filename prefix,
-- matching how the app names files (`${user.id}-${timestamp}.${ext}`).
DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read"
ON storage.objects FOR SELECT
USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos_owner_insert" ON storage.objects;
CREATE POLICY "logos_owner_insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'logos' AND name LIKE (auth.uid()::text || '-%'));

DROP POLICY IF EXISTS "logos_owner_update" ON storage.objects;
CREATE POLICY "logos_owner_update"
ON storage.objects FOR UPDATE
USING (bucket_id = 'logos' AND name LIKE (auth.uid()::text || '-%'))
WITH CHECK (bucket_id = 'logos' AND name LIKE (auth.uid()::text || '-%'));

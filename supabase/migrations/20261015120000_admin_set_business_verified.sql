-- Fix: "Mark Verified" in /admin never reached the database, so the public
-- profile never showed the Verified badge.
--
-- ROOT CAUSE (confirmed against production policies, Oct 15 2026):
--   public.businesses has exactly four RLS policies -- select (true) and
--   insert/update/delete restricted to `auth.uid() = user_id`. There is no
--   admin policy. When an admin ran
--       update businesses set is_verified = true where id = <someone else's>
--   Postgres filtered the row out, PostgREST returned "0 rows, no error", and
--   the admin page (which ignored the result) flipped its own local state to
--   "Verified" anyway. The row never changed, so the public page -- which
--   correctly reads is_verified -- correctly showed no badge.
--
-- FIX: rather than widening UPDATE on the whole table to admins (which would
-- also let any admin session rewrite user_id, slug, etc. through the API),
-- give admins one narrow, auditable door: a SECURITY DEFINER function that
-- checks is_admin() itself and can change ONLY is_verified. The existing
-- protect_business_trust_fields() trigger still runs on the update, so
-- trust_score / trust_signals are recomputed exactly as before, and it still
-- forces is_verified back for any non-admin writer.
--
-- Idempotent: safe to re-run. APPLY BEFORE deploying the matching admin page
-- (the page degrades safely if it's deployed first: the RPC call errors and
-- the admin sees the error instead of a false "Verified").

create or replace function public.admin_set_business_verified(
  p_business_id uuid,
  p_verified boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_verified boolean;
  v_score integer;
  v_signals jsonb;
begin
  -- auth.uid() inside a SECURITY DEFINER function still reflects the actual
  -- caller (it reads the request JWT), so this gate is the caller's role,
  -- not the function owner's.
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_business_id is null or p_verified is null then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;

  update public.businesses
     set is_verified = p_verified
   where id = p_business_id
  returning id, is_verified, trust_score, trust_signals
       into v_id, v_verified, v_score, v_signals;

  if v_id is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  -- Return what is actually stored, so the UI shows the real state.
  return jsonb_build_object(
    'id', v_id,
    'is_verified', v_verified,
    'trust_score', v_score,
    'trust_signals', v_signals
  );
end;
$$;

revoke execute on function public.admin_set_business_verified(uuid, boolean) from public, anon;
grant execute on function public.admin_set_business_verified(uuid, boolean) to authenticated;

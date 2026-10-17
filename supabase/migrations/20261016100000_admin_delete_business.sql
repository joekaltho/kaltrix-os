-- Fix: "Delete" in /admin never deleted anything, but the page removed the row
-- from the screen anyway.
--
-- ROOT CAUSE (confirmed against production policies, Oct 16 2026): same as the
-- verification bug fixed in 20261015120000. public.businesses has an owner-only
-- DELETE policy (`auth.uid() = user_id`) and no admin policy. An admin's
--     delete from businesses where id = <someone else's>
-- is filtered by RLS to "0 rows, no error"; the page ignored the result and
-- dropped the row from its list. The business stayed live (and public).
--
-- FIX: one narrow SECURITY DEFINER door, admin-checked inside the function,
-- instead of an admin DELETE policy that would let any admin session delete via
-- the raw API. It returns the deleted row's id/name so the UI can confirm what
-- actually happened, and raises if nothing was deleted.
--
-- What a delete removes: every dependent table cascades from businesses
-- (bookings, customers, expenses, invoices, leads, listings, inventory, messages,
-- reviews, review reports, subscriptions, payment details, notifications, email
-- deliveries). feedback.business_id is SET NULL, so feedback is kept. It is
-- irreversible. The auth user / profile is NOT deleted.
--
-- Idempotent: safe to re-run. APPLY BEFORE deploying the matching admin page (the
-- page degrades safely if deployed first: it shows the error and removes nothing).

create or replace function public.admin_delete_business(p_business_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  -- auth.uid() inside a SECURITY DEFINER function still reflects the actual
  -- caller (it reads the request JWT), so this gates on the caller's role.
  if auth.uid() is null or not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if p_business_id is null then
    raise exception 'invalid arguments' using errcode = '22023';
  end if;

  delete from public.businesses
   where id = p_business_id
  returning id, business_name into v_id, v_name;

  if v_id is null then
    raise exception 'business not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object('id', v_id, 'business_name', v_name);
end;
$$;

revoke execute on function public.admin_delete_business(uuid) from public, anon;
grant execute on function public.admin_delete_business(uuid) to authenticated;

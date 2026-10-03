-- UX redesign (Oct 2026): richer business contact info + structured invoice
-- payment details. Additive and idempotent; every existing row is unaffected.
--
-- APPLY THIS BEFORE DEPLOYING the matching app code: the settings page now
-- writes businesses.email / businesses.address and business_payment_details.

-- 1. Public contact details --------------------------------------------------
-- Email and address are meant to be shown on the public business page and on
-- invoices, so anon gets read access to just these two new columns (the anon
-- allowlist from 20261002000300 stays otherwise unchanged).
alter table public.businesses
  add column if not exists email text,
  add column if not exists address text;

alter table public.businesses
  drop constraint if exists businesses_contact_length_chk;
alter table public.businesses
  add constraint businesses_contact_length_chk check (
    (email is null or char_length(email) <= 254) and
    (address is null or char_length(address) <= 300)
  );

grant select (email, address) on table public.businesses to anon;

-- 2. Private payment details -------------------------------------------------
-- Bank details live in their own owner-only table instead of new columns on
-- businesses: businesses_select is `using (true)`, so any logged-in user could
-- read every business's columns through the API. Invoice pages read this table
-- server-side with the service role, so customers still see it on the invoice.
create table if not exists public.business_payment_details (
  business_id    uuid primary key references public.businesses(id) on delete cascade,
  bank_name      text not null check (char_length(bank_name) between 1 and 100),
  account_name   text not null check (char_length(account_name) between 1 and 150),
  account_number text not null check (account_number ~ '^[0-9]{6,20}$'),
  updated_at     timestamptz not null default now()
);

alter table public.business_payment_details enable row level security;

revoke all on table public.business_payment_details from anon;
grant select, insert, update, delete on table public.business_payment_details to authenticated;

drop policy if exists business_payment_details_select on public.business_payment_details;
create policy business_payment_details_select on public.business_payment_details
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.user_id = (select auth.uid())
  ));

drop policy if exists business_payment_details_insert on public.business_payment_details;
create policy business_payment_details_insert on public.business_payment_details
  for insert to authenticated
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.user_id = (select auth.uid())
  ));

drop policy if exists business_payment_details_update on public.business_payment_details;
create policy business_payment_details_update on public.business_payment_details
  for update to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.user_id = (select auth.uid())
  ));

drop policy if exists business_payment_details_delete on public.business_payment_details;
create policy business_payment_details_delete on public.business_payment_details
  for delete to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = business_id and b.user_id = (select auth.uid())
  ));

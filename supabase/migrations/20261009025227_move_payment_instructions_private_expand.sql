-- STEP 1 of 2 (expand). Safe to apply BEFORE deploying the matching app code.
--
-- Problem: businesses.payment_instructions is readable by `anon` (column grant
-- from 20261002000300) and by every signed-in user (authenticated has
-- table-wide SELECT, businesses_select is `using (true)`). It is payment info
-- (bank transfer details, mobile-money handles) and should be owner-only, like
-- the structured bank details already are (business_payment_details).
--
-- This step: give business_payment_details a payment_instructions column, let a
-- row exist with instructions only (bank fields become all-or-nothing nullable),
-- copy existing instructions across, and stop `anon` reading the old column.
-- The old businesses.payment_instructions column is left in place so the
-- currently deployed app keeps working; STEP 2 drops it after the deploy.
--
-- Idempotent: safe to re-run.

-- 1. New home for the free-text instructions ---------------------------------
alter table public.business_payment_details
  add column if not exists payment_instructions text;

alter table public.business_payment_details
  drop constraint if exists business_payment_details_instructions_len_chk;
alter table public.business_payment_details
  add constraint business_payment_details_instructions_len_chk check (
    payment_instructions is null or char_length(payment_instructions) <= 1000
  );

-- 2. Bank fields: all three set, or all three empty ---------------------------
-- (Existing rows all have all three, so these constraints hold on current data.)
alter table public.business_payment_details
  alter column bank_name drop not null,
  alter column account_name drop not null,
  alter column account_number drop not null;

alter table public.business_payment_details
  drop constraint if exists business_payment_details_bank_all_or_none_chk;
alter table public.business_payment_details
  add constraint business_payment_details_bank_all_or_none_chk check (
    (bank_name is null and account_name is null and account_number is null)
    or (bank_name is not null and account_name is not null and account_number is not null)
  );

-- A row must carry something: bank details, instructions, or both.
alter table public.business_payment_details
  drop constraint if exists business_payment_details_not_empty_chk;
alter table public.business_payment_details
  add constraint business_payment_details_not_empty_chk check (
    bank_name is not null or nullif(btrim(payment_instructions), '') is not null
  );

-- 3. Copy existing instructions into the private table -------------------------
-- Never overwrites instructions already saved in the private table.
insert into public.business_payment_details (business_id, payment_instructions)
select b.id, btrim(b.payment_instructions)
from public.businesses b
where nullif(btrim(b.payment_instructions), '') is not null
on conflict (business_id) do update
  set payment_instructions = excluded.payment_instructions,
      updated_at = now()
  where public.business_payment_details.payment_instructions is null;

-- 4. Anonymous visitors can no longer read the old column ------------------------
-- (The public business page never selected it; invoices read it server-side
-- with the service role.)
revoke select (payment_instructions) on table public.businesses from anon;

-- STEP 2 of 2 (contract). Apply ONLY AFTER the matching app code is deployed.
--
-- Once the app reads and writes payment instructions through
-- business_payment_details, the old businesses.payment_instructions column is
-- dead weight that every signed-in user can still read. Drop it.
--
-- First a catch-up copy, in case anyone saved instructions through the old
-- code between STEP 1 and the deploy. It never overwrites instructions that
-- already exist in the private table. It only runs while the old column still
-- exists, so re-running this file after the drop is a harmless no-op.
--
-- Deliberately no CASCADE: if anything unexpected depends on the column, the
-- DROP fails loudly instead of taking dependents with it.

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'businesses'
      and column_name = 'payment_instructions'
  ) then
    execute $copy$
      insert into public.business_payment_details (business_id, payment_instructions)
      select b.id, btrim(b.payment_instructions)
      from public.businesses b
      where nullif(btrim(b.payment_instructions), '') is not null
      on conflict (business_id) do update
        set payment_instructions = excluded.payment_instructions,
            updated_at = now()
        where public.business_payment_details.payment_instructions is null
    $copy$;
  end if;
end
$$;

alter table public.businesses
  drop column if exists payment_instructions;

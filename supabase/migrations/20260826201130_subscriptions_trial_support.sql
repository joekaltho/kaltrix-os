-- 1. Exact trial start timestamp. expires_at (already present, added in
--    subscriptions_add_updated_at_and_expiry) is reused as the trial end /
--    access-expiry timestamp for both trial and paid rows.
alter table public.subscriptions
  add column if not exists trial_started_at timestamptz;

-- 2. Auto-provision a 30-day Pro trial subscription whenever a new business
--    is created — mirrors the existing handle_new_user() pattern that
--    provisions a profile row on auth.users insert. ON CONFLICT DO NOTHING
--    makes this idempotent and guarantees it can never overwrite an
--    existing subscription for that business_id (a business_id is only
--    ever newly created here, so this is a defensive guard, not a normal
--    path — but it means this can never clobber a paid subscription).
create or replace function public.provision_trial_subscription()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform set_config('kaltrix.trusted_write', 'on', true);

  insert into public.subscriptions (business_id, plan, status, trial_started_at, expires_at)
  values (new.id, 'pro', 'trialing', now(), now() + interval '30 days')
  on conflict (business_id) do nothing;

  return new;
end;
$$;

drop trigger if exists provision_trial_subscription_trigger on public.businesses;
create trigger provision_trial_subscription_trigger
  after insert on public.businesses
  for each row execute function public.provision_trial_subscription();

-- 3. Lock down subscriptions the same way trust_score/is_verified and
--    profiles.role are already locked down (see security_hardening_prelaunch
--    and fix_trigger_bootstrap_bypass): RLS (subscriptions_all_own) only
--    checks row ownership, not field values, so it currently lets a
--    business owner set plan/status/expires_at/trial_started_at/
--    paystack_reference to whatever they want via a direct client request —
--    e.g. granting themselves permanent Pro. This forces those fields back
--    to safe values for any authenticated non-admin caller. Trusted
--    server-side writes (the trigger above, and the Paystack webhook /
--    expiry cron added separately, all of which run with no user JWT —
--    auth.uid() is null there) are unaffected, matching the existing
--    protect_business_trust_fields / protect_profile_role pattern exactly.
create or replace function public.protect_subscription_fields()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if coalesce(current_setting('kaltrix.trusted_write', true), '') = 'on' then
    return new;
  end if;

  if auth.uid() is not null and not public.is_admin() then
    if TG_OP = 'INSERT' then
      new.plan := 'free';
      new.status := 'active';
      new.expires_at := null;
      new.trial_started_at := null;
      new.paystack_reference := null;
    elsif TG_OP = 'UPDATE' then
      new.plan := old.plan;
      new.status := old.status;
      new.expires_at := old.expires_at;
      new.trial_started_at := old.trial_started_at;
      new.paystack_reference := old.paystack_reference;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_subscription_fields_trigger on public.subscriptions;
create trigger protect_subscription_fields_trigger
  before insert or update on public.subscriptions
  for each row execute function public.protect_subscription_fields();

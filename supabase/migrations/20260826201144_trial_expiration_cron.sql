create extension if not exists pg_cron;

-- Idempotent by construction: only rows still 'trialing' with a past
-- expires_at are touched, so re-running this (the cron will, every 15
-- minutes) is always a safe no-op once a given trial has been processed.
-- Paid subscriptions (status = 'active') are never matched by this WHERE
-- clause, so they can never be downgraded by this job, including a
-- business that upgraded mid-trial (its status flips to 'active' the
-- moment the Paystack webhook records the payment).
create or replace function public.expire_trial_subscriptions()
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  perform set_config('kaltrix.trusted_write', 'on', true);

  update public.subscriptions
  set plan = 'free',
      status = 'active'
  where status = 'trialing'
    and expires_at is not null
    and expires_at < now();
end;
$$;

select cron.schedule(
  'expire-trial-subscriptions',
  '*/15 * * * *',
  $$select public.expire_trial_subscriptions();$$
);

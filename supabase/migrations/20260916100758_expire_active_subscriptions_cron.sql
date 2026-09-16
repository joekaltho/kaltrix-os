-- Mirrors 20260826201144_trial_expiration_cron.sql, for the gap it
-- deliberately left alone: a paid subscription (status = 'active') never
-- expired server-side, even though Terms §5 says plans "automatically
-- expire at the end of the billing period" with no auto-renewal. The
-- Paystack webhook now sets expires_at to the end of the paid period
-- (src/app/api/webhooks/paystack/route.ts), and resolveEffectivePlan()
-- (src/lib/check-plan.ts) already treats a lapsed-but-not-yet-swept 'active'
-- row as free the same way it does for 'trialing'. This job is the DB-level
-- backstop so anything reading `subscriptions` directly (not through that
-- function) also sees the correct state.
--
-- Idempotent by construction: only rows still 'active' with plan <> 'free'
-- and a past expires_at are touched, so re-running this (the cron will,
-- every 15 minutes) is always a safe no-op once a given subscription has
-- been processed. A free-tier row has expires_at = null and is never
-- matched by this WHERE clause.
create or replace function public.expire_active_subscriptions()
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
  where status = 'active'
    and plan <> 'free'
    and expires_at is not null
    and expires_at < now();
end;
$$;

-- Not meant to be called directly by a client — close the direct-RPC path
-- from the start this time (see 20260827005237_restrict_trial_function_rpc_exposure.sql,
-- which had to fix this after the fact for the trial-expiry function).
revoke execute on function public.expire_active_subscriptions() from anon, authenticated, public;

select cron.schedule(
  'expire-active-subscriptions',
  '*/15 * * * *',
  $$select public.expire_active_subscriptions();$$
);

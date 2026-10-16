-- Welcome email outbox: guarantees exactly-one welcome email per business and
-- survives provider outages.
--
-- HOW IT WORKS
--   1. Creating a business (any path) enqueues one `welcome` row via a trigger.
--      The trigger can never block registration: any error inside it is
--      swallowed with a WARNING.
--   2. The server route /api/onboarding/welcome claims that row atomically
--      (claim_email_delivery) -- a single UPDATE ... RETURNING, so two
--      concurrent requests can never both win -- sends through Resend, then
--      marks it sent or failed.
--   3. A failed send is retried (max 3 attempts, 2 min apart) the next time the
--      owner opens the dashboard. A claim abandoned mid-send (crash) becomes
--      claimable again after 10 min.
--   4. UNIQUE (business_id, kind) is the hard duplicate guard.
--
-- Businesses that existed before this migration get no row, so nobody is sent
-- a retroactive "welcome".
--
-- The table is server-only: RLS is on with a deny-all policy and anon /
-- authenticated have no privileges. Only the service role (the API route) and
-- the trigger (SECURITY DEFINER) touch it. Idempotent: safe to re-run.

create table if not exists public.email_deliveries (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  kind        text not null check (kind in ('welcome')),
  status      text not null default 'pending'
              check (status in ('pending', 'sending', 'sent', 'failed')),
  attempts    integer not null default 0 check (attempts >= 0),
  claimed_at  timestamptz,
  sent_at     timestamptz,
  -- Provider message id (Resend), kept for support/debugging.
  provider_id text check (provider_id is null or char_length(provider_id) <= 100),
  -- Short, non-sensitive failure reason (status code / error name). Never the
  -- recipient address, never the API key.
  last_error  text check (last_error is null or char_length(last_error) <= 300),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (business_id, kind)
);

alter table public.email_deliveries enable row level security;

drop policy if exists email_deliveries_no_direct_access on public.email_deliveries;
create policy email_deliveries_no_direct_access on public.email_deliveries
  for all using (false) with check (false);

-- Supabase grants full table access to anon/authenticated by default.
revoke all on table public.email_deliveries from anon, authenticated;

-- 1. Enqueue on business creation ---------------------------------------------
create or replace function public.enqueue_welcome_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.email_deliveries (business_id, kind)
  values (new.id, 'welcome')
  on conflict (business_id, kind) do nothing;
  return new;
exception when others then
  -- Never let an email-bookkeeping problem fail a business registration.
  raise warning 'enqueue_welcome_email failed for business %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists enqueue_welcome_email_trigger on public.businesses;
create trigger enqueue_welcome_email_trigger
  after insert on public.businesses
  for each row execute function public.enqueue_welcome_email();

-- 2. Atomic claim -------------------------------------------------------------
-- Returns the claimed row (id, attempts) or nothing. Nothing means: no such
-- delivery, already sent, another request is sending it right now, retry
-- window not reached yet, or attempts exhausted.
create or replace function public.claim_email_delivery(
  p_business_id uuid,
  p_kind text,
  p_max_attempts integer default 3,
  p_retry_after_seconds integer default 120,
  p_stale_after_seconds integer default 600
)
returns table (id uuid, attempts integer)
language sql
security definer
set search_path = public
as $$
  update public.email_deliveries d
     set status = 'sending',
         claimed_at = now(),
         attempts = d.attempts + 1,
         updated_at = now()
   where d.business_id = p_business_id
     and d.kind = p_kind
     and d.attempts < p_max_attempts
     and (
          d.status = 'pending'
       or (d.status = 'failed'
           and d.updated_at <= now() - make_interval(secs => p_retry_after_seconds))
       or (d.status = 'sending'
           and d.claimed_at <= now() - make_interval(secs => p_stale_after_seconds))
     )
  returning d.id, d.attempts;
$$;

-- Trigger function: nothing calls it as RPC (same hardening as 20261009153208).
revoke execute on function public.enqueue_welcome_email() from public, anon, authenticated;
-- The claim is server-only: the API route uses the service role.
revoke execute on function public.claim_email_delivery(uuid, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_email_delivery(uuid, text, integer, integer, integer)
  to service_role;

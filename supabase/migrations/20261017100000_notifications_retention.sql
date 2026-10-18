-- Retention for public.notifications: they were never cleaned up.
--
-- POLICY (daily, 03:41 UTC = 04:41 Lagos, job `prune-notifications`)
--   * read notifications are deleted 30 days after they were read;
--   * anything, read or not, is deleted once it is 180 days old.
-- Unread notifications younger than 180 days are always kept: an owner who is away
-- for a few months should still find what happened when they come back.
--
-- WHY PRUNING CAN'T RESURRECT A NOTIFICATION. A deleted row also frees its
-- (business_id, dedupe_key), so this only matters where something could re-create
-- the same key later, and nothing can:
--   * messages / reviews / moderation / verification / stock: created by row
--     triggers, which fire once per event (keys include the row id or a random uuid);
--   * plan_activated / trial_ended / plan_expired: fire on a state change, and a
--     replay of the same Paystack reference changes nothing;
--   * trial_ending: the hourly sweep only looks at trials that end within 3 days. A
--     notification old enough to be pruned (30+ days after reading) belongs to a trial
--     that ended long ago, so the sweep never selects it again.
--   (supabase/tests/notifications_retention.test.sql checks the trial timeline.)
--
-- email_deliveries is deliberately NOT pruned: one tiny row per business, and it is
-- the audit trail for "did the welcome email go out".
--
-- Idempotent: safe to re-run.

create index if not exists notifications_created_at_idx on public.notifications (created_at);
create index if not exists notifications_read_at_idx on public.notifications (read_at) where read_at is not null;

create or replace function public.prune_notifications(
  p_read_days integer default 30,
  p_max_days integer default 180
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch integer;
  v_total integer := 0;
  v_rounds integer := 0;
begin
  -- Floors so a typo (0, negative) can't turn a cleanup into a wipe.
  if p_read_days is null or p_max_days is null or p_read_days < 7 or p_max_days < 30 or p_max_days < p_read_days then
    raise exception 'unsafe retention arguments' using errcode = '22023';
  end if;

  loop
    delete from public.notifications
     where id in (
       select id from public.notifications
        where (read_at is not null and read_at < now() - make_interval(days => p_read_days))
           or created_at < now() - make_interval(days => p_max_days)
        limit 5000
     );
    get diagnostics v_batch = row_count;
    v_total := v_total + v_batch;
    v_rounds := v_rounds + 1;
    -- Bounded work per run; the next daily run continues if there was a huge backlog.
    exit when v_batch < 5000 or v_rounds >= 20;
  end loop;

  return v_total;
end;
$$;

revoke execute on function public.prune_notifications(integer, integer) from public, anon, authenticated;

-- pg_cron already runs in production; guarded so this also applies elsewhere.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('prune-notifications', '41 3 * * *', 'select public.prune_notifications();');
  end if;
end;
$$;

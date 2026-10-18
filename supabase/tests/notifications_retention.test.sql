-- DB tests for notification retention + the Realtime publication change
-- (migrations 20261017100000 / 20261017100100). Run after the harness + all migrations.
\set ON_ERROR_STOP on
\set QUIET on
create schema if not exists t;
create or replace function t.ok(cond boolean, msg text) returns void language plpgsql as
$$ begin if cond is not true then raise exception 'FAIL: %', msg; end if; end $$;
create or replace function t.denied(stmt text, code text, msg text) returns void language plpgsql as
$$ begin
  begin execute stmt;
  exception when others then
    if sqlstate = code then return; end if;
    raise exception 'FAIL: % (wanted %, got % %)', msg, code, sqlstate, sqlerrm;
  end;
  raise exception 'FAIL: % (statement succeeded)', msg;
end $$;
create or replace function t.as_user(uid uuid) returns void language plpgsql as
$$ begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  execute 'set role ' || case when uid is null then 'anon' else 'authenticated' end;
end $$;
create or replace function t.as_root() returns void language plpgsql as
$$ begin reset role; perform set_config('request.jwt.claim.sub', '', false); end $$;
grant usage on schema t to anon, authenticated, service_role;
grant execute on all functions in schema t to anon, authenticated, service_role;

truncate public.businesses cascade;
insert into public.businesses (user_id, business_name, slug) values (gen_random_uuid(), 'Retain Co', 'retain-co');
create temp table b as select id from public.businesses limit 1;

-- Helper: a notification with a given age and read age (NULL = unread).
create or replace function t.note(p_key text, p_created_days int, p_read_days int) returns void language sql as $$
  insert into public.notifications (business_id, type, title, dedupe_key, created_at, read_at)
  select b.id, 'new_message', p_key, p_key,
         now() - make_interval(days => p_created_days),
         case when p_read_days is null then null else now() - make_interval(days => p_read_days) end
  from b $$;

-- ============================================================================
-- 1. Realtime publication
-- ============================================================================
select t.ok(exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'),
            'notifications is in the supabase_realtime publication');
select t.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime') = 1,
            'only notifications was added (no other table is streamed)');
\i supabase/migrations/20261017100100_notifications_realtime.sql
select t.ok((select count(*) from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') = 1,
            'applying the realtime migration twice is a no-op');

-- ============================================================================
-- 2. Retention
-- ============================================================================
select t.note('read-35d-ago',        40, 35);   -- read long ago           -> pruned
select t.note('read-5d-ago',         10,  5);   -- read recently           -> kept
select t.note('unread-40d',          40, null); -- unread, young enough    -> kept
select t.note('unread-179d',        179, null); -- unread, just under max  -> kept
select t.note('unread-181d',        181, null); -- unread, past max age    -> pruned
select t.note('old-but-read-today', 100,  0);   -- created long ago, read now -> kept
select t.note('read-recently-200d', 200,  1);   -- past max age even though read yesterday -> pruned
select t.note('read-exactly-29d',    60, 29);   -- inside the 30-day read window -> kept
select t.note('read-31d',            60, 31);   -- just outside it         -> pruned

select t.ok(public.prune_notifications() = 4, 'prunes exactly the 4 expired rows');
select t.ok((select string_agg(title, ',' order by title) from public.notifications)
            = 'old-but-read-today,read-5d-ago,read-exactly-29d,unread-179d,unread-40d',
            'keeps recent-read, unread-under-max, and recently-read rows');
select t.ok(public.prune_notifications() = 0, 'running again deletes nothing');

-- Large backlog: more than one batch (5000) is cleared in a single run.
insert into public.notifications (business_id, type, title, dedupe_key, created_at, read_at)
  select b.id, 'new_message', 'bulk', 'bulk-' || g, now() - interval '60 days', now() - interval '40 days'
  from b, generate_series(1, 12000) g;
select t.ok(public.prune_notifications() = 12000, 'a 12,000-row backlog is fully cleared (multiple batches)');
select t.ok((select count(*) from public.notifications) = 5, 'the 5 live rows are untouched by the bulk prune');

-- Argument guards: a typo can't turn cleanup into a wipe.
select t.denied($$select public.prune_notifications(0, 180)$$, '22023', 'zero read-days rejected');
select t.denied($$select public.prune_notifications(30, 0)$$, '22023', 'zero max-days rejected');
select t.denied($$select public.prune_notifications(-1, -1)$$, '22023', 'negative rejected');
select t.denied($$select public.prune_notifications(60, 30)$$, '22023', 'max below read rejected');
select t.denied($$select public.prune_notifications(null, 180)$$, '22023', 'null rejected');
select t.ok((select count(*) from public.notifications) = 5, 'rejected calls deleted nothing');

-- Only the database (cron / owner) can run it.
select t.as_user('d0000000-0000-0000-0000-00000000000a');
select t.denied($$select public.prune_notifications()$$, '42501', 'signed-in users cannot run the prune');
select t.as_user(null);
select t.denied($$select public.prune_notifications()$$, '42501', 'anon cannot run the prune');
select t.as_root();

-- ============================================================================
-- 3. Pruning can't resurrect a trial_ending notification (real-world timeline)
-- ============================================================================
truncate public.notifications;
insert into public.subscriptions (business_id, plan, status, trial_started_at, expires_at)
  select id, 'pro', 'trialing', now() - interval '28 days', now() + interval '2 days' from b;
select public.notify_trials_ending();
select t.ok((select count(*) from public.notifications where type = 'trial_ending') = 1, 'trial_ending created while the trial is ending');

-- Move the clock forward 40 days: the owner read it 40 days ago, the trial is long over.
update public.notifications set created_at = created_at - interval '40 days', read_at = now() - interval '39 days';
update public.subscriptions set trial_started_at = trial_started_at - interval '40 days', expires_at = expires_at - interval '40 days',
                               plan = 'free', status = 'active';
select t.ok(public.prune_notifications() = 1, 'the old read trial notification is pruned');
select public.notify_trials_ending();
select public.notify_trials_ending();
select t.ok((select count(*) from public.notifications where type = 'trial_ending') = 0, 'the sweep does NOT bring it back');

\echo ALL NOTIFICATION RETENTION DB TESTS PASSED

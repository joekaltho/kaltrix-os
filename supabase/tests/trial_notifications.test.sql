-- DB tests for notify_trials_ending() (migration 20261015120200): window edges,
-- eligibility, idempotency, null trial_started_at. Run after the harness + migrations.
\set ON_ERROR_STOP on
\set QUIET on
create schema if not exists t;
create or replace function t.ok(cond boolean, msg text) returns void language plpgsql as
$$ begin if cond is not true then raise exception 'FAIL: %', msg; end if; end $$;

truncate public.businesses cascade;

-- One business per case (subscriptions are unique per business).
create temp table cases (slug text, plan text, status text, expires interval, started text, want integer, why text);
insert into cases values
  ('in-window-2d',      'pro',    'trialing', interval '2 days',                 'now',  1, 'ends in 2 days: notify'),
  ('just-inside-3d',    'pro',    'trialing', interval '2 days 23 hours 59 minutes', 'now', 1, 'ends just inside 3 days: notify'),
  ('just-outside-3d',   'pro',    'trialing', interval '3 days 1 minute',        'now',  0, 'ends just outside 3 days: not yet'),
  ('far-away',          'pro',    'trialing', interval '20 days',                'now',  0, '20 days left: no'),
  ('already-expired',   'pro',    'trialing', interval '-1 minute',              'now',  0, 'expired but not yet swept to Free: not a "soon"'),
  ('null-started',      'pro',    'trialing', interval '1 day',                  'null', 1, 'trial_started_at null still notifies (key falls back)'),
  ('paid-active',       'growth', 'active',   interval '2 days',                 'now',  0, 'paid plan near renewal is not a trial'),
  ('free-active',       'free',   'active',   interval '2 days',                 'now',  0, 'free plan: no'),
  ('non-pro-trial',     'growth', 'trialing', interval '2 days',                 'now',  0, 'only the Pro trial is the trial we announce');

insert into public.businesses (user_id, business_name, slug)
  select gen_random_uuid(), c.slug, c.slug from cases c;
insert into public.subscriptions (business_id, plan, status, expires_at, trial_started_at)
  select b.id, c.plan, c.status, now() + c.expires, case c.started when 'null' then null else now() - interval '27 days' end
  from cases c join public.businesses b on b.slug = c.slug;

-- Creating subscriptions must not notify by itself (provisioning is silent).
select t.ok((select count(*) from public.notifications where type = 'trial_ending') = 0, 'no notifications before the sweep');

select public.notify_trials_ending();
do $$
declare c record;
begin
  for c in select * from cases loop
    perform t.ok(
      (select count(*) from public.notifications n join public.businesses b on b.id = n.business_id
        where b.slug = c.slug and n.type = 'trial_ending') = c.want,
      c.slug || ': ' || c.why);
  end loop;
end $$;

-- Idempotent: any number of further sweeps adds nothing.
select public.notify_trials_ending();
select public.notify_trials_ending();
select public.notify_trials_ending();
select t.ok((select count(*) from public.notifications where type = 'trial_ending') = 3, 'repeated sweeps never duplicate (3 eligible trials, 3 notifications)');
select t.ok((select count(*) from (select business_id, dedupe_key from public.notifications group by 1, 2 having count(*) > 1) d) = 0, 'no duplicate (business, dedupe_key) anywhere');

-- Read state does not cause re-notification (the unique key outlives reading).
update public.notifications set read_at = now() where type = 'trial_ending';
select public.notify_trials_ending();
select t.ok((select count(*) from public.notifications where type = 'trial_ending') = 3, 'marking read does not resurrect the notification');

-- Wording + destination.
select t.ok((select bool_and(title = 'Your Pro trial ends soon' and href = '/dashboard/upgrade' and body like 'Your trial ends on % Choose a plan%')
               from public.notifications where type = 'trial_ending'), 'text and link');

-- A different trial for the same business later (new trial_started_at) is a new event.
update public.subscriptions set trial_started_at = now() - interval '1 day', expires_at = now() + interval '2 days'
  where business_id = (select id from public.businesses where slug = 'in-window-2d');
select public.notify_trials_ending();
select t.ok((select count(*) from public.notifications n join public.businesses b on b.id = n.business_id where b.slug = 'in-window-2d' and n.type = 'trial_ending') = 2, 'a new trial period notifies again');

-- The trial then lapsing produces exactly one trial_ended, independent of trial_ending.
update public.subscriptions set plan = 'free', status = 'active' where business_id = (select id from public.businesses where slug = 'in-window-2d');
select t.ok((select count(*) from public.notifications n join public.businesses b on b.id = n.business_id where b.slug = 'in-window-2d' and n.type = 'trial_ended') = 1, 'lapse notifies once');

\echo ALL TRIAL NOTIFICATION DB TESTS PASSED

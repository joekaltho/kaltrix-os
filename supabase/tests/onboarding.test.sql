-- DB tests for: admin_set_business_verified, welcome_email_outbox,
-- business_notifications. Run on a FRESH scratch database (see README).
-- Ends with "ALL ONBOARDING DB TESTS PASSED"; any failure aborts the script.
\set ON_ERROR_STOP on
\set QUIET on

create schema if not exists t;
create or replace function t.ok(cond boolean, msg text) returns void language plpgsql as
$$ begin if cond is not true then raise exception 'FAIL: %', msg; end if; end $$;
-- Run a statement as a role and expect SQLSTATE `code` (e.g. 42501 = permission denied / RLS).
create or replace function t.denied(stmt text, code text, msg text) returns void language plpgsql as
$$ begin
  begin
    execute stmt;
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

-- Fixtures: owners A and B, an admin.
insert into public.profiles (id, role) values
  ('00000000-0000-0000-0000-00000000000a', 'business'),
  ('00000000-0000-0000-0000-00000000000b', 'business'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin');

-- ============================================================================
-- 1. admin_set_business_verified
-- ============================================================================
-- Created the way the app creates it: as the authenticated owner, through RLS.
select t.as_user('00000000-0000-0000-0000-00000000000a');
insert into public.businesses (user_id, business_name, slug)
  values ('00000000-0000-0000-0000-00000000000a', 'Alpha Foods', 'alpha-foods-x1');
select t.as_user('00000000-0000-0000-0000-00000000000b');
insert into public.businesses (user_id, business_name, slug)
  values ('00000000-0000-0000-0000-00000000000b', 'Beta Tailors', 'beta-tailors-x2');
select t.as_root();

-- Root-cause reproduction: a plain admin UPDATE through RLS matches ZERO rows
-- (no error). This is exactly what the old /admin page did.
select t.as_user('00000000-0000-0000-0000-0000000000ad');
do $$
declare n integer;
begin
  update public.businesses set is_verified = true where business_name = 'Alpha Foods';
  get diagnostics n = row_count;
  perform t.ok(n = 0, 'ROOT CAUSE: admin direct UPDATE should hit 0 rows under RLS (got ' || n || ')');
end $$;
select t.as_root();
select t.ok((select not is_verified from public.businesses where business_name = 'Alpha Foods'),
            'row must be unchanged after the old-style admin update');

-- The fix: non-admins and anon cannot use the RPC.
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.denied($$select public.admin_set_business_verified((select id from public.businesses where business_name='Alpha Foods'), true)$$,
                '42501', 'owner must not be able to self-verify via the RPC');
select t.as_user(null);
select t.denied($$select public.admin_set_business_verified(gen_random_uuid(), true)$$,
                '42501', 'anon must not execute the RPC');
select t.as_root();
select t.ok((select not is_verified from public.businesses where business_name = 'Alpha Foods'),
            'still unverified after rejected attempts');

-- Admin can verify; the stored state is what the RPC returns.
select t.as_user('00000000-0000-0000-0000-0000000000ad');
do $$
declare r jsonb; id_a uuid;
begin
  select id into id_a from public.businesses where business_name = 'Alpha Foods';
  r := public.admin_set_business_verified(id_a, true);
  perform t.ok((r->>'is_verified')::boolean is true, 'RPC returns is_verified=true');
  perform t.ok((r->>'trust_score')::int = 50, 'trust score recomputed by the existing trigger (got ' || (r->>'trust_score') || ')');
  perform t.ok((select is_verified from public.businesses where id = id_a), 'row really is verified');
  -- and can unverify
  r := public.admin_set_business_verified(id_a, false);
  perform t.ok((r->>'is_verified')::boolean is false and (r->>'trust_score')::int = 10, 'unverify works and rescoring follows');
  perform public.admin_set_business_verified(id_a, true);
end $$;
select t.denied($$select public.admin_set_business_verified(gen_random_uuid(), true)$$, 'P0002', 'unknown business id');
select t.denied($$select public.admin_set_business_verified(null, true)$$, '22023', 'null id rejected');
select t.denied($$select public.admin_set_business_verified((select id from public.businesses limit 1), null)$$, '22023', 'null flag rejected');
select t.as_root();

-- A non-admin owner still cannot flip is_verified by a direct write (existing trigger, unchanged).
select t.as_user('00000000-0000-0000-0000-00000000000b');
update public.businesses set is_verified = true where business_name = 'Beta Tailors';
select t.as_root();
select t.ok((select not is_verified from public.businesses where business_name = 'Beta Tailors'),
            'owner direct write to is_verified is still neutralised');

-- ============================================================================
-- 2. Welcome email outbox
-- ============================================================================
select t.ok((select count(*) from public.email_deliveries) = 2, 'one outbox row per created business');
select t.ok((select bool_and(status = 'pending' and attempts = 0 and kind = 'welcome') from public.email_deliveries),
            'new rows are pending/0 attempts');
select t.denied($$insert into public.email_deliveries (business_id, kind) select id, 'welcome' from public.businesses limit 1$$,
                '23505', 'UNIQUE(business_id, kind) blocks duplicates');

-- Nobody but the server can touch it.
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.denied($$select * from public.email_deliveries$$, '42501', 'owner cannot read outbox');
select t.denied($$update public.email_deliveries set status = 'sent'$$, '42501', 'owner cannot update outbox');
select t.denied($$insert into public.email_deliveries (business_id, kind) values (gen_random_uuid(), 'welcome')$$, '42501', 'owner cannot insert outbox');
select t.denied($$select * from public.claim_email_delivery(gen_random_uuid(), 'welcome')$$, '42501', 'owner cannot claim');
select t.as_user(null);
select t.denied($$select * from public.email_deliveries$$, '42501', 'anon cannot read outbox');
select t.denied($$select * from public.claim_email_delivery(gen_random_uuid(), 'welcome')$$, '42501', 'anon cannot claim');
select t.as_root();

-- Claim state machine, as service_role.
set role service_role;
do $$
declare bid uuid; c record; n integer;
begin
  select business_id into bid from public.email_deliveries order by created_at limit 1;

  select * into c from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(c.attempts = 1, 'first claim wins with attempts=1');
  select count(*) into n from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(n = 0, 'second claim while sending must lose (no duplicate send)');

  update public.email_deliveries set status = 'failed', last_error = 'resend 500' where id = c.id;
  select count(*) into n from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(n = 0, 'failed row is not retried immediately (backoff)');

  update public.email_deliveries set updated_at = now() - interval '3 minutes' where id = c.id;
  select * into c from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(c.attempts = 2, 'retry allowed after the backoff, attempts=2');

  update public.email_deliveries set status = 'failed', updated_at = now() - interval '3 minutes' where id = c.id;
  select * into c from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(c.attempts = 3, 'third attempt allowed');
  update public.email_deliveries set status = 'failed', updated_at = now() - interval '1 day' where id = c.id;
  select count(*) into n from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(n = 0, 'attempts exhausted: never claimed again');
end $$;
do $$
declare bid uuid; c record; n integer;
begin
  select business_id into bid from public.email_deliveries order by created_at desc limit 1;
  select * into c from public.claim_email_delivery(bid, 'welcome');
  -- crash mid-send: stays "sending"; only reclaimable once stale
  select count(*) into n from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(n = 0, 'fresh claim not stealable');
  update public.email_deliveries set claimed_at = now() - interval '11 minutes' where id = c.id;
  select * into c from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(c.attempts = 2, 'stale claim (crashed request) is recoverable');
  update public.email_deliveries set status = 'sent', sent_at = now() where id = c.id;
  select count(*) into n from public.claim_email_delivery(bid, 'welcome');
  perform t.ok(n = 0, 'sent rows are never claimable again');
  select count(*) into n from public.claim_email_delivery(gen_random_uuid(), 'welcome');
  perform t.ok(n = 0, 'unknown business (pre-feature) yields no claim: no retroactive welcome');
end $$;
reset role;

-- Bookkeeping failure must not break registration.
do $$
begin
  alter table public.email_deliveries rename to email_deliveries_off;
  insert into public.businesses (user_id, business_name, slug)
    values ('00000000-0000-0000-0000-0000000000c1', 'Resilient Co', 'resilient-co-x3');
  alter table public.email_deliveries_off rename to email_deliveries;
  perform t.ok(exists (select 1 from public.businesses where business_name = 'Resilient Co'),
               'business insert survives an outbox failure');
end $$;

-- ============================================================================
-- 3. Notifications
-- ============================================================================
create temp table ids as
  select (select id from public.businesses where business_name = 'Alpha Foods') as a,
         (select id from public.businesses where business_name = 'Beta Tailors') as b;
grant select on ids to public;

-- Messages
insert into public.messages (business_id, sender_name, sender_phone, content)
  select a, E'Ada\n  Obi', '0801', E'Do you   deliver to\nLekki?' from ids;
select t.ok((select count(*) from public.notifications n, ids where n.business_id = ids.a and n.type = 'new_message') = 1,
            'message creates one notification');
select t.ok((select title = 'New message from Ada Obi' and body = 'Do you deliver to Lekki?' and href = '/dashboard?tab=inbox'
               from public.notifications where type = 'new_message'),
            'message notification text/href; whitespace collapsed');
-- hostile name is stored as inert text, length capped
insert into public.messages (business_id, sender_name, content)
  select a, '<img src=x onerror=alert(1)>' || repeat('z', 500), repeat('m', 5000) from ids;
select t.ok((select max(char_length(title)) <= 120 and max(char_length(body)) <= 100 from public.notifications where type = 'new_message'),
            'user text is length-capped');

-- Reviews + moderation
insert into public.reviews (business_id, reviewer_name, rating, comment)
  select a, 'Chidi', 5, 'Great jollof' from ids;
select t.ok((select title = 'New 5-star review from Chidi' and href = '/business/alpha-foods-x1'
               from public.notifications where type = 'new_review'), 'review notification + public-page href');
update public.reviews set comment = 'edited' where reviewer_name = 'Chidi';
select t.ok((select count(*) from public.notifications where type in ('review_flagged', 'review_removed')) = 0,
            'non-moderation update creates nothing');
update public.reviews set moderation_status = 'flagged' where reviewer_name = 'Chidi';
select t.ok((select count(*) from public.notifications where type = 'review_flagged') = 1, 'flag notifies');
update public.reviews set moderation_status = 'published' where reviewer_name = 'Chidi';
select t.ok((select count(*) from public.notifications where type in ('review_removed')) = 0, 'dismissal notifies nothing');
update public.reviews set moderation_status = 'removed' where reviewer_name = 'Chidi';
select t.ok((select count(*) from public.notifications where type = 'review_removed') = 1, 'removal notifies');

-- Verification (Alpha is verified by section 1 -> granted already exists once)
select t.ok((select count(*) from public.notifications n, ids where n.business_id = ids.a and n.type = 'verification_granted') >= 1,
            'verification via the RPC notified the owner');
select t.ok((select count(*) from public.notifications n, ids where n.business_id = ids.b and n.type like 'verification%') = 0,
            'a blocked self-verify attempt creates no notification');
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select public.admin_set_business_verified((select a from ids), false);
select t.as_root();
select t.ok((select count(*) from public.notifications n, ids where n.business_id = ids.a and n.type = 'verification_removed') = 2,
            'unverify notifies (section 1 toggled once already, so 2 total)');
select t.ok((select href from public.notifications where type = 'verification_removed' limit 1) = '/dashboard/feedback', 'removal points at feedback');
update public.businesses set business_name = 'Alpha Foods' where id = (select a from ids);  -- touch: no is_verified change
select t.ok((select count(*) from public.notifications n, ids where n.business_id = ids.a and n.type like 'verification%') = 4,
            'unrelated business updates (e.g. trust-score touches) create nothing');

-- Subscriptions
insert into public.subscriptions (business_id, plan, status, trial_started_at, expires_at)
  select a, 'pro', 'trialing', now() - interval '28 days', now() + interval '2 days' from ids;
select t.ok((select count(*) from public.notifications where type in ('plan_activated', 'trial_ended')) = 0, 'trial provisioning notifies nothing');
select public.notify_trials_ending();
select public.notify_trials_ending();
select t.ok((select count(*) from public.notifications where type = 'trial_ending') = 1, 'trial_ending: once, idempotent across sweeps');
insert into public.subscriptions (business_id, plan, status, trial_started_at, expires_at)
  select b, 'pro', 'trialing', now() - interval '5 days', now() + interval '25 days' from ids;
select public.notify_trials_ending();
select t.ok((select count(*) from public.notifications n, ids where n.business_id = ids.b and n.type = 'trial_ending') = 0, 'trial far from ending: no notice');
-- cron-style lapse
update public.subscriptions set plan = 'free', status = 'active' where business_id = (select a from ids);
select t.ok((select count(*) from public.notifications where type = 'trial_ended') = 1, 'lapsed trial notifies once');
-- Paystack webhook style upsert
insert into public.subscriptions (business_id, plan, status, paystack_reference, expires_at)
  select b, 'growth', 'active', 'ref_001', now() + interval '1 month' from ids
  on conflict (business_id) do update set plan = excluded.plan, status = excluded.status,
    paystack_reference = excluded.paystack_reference, expires_at = excluded.expires_at;
select t.ok((select title = 'Payment received: Growth plan is active' and body like 'Active until %' from public.notifications where type = 'plan_activated'),
            'payment notifies with the plan and end date');
insert into public.subscriptions (business_id, plan, status, paystack_reference, expires_at)
  select b, 'growth', 'active', 'ref_001', now() + interval '1 month' from ids
  on conflict (business_id) do update set paystack_reference = excluded.paystack_reference;
select t.ok((select count(*) from public.notifications where type = 'plan_activated') = 1, 'webhook replay of the same reference does not duplicate');
update public.subscriptions set plan = 'free' where business_id = (select b from ids);
select t.ok((select count(*) from public.notifications where type = 'plan_expired') = 1, 'lapsed paid plan notifies');

-- Inventory
insert into public.listings (business_id, name) select a, 'Jollof  Rice' from ids;
insert into public.inventory_items (listing_id, business_id, quantity, low_stock_threshold, unit)
  select l.id, l.business_id, 20, 5, 'pcs' from public.listings l;
select t.ok((select count(*) from public.notifications where type in ('low_stock', 'out_of_stock')) = 0, 'enabling tracking notifies nothing');
update public.inventory_items set quantity = 4;
select t.ok((select title = 'Jollof Rice is running low' and body = '4 pcs left (alert level 5).' and href = '/dashboard?tab=inventory'
               from public.notifications where type = 'low_stock'), 'low-stock text');
update public.inventory_items set quantity = 3;
select t.ok((select count(*) from public.notifications where type = 'low_stock') = 1, 'still low: no second alert');
update public.inventory_items set quantity = 0;
select t.ok((select count(*) from public.notifications where type = 'out_of_stock') = 1, 'out of stock alert');
update public.inventory_items set quantity = 30;   -- restock
update public.inventory_items set quantity = 2;    -- low again, previous alert still unread
select t.ok((select count(*) from public.notifications where type = 'low_stock') = 1, 'bounce while an alert is unread does not spam');
update public.notifications set read_at = now() where type = 'low_stock';
update public.inventory_items set quantity = 30;
update public.inventory_items set quantity = 1;
select t.ok((select count(*) from public.notifications where type = 'low_stock') = 2, 'after reading, a new crossing alerts again');

-- ----- Access control on notifications ---------------------------------------
select t.as_user('00000000-0000-0000-0000-00000000000a');
select t.ok((select count(*) from public.notifications) > 0, 'owner A sees own notifications');
select t.ok((select count(*) from public.notifications n where n.business_id <> (select a from ids)) = 0, 'owner A sees nothing of B');
update public.notifications set read_at = now() where type = 'new_review';
select t.ok((select read_at is not null from public.notifications where type = 'new_review'), 'owner can mark read');
select t.denied($$update public.notifications set title = 'hacked'$$, '42501', 'owner cannot edit title');
select t.denied($$update public.notifications set href = 'https://evil.example'$$, '42501', 'owner cannot edit href');
select t.denied($$delete from public.notifications$$, '42501', 'owner cannot delete');
select t.denied($$insert into public.notifications (business_id, type, title, dedupe_key) select a, 'new_message', 'x', 'k' from ids$$, '42501', 'owner cannot insert');
select t.denied($$select public.push_notification((select a from ids), 'new_message', 't', null, null, 'k2')$$, '42501', 'push_notification not callable as RPC');
select t.as_user('00000000-0000-0000-0000-00000000000b');
select t.ok((select count(*) from public.notifications n where n.business_id = (select a from ids)) = 0, 'owner B cannot see A rows');
do $$
declare n integer;
begin
  update public.notifications set read_at = null where business_id = (select a from ids);
  get diagnostics n = row_count;
  perform t.ok(n = 0, 'owner B cannot touch A rows (0 updated)');
end $$;
select t.as_user(null);
select t.denied($$select * from public.notifications$$, '42501', 'anon has no access');
select t.as_root();

-- DB-level guards
select t.denied($$insert into public.notifications (business_id, type, title, href, dedupe_key) select a, 'new_message', 'x', 'https://evil.example/phish', 'h1' from ids$$,
                '23514', 'external href rejected by CHECK');
select t.denied($$insert into public.notifications (business_id, type, title, href, dedupe_key) select a, 'new_message', 'x', 'javascript:alert(1)', 'h2' from ids$$,
                '23514', 'javascript: href rejected by CHECK');
select t.denied($$insert into public.notifications (business_id, type, title, href, dedupe_key) select a, 'new_message', 'x', '/dashboard/../admin', 'h3' from ids$$,
                '23514', 'path traversal href rejected by CHECK');
select t.denied($$insert into public.notifications (business_id, type, title, dedupe_key) select a, 'made_up', 'x', 'h4' from ids$$,
                '23514', 'unknown type rejected');

-- Notification failure must never break the originating write.
do $$
begin
  alter table public.notifications rename to notifications_off;
  insert into public.messages (business_id, sender_name, content) select a, 'Still works', 'hi' from ids;
  insert into public.reviews (business_id, reviewer_name, rating, comment) select a, 'Still works', 4, 'ok' from ids;
  -- The payment path matters most: a Paystack-style upsert must still land.
  insert into public.subscriptions (business_id, plan, status, paystack_reference, expires_at)
    select a, 'pro', 'active', 'ref_outage', now() + interval '1 month' from ids
    on conflict (business_id) do update set plan = excluded.plan, status = excluded.status,
      paystack_reference = excluded.paystack_reference, expires_at = excluded.expires_at;
  -- ...and so must stock changes and the admin verification toggle.
  update public.inventory_items set quantity = 30;
  update public.inventory_items set quantity = 0;
  alter table public.notifications_off rename to notifications;
  perform t.ok(exists (select 1 from public.messages where sender_name = 'Still works')
           and exists (select 1 from public.reviews where reviewer_name = 'Still works'),
           'message + review inserts survive a notifications outage');
  perform t.ok((select paystack_reference from public.subscriptions where business_id = (select a from ids)) = 'ref_outage',
           'subscription (payment) upsert survives a notifications outage');
  perform t.ok((select quantity from public.inventory_items) = 0, 'stock updates survive a notifications outage');
end $$;
-- Verification toggle with notifications unavailable (rename as owner, call as admin).
alter table public.notifications rename to notifications_off;
select t.as_user('00000000-0000-0000-0000-0000000000ad');
select public.admin_set_business_verified((select a from ids), false);
select t.as_root();
alter table public.notifications_off rename to notifications;
select t.ok(not (select is_verified from public.businesses where id = (select a from ids)),
            'verification toggle survives a notifications outage');

-- Cascade: deleting a business removes its notifications and outbox row.
select t.as_user('00000000-0000-0000-0000-00000000000b');
delete from public.businesses where business_name = 'Beta Tailors';
select t.as_root();
select t.ok((select count(*) from public.notifications n where n.business_id not in (select id from public.businesses)) = 0, 'no orphan notifications');
select t.ok((select count(*) from public.email_deliveries d where d.business_id not in (select id from public.businesses)) = 0, 'no orphan outbox rows');

\echo ALL ONBOARDING DB TESTS PASSED

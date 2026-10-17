-- DB regression tests for admin_delete_business (migration 20261016100000).
-- Run on a scratch DB after the harness + all Oct 15/16 migrations (see README).
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

truncate public.businesses, public.profiles cascade;
insert into public.profiles (id, role) values
  ('d0000000-0000-0000-0000-00000000000a', 'business'),
  ('d0000000-0000-0000-0000-00000000000b', 'business'),
  ('d0000000-0000-0000-0000-0000000000ad', 'admin');

-- Two businesses created the way the app does it (owner, through RLS).
select t.as_user('d0000000-0000-0000-0000-00000000000a');
insert into public.businesses (user_id, business_name, slug) values ('d0000000-0000-0000-0000-00000000000a', 'Doomed Co', 'doomed-co-x1');
select t.as_user('d0000000-0000-0000-0000-00000000000b');
insert into public.businesses (user_id, business_name, slug) values ('d0000000-0000-0000-0000-00000000000b', 'Bystander Ltd', 'bystander-x2');
select t.as_root();

create temp table ids as
  select (select id from public.businesses where slug = 'doomed-co-x1') as doomed,
         (select id from public.businesses where slug = 'bystander-x2') as bystander;
grant select on ids to public;

-- Give both businesses dependants in every harness table that cascades.
insert into public.messages (business_id, sender_name, content) select doomed, 'A', 'hi' from ids union all select bystander, 'B', 'hi' from ids;
insert into public.reviews (business_id, reviewer_name, rating, comment) select doomed, 'A', 5, 'x' from ids union all select bystander, 'B', 4, 'y' from ids;
insert into public.subscriptions (business_id, plan, status, expires_at) select doomed, 'pro', 'trialing', now() + interval '10 days' from ids union all select bystander, 'pro', 'trialing', now() + interval '10 days' from ids;
insert into public.listings (business_id, name) select doomed, 'Item D' from ids union all select bystander, 'Item B' from ids;
insert into public.inventory_items (listing_id, business_id, quantity) select l.id, l.business_id, 5 from public.listings l;
insert into public.feedback (business_id, message) select doomed, 'keep me' from ids;
insert into public.inventory_movements (business_id, listing_id, product_name, movement_type, quantity_change)
  select l.business_id, l.id, l.name, 'opening', 5 from public.listings l;
-- Sanity: the append-only guard really is active in this harness (a direct delete is refused).
select t.denied($$delete from public.inventory_movements$$, '42501', 'guard refuses a direct delete of stock history');
select t.ok((select count(*) from public.notifications n, ids where n.business_id = ids.doomed) > 0, 'fixture: doomed business has notifications');
select t.ok((select count(*) from public.email_deliveries e, ids where e.business_id = ids.doomed) = 1, 'fixture: doomed business has an outbox row');

-- ROOT CAUSE reproduced: an admin's direct DELETE under RLS matches ZERO rows, no error.
select t.as_user('d0000000-0000-0000-0000-0000000000ad');
do $$
declare n integer;
begin
  delete from public.businesses where slug = 'doomed-co-x1';
  get diagnostics n = row_count;
  perform t.ok(n = 0, 'ROOT CAUSE: admin direct DELETE should hit 0 rows under RLS (got ' || n || ')');
end $$;
select t.as_root();
select t.ok(exists (select 1 from public.businesses where slug = 'doomed-co-x1'), 'business still exists after the old-style admin delete');

-- Who may NOT use the function.
select t.as_user('d0000000-0000-0000-0000-00000000000b');   -- another owner
select t.denied($$select public.admin_delete_business((select doomed from ids))$$, '42501', 'a different owner cannot delete');
select t.as_user('d0000000-0000-0000-0000-00000000000a');   -- the owner themself: not via the admin function
select t.denied($$select public.admin_delete_business((select doomed from ids))$$, '42501', 'the admin function is admin-only, even for the owner');
select t.as_user(null);
select t.denied($$select public.admin_delete_business((select doomed from ids))$$, '42501', 'anon cannot delete');
select t.as_root();
select t.ok(exists (select 1 from public.businesses where slug = 'doomed-co-x1'), 'still exists after rejected attempts');

-- Argument validation (as admin).
select t.as_user('d0000000-0000-0000-0000-0000000000ad');
select t.denied($$select public.admin_delete_business(null)$$, '22023', 'null id rejected');
select t.denied($$select public.admin_delete_business(gen_random_uuid())$$, 'P0002', 'unknown id raises instead of silently succeeding');
select t.as_root();
select t.ok((select count(*) from public.businesses) = 2, 'failed attempts deleted nothing');

-- The real delete.
select t.as_user('d0000000-0000-0000-0000-0000000000ad');
do $$
declare r jsonb; d uuid;
begin
  select doomed into d from ids;
  r := public.admin_delete_business(d);
  perform t.ok((r->>'id')::uuid = d and r->>'business_name' = 'Doomed Co', 'returns the id and name of what it deleted');
end $$;
select t.as_root();
select t.ok(not exists (select 1 from public.businesses where slug = 'doomed-co-x1'), 'business is really gone');

-- Cascades: everything belonging to the deleted business is gone...
select t.ok((select count(*) from public.messages        m, ids where m.business_id = ids.doomed) = 0, 'messages cascaded');
select t.ok((select count(*) from public.reviews         r, ids where r.business_id = ids.doomed) = 0, 'reviews cascaded');
select t.ok((select count(*) from public.subscriptions   s, ids where s.business_id = ids.doomed) = 0, 'subscription cascaded');
select t.ok((select count(*) from public.listings        l, ids where l.business_id = ids.doomed) = 0, 'listings cascaded');
select t.ok((select count(*) from public.inventory_items i, ids where i.business_id = ids.doomed) = 0, 'inventory cascaded');
select t.ok((select count(*) from public.inventory_movements v, ids where v.business_id = ids.doomed) = 0, 'REGRESSION GUARD: append-only stock history does not block deleting a business');
select t.ok((select count(*) from public.notifications   n, ids where n.business_id = ids.doomed) = 0, 'notifications cascaded');
select t.ok((select count(*) from public.email_deliveries e, ids where e.business_id = ids.doomed) = 0, 'outbox row cascaded');
-- ...feedback is kept, detached...
select t.ok((select count(*) from public.feedback where message = 'keep me' and business_id is null) = 1, 'feedback kept with business_id set null');
-- ...and the other business is untouched.
select t.ok(exists (select 1 from public.businesses b, ids where b.id = ids.bystander), 'other business untouched');
select t.ok((select count(*) from public.messages m, ids where m.business_id = ids.bystander) = 1
        and (select count(*) from public.reviews r, ids where r.business_id = ids.bystander) = 1
        and (select count(*) from public.subscriptions s, ids where s.business_id = ids.bystander) = 1
        and (select count(*) from public.inventory_items i, ids where i.business_id = ids.bystander) = 1
        and (select count(*) from public.inventory_movements v, ids where v.business_id = ids.bystander) = 1
        and (select count(*) from public.notifications n, ids where n.business_id = ids.bystander) > 0,
        'other business keeps all of its data');

-- Deleting again is an error, not a silent success.
select t.as_user('d0000000-0000-0000-0000-0000000000ad');
select t.denied($$select public.admin_delete_business((select doomed from ids))$$, 'P0002', 'second delete of the same id raises');
select t.as_root();

\echo ALL ADMIN DELETE DB TESTS PASSED

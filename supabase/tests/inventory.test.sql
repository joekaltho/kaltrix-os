-- Inventory & Stock Management: database-level tests.
--
-- Run ONLY against a scratch Postgres (never a shared/production database):
--   see supabase/tests/README.md. Requires harness.sql (stand-in for the
-- Supabase auth/roles/listings bits) and the inventory migration to be applied.
-- Every check prints "PASS: ..." or aborts the script with "FAIL: ...".

\set ON_ERROR_STOP on
\set VERBOSITY terse

drop schema if exists kx_test cascade;
create schema kx_test;
grant usage on schema kx_test to anon, authenticated;

create function kx_test.ok(cond boolean, name text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', name; end if;
  raise notice 'PASS: %', name;
end $$;

-- Runs q as the current role; returns the error message (+ "|detail") or '<no error>'.
create function kx_test.err(q text) returns text language plpgsql as $$
declare d text;
begin
  execute q;
  return '<no error>';
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return sqlerrm || coalesce('|' || nullif(d, ''), '');
end $$;

create function kx_test.as_user(u uuid) returns void language plpgsql as $$
begin
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', u::text, true);
end $$;
create function kx_test.as_anon() returns void language plpgsql as $$
begin
  execute 'set local role anon';
  perform set_config('request.jwt.claim.sub', '', true);
end $$;
create function kx_test.as_super() returns void language plpgsql as $$
begin execute 'reset role'; end $$;

grant execute on all functions in schema kx_test to anon, authenticated;

-- Fixtures (as superuser) ----------------------------------------------------------
truncate public.businesses cascade;
insert into public.businesses (id, user_id, business_name) values
  ('b1000000-0000-0000-0000-00000000000a', 'a0000000-0000-0000-0000-00000000000a', 'Biz A'),
  ('b2000000-0000-0000-0000-00000000000b', 'b0000000-0000-0000-0000-00000000000b', 'Biz B');
insert into public.listings (id, business_id, name) values
  ('11000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000a', 'A Widget'),
  ('11000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-00000000000a', 'A Gadget'),
  ('11000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-00000000000a', 'A Service (never tracked)'),
  ('22000000-0000-0000-0000-000000000001', 'b2000000-0000-0000-0000-00000000000b', 'B Widget');
-- a listing with no business (business_id is nullable in production)
insert into public.listings (id, business_id, name) values
  ('33000000-0000-0000-0000-000000000001', null, 'Orphan listing');

-- 1. Direct API writes are impossible ------------------------------------------------
do $$ begin
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  perform kx_test.ok(kx_test.err($q$insert into public.inventory_items (listing_id, business_id, quantity)
    values ('11000000-0000-0000-0000-000000000003','b1000000-0000-0000-0000-00000000000a', 999)$q$) like 'permission denied%',
    'authenticated cannot INSERT inventory_items directly');
  perform kx_test.ok(kx_test.err($q$update public.inventory_items set quantity = 999$q$) like 'permission denied%',
    'authenticated cannot UPDATE inventory_items directly');
  perform kx_test.ok(kx_test.err($q$delete from public.inventory_items$q$) like 'permission denied%',
    'authenticated cannot DELETE inventory_items directly');
  perform kx_test.ok(kx_test.err($q$insert into public.inventory_movements (business_id, product_name, movement_type, quantity_change, balance_before, balance_after, reason, created_by)
    values ('b1000000-0000-0000-0000-00000000000a','x','receipt',1,0,1,'supplier','a0000000-0000-0000-0000-00000000000a')$q$) like 'permission denied%',
    'authenticated cannot INSERT inventory_movements directly');
  perform kx_test.ok(kx_test.err($q$update public.inventory_movements set note = 'x'$q$) like 'permission denied%',
    'authenticated cannot UPDATE inventory_movements');
  perform kx_test.ok(kx_test.err($q$delete from public.inventory_movements$q$) like 'permission denied%',
    'authenticated cannot DELETE inventory_movements');
  perform kx_test.ok(kx_test.err($q$select public.inventory_apply_movement('11000000-0000-0000-0000-000000000001','receipt',1,'supplier',null,null,null,null,null,null)$q$) like 'permission denied%',
    'internal inventory_apply_movement is not callable by authenticated');
  perform kx_test.as_super();
end $$;

-- 2. Anonymous users get nothing ----------------------------------------------------------
do $$ begin
  perform kx_test.as_anon();
  perform kx_test.ok(kx_test.err('select * from public.inventory_items') like 'permission denied%', 'anon cannot read inventory_items');
  perform kx_test.ok(kx_test.err('select * from public.inventory_movements') like 'permission denied%', 'anon cannot read inventory_movements');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001',1)$q$) like 'permission denied%', 'anon cannot call inventory_receive_stock');
  perform kx_test.ok(kx_test.err($q$select public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a')$q$) like 'permission denied%', 'anon cannot call get_inventory_overview');
  perform kx_test.as_super();
  -- authenticated role but no JWT subject
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', '', true);
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001',1)$q$) like 'not_authenticated%', 'no subject -> not_authenticated');
  perform kx_test.as_super();
end $$;

-- 3. Enable tracking, opening balance, history ---------------------------------------------
do $$ declare r jsonb; m record; begin
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  r := public.inventory_enable_tracking('11000000-0000-0000-0000-000000000001', 10, 3, 'pcs', 'open-widget-0001');
  perform kx_test.ok((r->>'quantity')::int = 10 and r->>'stock_status' = 'in_stock' and (r->>'duplicate')::boolean = false, 'enable tracking with opening 10');
  select * into m from public.inventory_movements where listing_id = '11000000-0000-0000-0000-000000000001';
  perform kx_test.ok(m.movement_type = 'opening' and m.balance_before = 0 and m.balance_after = 10 and m.quantity_change = 10
    and m.created_by = 'a0000000-0000-0000-0000-00000000000a' and m.business_id = 'b1000000-0000-0000-0000-00000000000a'
    and m.product_name = 'A Widget', 'opening movement recorded with before/after/user/business/name');
  perform kx_test.ok(kx_test.err($q$select public.inventory_enable_tracking('11000000-0000-0000-0000-000000000001', 5)$q$) like 'already_tracked%', 'cannot enable tracking twice');

  r := public.inventory_enable_tracking('11000000-0000-0000-0000-000000000002', 0);
  perform kx_test.ok((r->>'quantity')::int = 0 and r->>'stock_status' = 'out_of_stock' and r->>'movement_id' is null, 'opening 0 -> out_of_stock, no movement');
  perform kx_test.ok((select count(*) from public.inventory_movements where listing_id = '11000000-0000-0000-0000-000000000002') = 0, 'no fabricated history for opening 0');
  perform kx_test.ok(kx_test.err($q$select public.inventory_enable_tracking('11000000-0000-0000-0000-000000000003', -1)$q$) like 'invalid_quantity%', 'negative opening rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_enable_tracking('11000000-0000-0000-0000-000000000003', 5, -2)$q$) like 'invalid_threshold%', 'negative threshold rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_enable_tracking('11000000-0000-0000-0000-000000000003', 5, 1, repeat('x', 21))$q$) like 'invalid_unit%', 'over-long unit rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_enable_tracking('33000000-0000-0000-0000-000000000001', 5)$q$) like 'not_found%', 'listing without a business cannot be tracked');
  perform kx_test.as_super();
end $$;

-- 4. Receive / issue --------------------------------------------------------------------------
do $$ declare r jsonb; m record; n int; begin
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  r := public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 5, 'supplier', 'Delivery 1', 'INV-77');
  perform kx_test.ok((r->>'quantity')::int = 15, 'receive 5 -> 15');
  select * into m from public.inventory_movements where listing_id = '11000000-0000-0000-0000-000000000001' order by created_at desc, id desc limit 1;
  perform kx_test.ok(m.movement_type = 'receipt' and m.balance_before = 10 and m.balance_after = 15 and m.quantity_change = 5
    and m.note = 'Delivery 1' and m.reference = 'INV-77', 'receipt movement accurate (note + reference)');

  r := public.inventory_issue_stock('11000000-0000-0000-0000-000000000001', 4, 'sale');
  perform kx_test.ok((r->>'quantity')::int = 11, 'issue 4 -> 11');
  select * into m from public.inventory_movements where listing_id = '11000000-0000-0000-0000-000000000001' order by created_at desc, id desc limit 1;
  perform kx_test.ok(m.movement_type = 'issue' and m.quantity_change = -4 and m.balance_before = 15 and m.balance_after = 11, 'issue movement accurate (negative change)');

  select count(*) into n from public.inventory_movements;
  perform kx_test.ok(kx_test.err($q$select public.inventory_issue_stock('11000000-0000-0000-0000-000000000001', 12, 'sale')$q$) = 'insufficient_stock|11', 'issue beyond balance rejected (detail = available)');
  perform kx_test.ok((select quantity from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = 11, 'rejected issue leaves balance untouched');
  perform kx_test.ok((select count(*) from public.inventory_movements) = n, 'rejected issue writes no movement');
  r := public.inventory_issue_stock('11000000-0000-0000-0000-000000000001', 11, 'damaged');
  perform kx_test.ok((r->>'quantity')::int = 0 and r->>'stock_status' = 'out_of_stock', 'issuing the exact balance reaches 0 / out_of_stock');
  perform public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 11, 'customer_return');

  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 0)$q$) like 'invalid_quantity%', 'receive 0 rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', -3)$q$) like 'invalid_quantity%', 'receive negative rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_issue_stock('11000000-0000-0000-0000-000000000001', 0)$q$) like 'invalid_quantity%', 'issue 0 rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_issue_stock('11000000-0000-0000-0000-000000000001', -3)$q$) like 'invalid_quantity%', 'issue negative rejected (cannot be used to receive)');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 10000001)$q$) like 'invalid_quantity%', 'receive above per-movement cap rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', null)$q$) like 'invalid_quantity%', 'receive NULL rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 3000000000)$q$) <> '<no error>', 'bigint-sized input rejected (no matching integer signature)');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', '3000000000'::text::integer)$q$) like '%out of range%', 'integer overflow rejected by the type');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 1, 'sale')$q$) like 'invalid_reason%', 'receive with an issue reason rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_issue_stock('11000000-0000-0000-0000-000000000001', 1, 'supplier')$q$) like 'invalid_reason%', 'issue with a receipt reason rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 1, 'supplier', repeat('n', 501))$q$) like 'invalid_text%', 'note over 500 chars rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 1, 'supplier', null, repeat('r', 101))$q$) like 'invalid_text%', 'reference over 100 chars rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000003', 1)$q$) like 'not_tracked%', 'receive on a product that is not tracked is rejected');
  perform kx_test.as_super();
  -- balance ceiling (superuser seeds a huge balance directly just for this check)
  update public.inventory_items set quantity = 999999999 where listing_id = '11000000-0000-0000-0000-000000000002';
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000002', 2)$q$) like 'quantity_too_large%', 'balance above ceiling rejected');
  perform kx_test.as_super();
  update public.inventory_items set quantity = 0 where listing_id = '11000000-0000-0000-0000-000000000002';
end $$;

-- 5. Adjustments ---------------------------------------------------------------------------------
do $$ declare r jsonb; m record; begin
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  r := public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 20, 'stock_count', 'Shelf count', 11);
  perform kx_test.ok((r->>'quantity')::int = 20, 'adjust to counted 20');
  select * into m from public.inventory_movements where listing_id = '11000000-0000-0000-0000-000000000001' order by created_at desc, id desc limit 1;
  perform kx_test.ok(m.movement_type = 'adjustment' and m.balance_before = 11 and m.balance_after = 20 and m.quantity_change = 9 and m.reason = 'stock_count',
    'adjustment keeps previous + resulting balance (not stored as a receipt)');
  r := public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 17, 'damaged', null, 20);
  select * into m from public.inventory_movements where listing_id = '11000000-0000-0000-0000-000000000001' order by created_at desc, id desc limit 1;
  perform kx_test.ok(m.movement_type = 'adjustment' and m.quantity_change = -3 and m.balance_after = 17, 'downward adjustment records a negative change');
  perform kx_test.ok(kx_test.err($q$select public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 17, 'stock_count')$q$) = 'no_change|17', 'adjusting to the same balance is a no_change error');
  perform kx_test.ok(kx_test.err($q$select public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 5, 'stock_count', null, 99)$q$) = 'stale_balance|17', 'stale expected balance refused (detail = current)');
  perform kx_test.ok((select quantity from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = 17, 'stale adjustment leaves balance untouched');
  perform kx_test.ok(kx_test.err($q$select public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 5, 'other')$q$) = 'invalid_text|note_required', 'reason "other" needs a note on adjustments');
  perform kx_test.ok(kx_test.err($q$select public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', -1, 'stock_count')$q$) like 'invalid_quantity%', 'negative counted balance rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 5, 'supplier')$q$) like 'invalid_reason%', 'adjustment with a receipt reason rejected');
  r := public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 0, 'stock_count');
  perform kx_test.ok((r->>'quantity')::int = 0 and r->>'stock_status' = 'out_of_stock', 'adjust to 0 -> out_of_stock');
  perform public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 17, 'correction');
  perform kx_test.as_super();
end $$;

-- 6. Status + threshold rules -------------------------------------------------------------------------
do $$ declare r jsonb; begin
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  -- widget: threshold 3 (set at enable)
  perform public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 4, 'stock_count');
  perform kx_test.ok((select stock_status from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = 'in_stock', 'qty 4 > threshold 3 -> in_stock');
  perform public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 3, 'stock_count');
  perform kx_test.ok((select stock_status from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = 'low_stock', 'qty = threshold -> low_stock');
  perform public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 1, 'stock_count');
  perform kx_test.ok((select stock_status from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = 'low_stock', 'qty 1 <= threshold -> low_stock');
  perform public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 0, 'stock_count');
  perform kx_test.ok((select stock_status from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = 'out_of_stock', 'qty 0 -> out_of_stock');
  perform public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 25, 'stock_count');

  -- no threshold configured: never "low"
  r := public.inventory_update_settings('11000000-0000-0000-0000-000000000001', null, 'pcs');
  perform kx_test.ok(r->>'stock_status' = 'in_stock', 'NULL threshold, qty 25 -> in_stock');
  perform public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 1, 'stock_count');
  perform kx_test.ok((select stock_status from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = 'in_stock', 'NULL threshold, qty 1 -> in_stock (never low)');
  -- threshold 0 behaves like NULL
  r := public.inventory_update_settings('11000000-0000-0000-0000-000000000001', 0, null);
  perform kx_test.ok(r->>'stock_status' = 'in_stock', 'threshold 0, qty 1 -> in_stock');
  -- raising the threshold flips the status without any stock movement
  r := public.inventory_update_settings('11000000-0000-0000-0000-000000000001', 5, 'pcs');
  perform kx_test.ok(r->>'stock_status' = 'low_stock' and (r->>'quantity')::int = 1, 'threshold 5, qty 1 -> low_stock');
  perform kx_test.ok(kx_test.err($q$select public.inventory_update_settings('11000000-0000-0000-0000-000000000001', -1)$q$) like 'invalid_threshold%', 'update_settings rejects negative threshold');
  perform kx_test.ok(kx_test.err($q$select public.inventory_update_settings('11000000-0000-0000-0000-000000000003', 1)$q$) like 'not_tracked%', 'update_settings on untracked product rejected');
  perform public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 25, 'stock_count');
  perform kx_test.as_super();
  perform kx_test.ok((select count(*) from public.inventory_movements where movement_type = 'adjustment' and note is null and reason = 'stock_count') > 0, 'settings changes did not write movements');
end $$;

-- 7. Idempotent submits -----------------------------------------------------------------------------------
do $$ declare r1 jsonb; r2 jsonb; before_qty int; n int; begin
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  select quantity into before_qty from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001';
  select count(*) into n from public.inventory_movements;
  r1 := public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 7, 'supplier', null, null, 'dup-key-000001');
  r2 := public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 7, 'supplier', null, null, 'dup-key-000001');
  perform kx_test.ok((r1->>'duplicate')::boolean = false and (r2->>'duplicate')::boolean = true and r1->>'movement_id' = r2->>'movement_id', 'repeat submit returns the original movement');
  perform kx_test.ok((select quantity from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = before_qty + 7, 'repeat submit applied once');
  perform kx_test.ok((select count(*) from public.inventory_movements) = n + 1, 'repeat submit wrote one movement');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000002', 1, 'supplier', null, null, 'dup-key-000001')$q$) like 'idempotency_key_reused%', 'same key on another product rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_issue_stock('11000000-0000-0000-0000-000000000001', 1, 'sale', null, 'dup-key-000001')$q$) like 'idempotency_key_reused%', 'same key with another movement type rejected');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 1, 'supplier', null, null, 'short')$q$) like 'invalid_idempotency_key%', 'too-short idempotency key rejected');
  perform kx_test.as_super();
end $$;

-- 8. Tenant isolation -----------------------------------------------------------------------------------------
do $$ declare ov jsonb; begin
  -- B has one tracked product of its own
  perform kx_test.as_user('b0000000-0000-0000-0000-00000000000b');
  perform public.inventory_enable_tracking('22000000-0000-0000-0000-000000000001', 4);
  -- B vs A's listing: every write path looks like "not found"
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 1)$q$) like 'not_found%', 'B cannot receive stock on A''s product');
  perform kx_test.ok(kx_test.err($q$select public.inventory_issue_stock('11000000-0000-0000-0000-000000000001', 1)$q$) like 'not_found%', 'B cannot issue stock on A''s product');
  perform kx_test.ok(kx_test.err($q$select public.inventory_adjust_stock('11000000-0000-0000-0000-000000000001', 1, 'stock_count')$q$) like 'not_found%', 'B cannot adjust A''s product');
  perform kx_test.ok(kx_test.err($q$select public.inventory_update_settings('11000000-0000-0000-0000-000000000001', 1)$q$) like 'not_found%', 'B cannot change A''s threshold');
  perform kx_test.ok(kx_test.err($q$select public.inventory_enable_tracking('11000000-0000-0000-0000-000000000003', 1)$q$) like 'not_found%', 'B cannot start tracking A''s product');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock(gen_random_uuid(), 1)$q$) like 'not_found%', 'unknown product id -> same not_found');
  perform kx_test.ok(kx_test.err($q$select public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a')$q$) like 'not_authorized%', 'B cannot read A''s overview by passing A''s business id');
  -- direct reads are RLS-scoped
  perform kx_test.ok((select count(*) from public.inventory_items) = 1 and (select count(*) from public.inventory_items where business_id = 'b1000000-0000-0000-0000-00000000000a') = 0, 'B sees only B''s inventory_items');
  perform kx_test.ok((select count(*) from public.inventory_movements where business_id = 'b1000000-0000-0000-0000-00000000000a') = 0, 'B sees none of A''s movement history');
  perform kx_test.ok((select count(*) from public.inventory_movements where listing_id = '11000000-0000-0000-0000-000000000001') = 0, 'B cannot read A''s product history by listing id');
  ov := public.get_inventory_overview('b2000000-0000-0000-0000-00000000000b');
  perform kx_test.ok((ov->'summary'->>'tracked')::int = 1 and jsonb_array_length(ov->'items') = 1, 'B''s overview contains only B''s data');
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  perform kx_test.ok((select count(*) from public.inventory_items where business_id = 'b2000000-0000-0000-0000-00000000000b') = 0, 'A sees none of B''s inventory');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('22000000-0000-0000-0000-000000000001', 1)$q$) like 'not_found%', 'A cannot touch B''s product');
  perform kx_test.as_super();
  perform kx_test.ok((select quantity from public.inventory_items where listing_id = '22000000-0000-0000-0000-000000000001') = 4, 'B''s balance unchanged by all cross-tenant attempts');
end $$;

-- 9. History is append-only ----------------------------------------------------------------------------------------
do $$ declare id0 uuid; begin
  select id into id0 from public.inventory_movements limit 1;
  perform kx_test.ok(kx_test.err(format($q$update public.inventory_movements set note = 'tamper' where id = %L$q$, id0)) like 'inventory_movements is append-only%', 'even a superuser UPDATE is refused by the guard trigger');
  perform kx_test.ok(kx_test.err(format($q$update public.inventory_movements set balance_after = 1 where id = %L$q$, id0)) like 'inventory_movements is append-only%', 'balance tamper refused');
  perform kx_test.ok(kx_test.err(format($q$delete from public.inventory_movements where id = %L$q$, id0)) like 'inventory_movements is append-only%', 'even a superuser DELETE is refused');
  perform kx_test.ok(kx_test.err(format($q$update public.inventory_movements set listing_id = null where id = %L$q$, id0)) like 'inventory_movements is append-only%', 'manually detaching a movement from its product is refused');
end $$;

-- 10. Atomicity: a failure after the balance update rolls everything back ----------------------------------------------
create function kx_test.boom() returns trigger language plpgsql as $$
begin if new.note = 'FAIL_ME' then raise exception 'boom'; end if; return new; end $$;
create trigger kx_boom before insert on public.inventory_movements for each row execute function kx_test.boom();
do $$ declare q0 int; n0 int; begin
  select quantity into q0 from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001';
  select count(*) into n0 from public.inventory_movements;
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  perform kx_test.ok(kx_test.err($q$select public.inventory_receive_stock('11000000-0000-0000-0000-000000000001', 5, 'supplier', 'FAIL_ME')$q$) like '%boom%', 'movement insert failure surfaces as an error');
  perform kx_test.as_super();
  perform kx_test.ok((select quantity from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001') = q0, 'failed movement insert did not change the balance');
  perform kx_test.ok((select count(*) from public.inventory_movements) = n0, 'no orphaned movement rows');
end $$;
drop trigger kx_boom on public.inventory_movements;

-- 11. Dashboard read model -------------------------------------------------------------------------------------------------
insert into public.listings (id, business_id, name) values
  ('44000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-00000000000a', 'Promo 50% off'),
  ('44000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-00000000000a', 'Promo 500 pack'),
  ('44000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-00000000000a', 'Blue_Shirt'),
  ('44000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-00000000000a', 'BlueXShirt');
do $$ declare ov jsonb; names text; begin
  perform kx_test.as_user('a0000000-0000-0000-0000-00000000000a');
  perform public.inventory_enable_tracking('44000000-0000-0000-0000-000000000001', 2, 5);
  perform public.inventory_enable_tracking('44000000-0000-0000-0000-000000000002', 50, 5);
  perform public.inventory_enable_tracking('44000000-0000-0000-0000-000000000003', 9, 5);
  perform public.inventory_enable_tracking('44000000-0000-0000-0000-000000000004', 0);
  ov := public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a');
  -- tracked: A Widget(25, thr 5 -> in_stock), A Gadget(0 out), Promo 50%(2 low), Promo 500(50 in), Blue_Shirt(9 in), BlueXShirt(0 out)
  perform kx_test.ok(ov->'summary' = '{"tracked":6,"in_stock":3,"low_stock":1,"out_of_stock":2}'::jsonb, 'summary counts match the data: ' || (ov->'summary')::text);
  select string_agg(i->>'name', ', ' order by ord) into names from jsonb_array_elements(ov->'items') with ordinality as t(i, ord);
  perform kx_test.ok(names = 'A Gadget, BlueXShirt, Promo 50% off, A Widget, Blue_Shirt, Promo 500 pack', 'most urgent first (out, low, in), then by name: ' || names);
  perform kx_test.ok((ov->>'untracked_total')::int = 1 and ov->'untracked'->0->>'name' = 'A Service (never tracked)', 'untracked list holds only products without stock tracking');
  ov := public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a', 'out_of_stock');
  perform kx_test.ok((ov->>'total')::int = 2 and jsonb_array_length(ov->'items') = 2, 'status filter out_of_stock');
  ov := public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a', 'low_stock');
  perform kx_test.ok((ov->>'total')::int = 1 and ov->'items'->0->>'name' = 'Promo 50% off', 'status filter low_stock');
  perform kx_test.ok((ov->'summary'->>'tracked')::int = 6, 'summary ignores the filter');
  ov := public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a', null, '50%');
  perform kx_test.ok((ov->>'total')::int = 1 and ov->'items'->0->>'name' = 'Promo 50% off', 'search treats % literally');
  ov := public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a', null, 'blue_s');
  perform kx_test.ok((ov->>'total')::int = 1 and ov->'items'->0->>'name' = 'Blue_Shirt', 'search treats _ literally');
  ov := public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a', null, 'WIDGET');
  perform kx_test.ok((ov->>'total')::int = 1, 'search is case-insensitive');
  ov := public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a', null, null, 2, 2);
  perform kx_test.ok(jsonb_array_length(ov->'items') = 2 and (ov->>'total')::int = 6, 'pagination limit/offset');
  perform kx_test.ok(kx_test.err($q$select public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a', 'bogus')$q$) like 'invalid_status%', 'unknown status filter rejected');
  -- 30-day totals: opening balances and adjustments are not "received"/"issued"
  ov := public.get_inventory_overview('b1000000-0000-0000-0000-00000000000a');
  perform kx_test.ok((ov->'last_30_days'->>'received')::int = (select sum(quantity_change) from public.inventory_movements where business_id = 'b1000000-0000-0000-0000-00000000000a' and movement_type = 'receipt'),
    '30-day received total equals the sum of receipts only');
  perform kx_test.ok((ov->'last_30_days'->>'issued')::int = (select -sum(quantity_change) from public.inventory_movements where business_id = 'b1000000-0000-0000-0000-00000000000a' and movement_type = 'issue'),
    '30-day issued total equals the sum of issues only (as a positive number)');
  perform kx_test.ok((ov->'last_30_days'->>'received')::int > 0 and (ov->'last_30_days'->>'issued')::int > 0, '30-day totals are non-zero in the fixture');
  perform kx_test.as_super();
end $$;

-- 12. Product / business deletion ------------------------------------------------------------------------------------------------
do $$ declare n_before int; n_after int; begin
  select count(*) into n_before from public.inventory_movements where listing_id = '11000000-0000-0000-0000-000000000001';
  delete from public.listings where id = '11000000-0000-0000-0000-000000000001';
  perform kx_test.ok(not exists (select 1 from public.inventory_items where listing_id = '11000000-0000-0000-0000-000000000001'), 'deleting a product removes its live balance row');
  select count(*) into n_after from public.inventory_movements
   where listing_id is null and product_name = 'A Widget';
  perform kx_test.ok(n_after = n_before and n_after > 0, 'deleting a product keeps its history (listing_id NULL, name snapshot kept)');
  delete from public.businesses where id = 'b2000000-0000-0000-0000-00000000000b';
  perform kx_test.ok(not exists (select 1 from public.inventory_items where business_id = 'b2000000-0000-0000-0000-00000000000b')
    and not exists (select 1 from public.inventory_movements where business_id = 'b2000000-0000-0000-0000-00000000000b'), 'deleting a business cascades its inventory and history');
end $$;

-- 13. Ledger integrity over everything this script did ----------------------------------------------------------------------------
do $$ declare bad int; begin
  -- For every still-tracked product: balance == sum of movement changes since an opening of 0
  -- (products enabled with 0 and never moved have no movements: sum 0).
  select count(*) into bad
  from public.inventory_items i
  where i.quantity <> coalesce((select sum(m.quantity_change) from public.inventory_movements m where m.listing_id = i.listing_id), 0);
  perform kx_test.ok(bad = 0, 'every balance equals the sum of its movement history');
  select count(*) into bad from (
    select listing_id, balance_before, lag(balance_after) over (partition by listing_id order by created_at, id) as prev_after
    from public.inventory_movements where listing_id is not null
  ) s where prev_after is not null and prev_after <> balance_before;
  perform kx_test.ok(bad = 0, 'movement chain is continuous (each balance_before == previous balance_after)');
end $$;

\echo ALL INVENTORY DB TESTS PASSED

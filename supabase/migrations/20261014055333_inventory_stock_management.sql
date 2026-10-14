-- Inventory & Stock Management (Oct 2026).
--
-- ADDITIVE ONLY. Creates two new tables and a set of functions. Nothing that
-- exists today is altered: `listings` (the product model), `businesses`,
-- invoices, bookings, revenue calculations and every existing policy/grant are
-- untouched. No stock quantity is invented for any existing listing -- a
-- listing has no inventory row until its owner turns tracking on.
--
-- DESIGN
-- ------
-- * `listings` stays the single product catalog. Stock lives in a separate
--   owner-only table, public.inventory_items (one row per tracked listing),
--   for the same reason business_payment_details is separate: listings has a
--   public SELECT policy, so a stock column there would be world-readable.
-- * The current balance (inventory_items.quantity) and the history
--   (inventory_movements) are only ever written together, inside one
--   function call (= one transaction), by SECURITY DEFINER functions that
--   derive the business from the listing and check auth.uid() ownership
--   themselves. Neither table grants INSERT/UPDATE/DELETE to anon or
--   authenticated, so the API cannot touch them directly.
-- * Concurrency: every mutation takes a per-listing advisory transaction lock
--   and then FOR UPDATE on the balance row, so simultaneous requests are
--   serialised and each one sees the previous one's committed balance.
-- * Duplicate submits: optional client-generated idempotency key, unique per
--   business. A retry with the same key returns the original result and
--   writes nothing.
-- * Whole units only (integer quantities). `listings` has no unit/fraction
--   concept to respect; `unit` below is a display label only.
-- * Never negative: an issue larger than the current balance is rejected.
--   There is no backorder model in KaltrixOS to justify negative stock.
--
-- STOCK STATUS RULE (single source of truth: generated column stock_status)
--   quantity = 0                           -> out_of_stock
--   0 < quantity <= low_stock_threshold    -> low_stock
--   otherwise                              -> in_stock
--   A NULL threshold is treated as 0: such a product is only ever
--   "in stock" or "out of stock" (it never shows as low). The threshold is
--   opt-in per product; nothing is silently defaulted to a non-zero number.
--
-- NOT DONE ON PURPOSE: no automatic deduction from invoices. Invoice items are
-- free-text name/qty/price JSON with no link to a listing, and invoice status
-- (unpaid/paid/overdue) is set by hand -- there is no order/fulfilment/refund
-- lifecycle to make a deduction idempotent against. Stock is manual for now.
--
-- Safe to re-run: IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.
-- See docs/INVENTORY.md.

-- 1. Tables -------------------------------------------------------------------

create table if not exists public.inventory_items (
  listing_id          uuid primary key references public.listings(id) on delete cascade,
  business_id         uuid not null references public.businesses(id) on delete cascade,
  quantity            integer not null default 0,
  low_stock_threshold integer,
  unit                text,
  stock_status        text generated always as (
    case
      when quantity <= 0 then 'out_of_stock'
      when quantity <= coalesce(low_stock_threshold, 0) then 'low_stock'
      else 'in_stock'
    end
  ) stored,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint inventory_items_quantity_chk
    check (quantity between 0 and 1000000000),
  constraint inventory_items_threshold_chk
    check (low_stock_threshold is null or low_stock_threshold between 0 and 1000000000),
  constraint inventory_items_unit_chk
    check (unit is null or char_length(unit) between 1 and 20)
);

create index if not exists inventory_items_business_status_idx
  on public.inventory_items (business_id, stock_status);

create table if not exists public.inventory_movements (
  id              uuid primary key default gen_random_uuid(),
  business_id     uuid not null references public.businesses(id) on delete cascade,
  -- SET NULL (not CASCADE) so deleting a product keeps its history; the name
  -- is snapshotted below so the row stays readable.
  listing_id      uuid references public.listings(id) on delete set null,
  product_name    text not null,
  movement_type   text not null,
  quantity_change integer not null,
  balance_before  integer not null,
  balance_after   integer not null,
  reason          text not null,
  note            text,
  reference       text,
  idempotency_key text,
  created_by      uuid not null,
  created_at      timestamptz not null default now(),
  constraint inventory_movements_type_chk
    check (movement_type in ('opening', 'receipt', 'issue', 'adjustment')),
  constraint inventory_movements_change_chk
    check (quantity_change <> 0),
  constraint inventory_movements_sign_chk check (
    (movement_type in ('opening', 'receipt') and quantity_change > 0) or
    (movement_type = 'issue' and quantity_change < 0) or
    (movement_type = 'adjustment')
  ),
  constraint inventory_movements_balance_chk
    check (balance_before >= 0 and balance_after >= 0
           and balance_after = balance_before + quantity_change),
  constraint inventory_movements_reason_chk check (
    (movement_type = 'opening'    and reason = 'opening_balance') or
    (movement_type = 'receipt'    and reason in ('supplier', 'customer_return', 'other')) or
    (movement_type = 'issue'      and reason in ('sale', 'internal_use', 'damaged', 'other')) or
    (movement_type = 'adjustment' and reason in ('stock_count', 'damaged', 'correction', 'other'))
  ),
  constraint inventory_movements_text_chk check (
    char_length(product_name) between 1 and 300 and
    (note is null or char_length(note) <= 500) and
    (reference is null or char_length(reference) <= 100) and
    (idempotency_key is null or char_length(idempotency_key) between 8 and 100)
  )
);

create index if not exists inventory_movements_business_created_idx
  on public.inventory_movements (business_id, created_at desc, id desc);
create index if not exists inventory_movements_listing_created_idx
  on public.inventory_movements (listing_id, created_at desc, id desc);
create unique index if not exists inventory_movements_idempotency_idx
  on public.inventory_movements (business_id, idempotency_key)
  where idempotency_key is not null;

-- 2. History is append-only -----------------------------------------------------
-- Blocks every UPDATE/DELETE except the two the database itself performs through
-- foreign keys (pg_trigger_depth() > 1 means "fired by another trigger", i.e. the
-- FK action): ON DELETE SET NULL on listing_id when a product is deleted, and
-- ON DELETE CASCADE when the whole business is deleted. Direct statements run
-- at depth 1 and are refused -- even for roles that somehow hold the privilege.
create or replace function public.inventory_movements_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then
      return old;
    end if;
    if tg_op = 'UPDATE'
       and new.listing_id is null and old.listing_id is not null
       and (to_jsonb(new) - 'listing_id') = (to_jsonb(old) - 'listing_id') then
      return new;
    end if;
  end if;
  raise exception 'inventory_movements is append-only' using errcode = '42501';
end;
$$;

revoke execute on function public.inventory_movements_guard() from public, anon, authenticated;

drop trigger if exists inventory_movements_guard_trg on public.inventory_movements;
create trigger inventory_movements_guard_trg
  before update or delete on public.inventory_movements
  for each row execute function public.inventory_movements_guard();

-- 3. RLS + grants ---------------------------------------------------------------
-- Owners can READ their own rows. There is deliberately no INSERT/UPDATE/DELETE
-- policy and no such grant: all writes go through the functions below.
alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

revoke all on table public.inventory_items from anon, authenticated;
revoke all on table public.inventory_movements from anon, authenticated;
grant select on table public.inventory_items to authenticated;
grant select on table public.inventory_movements to authenticated;

drop policy if exists inventory_items_select_own on public.inventory_items;
create policy inventory_items_select_own on public.inventory_items
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = inventory_items.business_id and b.user_id = (select auth.uid())
  ));

drop policy if exists inventory_movements_select_own on public.inventory_movements;
create policy inventory_movements_select_own on public.inventory_movements
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = inventory_movements.business_id and b.user_id = (select auth.uid())
  ));

-- 4. The one internal write path --------------------------------------------------
-- NOT callable from the API (execute revoked below); only the public wrappers
-- in section 5 reach it. Errors are raised as short machine-readable codes
-- (message) with the numbers a UI needs in `detail`:
--   not_authenticated, not_found, invalid_quantity, invalid_reason, invalid_text,
--   invalid_threshold, invalid_unit, invalid_idempotency_key, idempotency_key_reused,
--   already_tracked, not_tracked, insufficient_stock, quantity_too_large,
--   stale_balance, no_change
create or replace function public.inventory_apply_movement(
  p_listing_id      uuid,
  p_type            text,
  p_amount          integer,
  p_reason          text,
  p_note            text,
  p_reference       text,
  p_idempotency_key text,
  p_expected        integer,
  p_threshold       integer,
  p_unit            text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_max_move    constant bigint := 10000000;
  c_max_balance constant bigint := 1000000000;
  c_ctrl        constant text   := '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]';

  v_uid         uuid := auth.uid();
  v_business_id uuid;
  v_name        text;
  v_item        public.inventory_items%rowtype;
  v_existing    public.inventory_movements%rowtype;
  v_note        text;
  v_ref         text;
  v_key         text;
  v_unit        text;
  v_before      bigint;
  v_after       bigint;
  v_change      bigint;
  v_move_id     uuid;
  v_status      text;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Authorise from the database, never from anything the client sent: the
  -- business is whatever business owns this listing, and the caller must own
  -- that business. A missing listing and someone else's listing look identical.
  select l.business_id, l.name
    into v_business_id, v_name
    from public.listings l
    join public.businesses b on b.id = l.business_id
   where l.id = p_listing_id and b.user_id = v_uid;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_type not in ('opening', 'receipt', 'issue', 'adjustment') then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  -- Quantity rules (whole units; zero/negative movements are never valid).
  if p_amount is null then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;
  if p_type in ('receipt', 'issue') and (p_amount < 1 or p_amount > c_max_move) then
    raise exception 'invalid_quantity' using errcode = 'P0001', detail = c_max_move::text;
  end if;
  if p_type in ('opening', 'adjustment') and (p_amount < 0 or p_amount > c_max_balance) then
    raise exception 'invalid_quantity' using errcode = 'P0001', detail = c_max_balance::text;
  end if;

  -- Reason must match the movement type.
  if not (
    (p_type = 'opening'    and p_reason = 'opening_balance') or
    (p_type = 'receipt'    and p_reason in ('supplier', 'customer_return', 'other')) or
    (p_type = 'issue'      and p_reason in ('sale', 'internal_use', 'damaged', 'other')) or
    (p_type = 'adjustment' and p_reason in ('stock_count', 'damaged', 'correction', 'other'))
  ) then
    raise exception 'invalid_reason' using errcode = 'P0001';
  end if;

  v_note := nullif(btrim(regexp_replace(coalesce(p_note, ''), c_ctrl, '', 'g')), '');
  v_ref  := nullif(btrim(regexp_replace(coalesce(p_reference, ''), c_ctrl, '', 'g')), '');
  if char_length(coalesce(v_note, '')) > 500 or char_length(coalesce(v_ref, '')) > 100 then
    raise exception 'invalid_text' using errcode = 'P0001';
  end if;
  -- Adjustments are corrections of the record; they need a stated reason, and
  -- "other" must be explained.
  if p_type = 'adjustment' and p_reason = 'other' and v_note is null then
    raise exception 'invalid_text' using errcode = 'P0001', detail = 'note_required';
  end if;

  v_key := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  if v_key is not null and char_length(v_key) not between 8 and 100 then
    raise exception 'invalid_idempotency_key' using errcode = 'P0001';
  end if;

  if p_type = 'opening' then
    if p_threshold is not null and (p_threshold < 0 or p_threshold > c_max_balance) then
      raise exception 'invalid_threshold' using errcode = 'P0001';
    end if;
    v_unit := nullif(btrim(regexp_replace(coalesce(p_unit, ''), c_ctrl, '', 'g')), '');
    if v_unit is not null and char_length(v_unit) > 20 then
      raise exception 'invalid_unit' using errcode = 'P0001';
    end if;
  end if;

  -- Serialise everything that touches this product's stock. Held to the end of
  -- the transaction. Taken BEFORE the idempotency check so two simultaneous
  -- submits of the same key cannot both pass it.
  perform pg_advisory_xact_lock(hashtextextended('inventory:' || p_listing_id::text, 0));

  if v_key is not null then
    select * into v_existing
      from public.inventory_movements
     where business_id = v_business_id and idempotency_key = v_key;
    if found then
      if v_existing.listing_id is distinct from p_listing_id
         or v_existing.movement_type <> p_type then
        raise exception 'idempotency_key_reused' using errcode = 'P0001';
      end if;
      select * into v_item from public.inventory_items where listing_id = p_listing_id;
      return jsonb_build_object(
        'movement_id', v_existing.id,
        'quantity', v_item.quantity,
        'stock_status', v_item.stock_status,
        'duplicate', true
      );
    end if;
  end if;

  select * into v_item
    from public.inventory_items
   where listing_id = p_listing_id
     for update;

  if p_type = 'opening' then
    if found then
      raise exception 'already_tracked' using errcode = 'P0001';
    end if;
    v_before := 0;
  else
    if not found then
      raise exception 'not_tracked' using errcode = 'P0001';
    end if;
    v_before := v_item.quantity;
  end if;

  if p_type = 'receipt' then
    v_change := p_amount;
    v_after  := v_before + v_change;
    if v_after > c_max_balance then
      raise exception 'quantity_too_large' using errcode = 'P0001', detail = c_max_balance::text;
    end if;
  elsif p_type = 'issue' then
    v_change := -p_amount;
    v_after  := v_before + v_change;
    if v_after < 0 then
      raise exception 'insufficient_stock' using errcode = 'P0001', detail = v_before::text;
    end if;
  elsif p_type = 'adjustment' then
    -- p_amount is the counted balance. If the caller says what balance it was
    -- looking at and it has since moved, refuse instead of overwriting.
    if p_expected is not null and p_expected <> v_before then
      raise exception 'stale_balance' using errcode = 'P0001', detail = v_before::text;
    end if;
    v_after  := p_amount;
    v_change := v_after - v_before;
    if v_change = 0 then
      raise exception 'no_change' using errcode = 'P0001', detail = v_before::text;
    end if;
  else -- opening
    v_after  := p_amount;
    v_change := v_after;
  end if;

  if p_type = 'opening' then
    insert into public.inventory_items (listing_id, business_id, quantity, low_stock_threshold, unit)
    values (p_listing_id, v_business_id, v_after::integer, p_threshold, v_unit);
  else
    update public.inventory_items
       set quantity = v_after::integer, updated_at = clock_timestamp()
     where listing_id = p_listing_id;
  end if;

  -- An opening balance of 0 is "tracking started, nothing on hand": there is no
  -- movement to record, so none is invented.
  if v_change <> 0 then
    -- created_at is clock_timestamp(), NOT the column default now(): now() is the
    -- time the transaction STARTED, so a request that queued behind the lock would
    -- be stamped earlier than the request it actually ran after, and the history
    -- would read out of order. This insert runs inside the per-product lock, so
    -- clock_timestamp() is strictly increasing per product.
    insert into public.inventory_movements (
      business_id, listing_id, product_name, movement_type, quantity_change,
      balance_before, balance_after, reason, note, reference, idempotency_key,
      created_by, created_at
    ) values (
      v_business_id, p_listing_id, left(v_name, 300), p_type, v_change::integer,
      v_before::integer, v_after::integer, p_reason, v_note, v_ref, v_key,
      v_uid, clock_timestamp()
    )
    returning id into v_move_id;
  end if;

  select stock_status into v_status from public.inventory_items where listing_id = p_listing_id;

  return jsonb_build_object(
    'movement_id', v_move_id,
    'quantity', v_after,
    'stock_status', v_status,
    'duplicate', false
  );
end;
$$;

revoke all on function public.inventory_apply_movement(
  uuid, text, integer, text, text, text, text, integer, integer, text
) from public, anon, authenticated;

-- 5. Public RPCs (what the app calls) -----------------------------------------------

create or replace function public.inventory_enable_tracking(
  p_listing_id        uuid,
  p_opening_quantity  integer default 0,
  p_low_stock_threshold integer default null,
  p_unit              text default null,
  p_idempotency_key   text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.inventory_apply_movement(
    p_listing_id, 'opening', coalesce(p_opening_quantity, 0), 'opening_balance',
    null, null, p_idempotency_key, null, p_low_stock_threshold, p_unit
  );
$$;

create or replace function public.inventory_receive_stock(
  p_listing_id      uuid,
  p_quantity        integer,
  p_reason          text default 'supplier',
  p_note            text default null,
  p_reference       text default null,
  p_idempotency_key text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.inventory_apply_movement(
    p_listing_id, 'receipt', p_quantity, p_reason,
    p_note, p_reference, p_idempotency_key, null, null, null
  );
$$;

create or replace function public.inventory_issue_stock(
  p_listing_id      uuid,
  p_quantity        integer,
  p_reason          text default 'sale',
  p_note            text default null,
  p_idempotency_key text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.inventory_apply_movement(
    p_listing_id, 'issue', p_quantity, p_reason,
    p_note, null, p_idempotency_key, null, null, null
  );
$$;

-- p_new_quantity is the counted balance. p_expected_quantity (optional) is the
-- balance the user was looking at; if stock moved in the meantime the call is
-- refused with stale_balance rather than silently overwriting the change.
create or replace function public.inventory_adjust_stock(
  p_listing_id        uuid,
  p_new_quantity      integer,
  p_reason            text default 'stock_count',
  p_note              text default null,
  p_expected_quantity integer default null,
  p_idempotency_key   text default null
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select public.inventory_apply_movement(
    p_listing_id, 'adjustment', p_new_quantity, p_reason,
    p_note, null, p_idempotency_key, p_expected_quantity, null, null
  );
$$;

-- Threshold / unit label only. Not a stock change, so no movement is written.
create or replace function public.inventory_update_settings(
  p_listing_id          uuid,
  p_low_stock_threshold integer default null,
  p_unit                text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_unit text;
  v_item public.inventory_items%rowtype;
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  perform 1
     from public.listings l
     join public.businesses b on b.id = l.business_id
    where l.id = p_listing_id and b.user_id = v_uid;
  if not found then
    raise exception 'not_found' using errcode = 'P0002';
  end if;

  if p_low_stock_threshold is not null
     and (p_low_stock_threshold < 0 or p_low_stock_threshold > 1000000000) then
    raise exception 'invalid_threshold' using errcode = 'P0001';
  end if;
  v_unit := nullif(btrim(regexp_replace(coalesce(p_unit, ''), '[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g')), '');
  if v_unit is not null and char_length(v_unit) > 20 then
    raise exception 'invalid_unit' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('inventory:' || p_listing_id::text, 0));

  update public.inventory_items
     set low_stock_threshold = p_low_stock_threshold,
         unit = v_unit,
         updated_at = now()
   where listing_id = p_listing_id
  returning * into v_item;
  if not found then
    raise exception 'not_tracked' using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'quantity', v_item.quantity,
    'stock_status', v_item.stock_status,
    'duplicate', false
  );
end;
$$;

revoke all on function public.inventory_enable_tracking(uuid, integer, integer, text, text)
  from public, anon, authenticated;
revoke all on function public.inventory_receive_stock(uuid, integer, text, text, text, text)
  from public, anon, authenticated;
revoke all on function public.inventory_issue_stock(uuid, integer, text, text, text)
  from public, anon, authenticated;
revoke all on function public.inventory_adjust_stock(uuid, integer, text, text, integer, text)
  from public, anon, authenticated;
revoke all on function public.inventory_update_settings(uuid, integer, text)
  from public, anon, authenticated;

grant execute on function public.inventory_enable_tracking(uuid, integer, integer, text, text) to authenticated;
grant execute on function public.inventory_receive_stock(uuid, integer, text, text, text, text) to authenticated;
grant execute on function public.inventory_issue_stock(uuid, integer, text, text, text) to authenticated;
grant execute on function public.inventory_adjust_stock(uuid, integer, text, text, integer, text) to authenticated;
grant execute on function public.inventory_update_settings(uuid, integer, text) to authenticated;

-- 6. Read model for the dashboard (SECURITY INVOKER: RLS applies) -----------------------
-- One round trip: summary counts, 30-day received/issued totals, one
-- filtered/searched/paged page of tracked products (most urgent first: out of
-- stock, then low, then in stock), and the listings that are not tracked yet. Same ownership pre-check style as
-- get_dashboard_summary(), but it raises instead of returning an error object.
create or replace function public.get_inventory_overview(
  p_business_id uuid,
  p_status      text default null,
  p_search      text default null,
  p_limit       integer default 50,
  p_offset      integer default 0
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_owner   uuid;
  v_search  text;
  v_limit   integer := least(greatest(coalesce(p_limit, 50), 1), 100);
  v_offset  integer := greatest(coalesce(p_offset, 0), 0);
  v_status  text := nullif(p_status, '');
  v_summary jsonb;
  v_items   jsonb;
  v_total   integer;
  v_untracked jsonb;
  v_untracked_total integer;
  v_last_30 jsonb;
begin
  select user_id into v_owner from public.businesses where id = p_business_id;
  if auth.uid() is null or v_owner is null or v_owner <> auth.uid() then
    raise exception 'not_authorized' using errcode = '42501';
  end if;

  if v_status is not null and v_status not in ('in_stock', 'low_stock', 'out_of_stock') then
    raise exception 'invalid_status' using errcode = 'P0001';
  end if;

  v_search := nullif(btrim(left(coalesce(p_search, ''), 100)), '');
  if v_search is not null then
    -- Escape LIKE wildcards so a search for "50%" means the literal text.
    v_search := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  select jsonb_build_object(
    'tracked',      count(*),
    'in_stock',     count(*) filter (where stock_status = 'in_stock'),
    'low_stock',    count(*) filter (where stock_status = 'low_stock'),
    'out_of_stock', count(*) filter (where stock_status = 'out_of_stock')
  ) into v_summary
  from public.inventory_items
  where business_id = p_business_id;

  select count(*) into v_total
  from public.inventory_items i
  join public.listings l on l.id = i.listing_id
  where i.business_id = p_business_id
    and (v_status is null or i.stock_status = v_status)
    and (v_search is null or l.name ilike v_search escape '\');

  select coalesce(jsonb_agg(t order by t.sort_rank, t.lower_name, t.listing_id), '[]'::jsonb)
    into v_items
  from (
    select i.listing_id, l.name, l.image_url, l.is_active,
           i.quantity, i.low_stock_threshold, i.unit, i.stock_status, i.updated_at,
           case i.stock_status when 'out_of_stock' then 0 when 'low_stock' then 1 else 2 end as sort_rank,
           lower(l.name) as lower_name
      from public.inventory_items i
      join public.listings l on l.id = i.listing_id
     where i.business_id = p_business_id
       and (v_status is null or i.stock_status = v_status)
       and (v_search is null or l.name ilike v_search escape '\')
     order by sort_rank, lower_name, i.listing_id
     limit v_limit offset v_offset
  ) t;

  -- "How much have I received / issued?" over the last 30 days. Opening balances
  -- and adjustments are deliberately NOT counted as received/issued: neither is
  -- stock that moved in or out of the business.
  select jsonb_build_object(
    'received',    coalesce(sum(quantity_change) filter (where movement_type = 'receipt'), 0),
    'issued',      coalesce(-sum(quantity_change) filter (where movement_type = 'issue'), 0),
    'adjustments', count(*) filter (where movement_type = 'adjustment')
  ) into v_last_30
  from public.inventory_movements
  where business_id = p_business_id
    and created_at >= now() - interval '30 days';

  select count(*) into v_untracked_total
  from public.listings l
  where l.business_id = p_business_id
    and not exists (select 1 from public.inventory_items i where i.listing_id = l.id);

  select coalesce(jsonb_agg(u order by u.lower_name, u.id), '[]'::jsonb)
    into v_untracked
  from (
    select l.id, l.name, l.is_active, lower(l.name) as lower_name
      from public.listings l
     where l.business_id = p_business_id
       and not exists (select 1 from public.inventory_items i where i.listing_id = l.id)
     order by lower(l.name), l.id
     limit 100
  ) u;

  return jsonb_build_object(
    'summary', v_summary,
    'items', v_items,
    'total', v_total,
    'untracked', v_untracked,
    'untracked_total', v_untracked_total,
    'last_30_days', v_last_30
  );
end;
$$;

revoke all on function public.get_inventory_overview(uuid, text, text, integer, integer) from public, anon;
grant execute on function public.get_inventory_overview(uuid, text, text, integer, integer) to authenticated;

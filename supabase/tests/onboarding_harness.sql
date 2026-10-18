-- Minimal stand-in for the Supabase pieces the Oct 15 2026 migrations
-- (admin_set_business_verified, welcome_email_outbox, business_notifications)
-- depend on. TEST HARNESS ONLY: never applied anywhere real. Table shapes and
-- RLS policies are copied from production (checked against pg_policies on
-- Oct 15 2026).
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;

-- Supabase ships this publication empty on every project (checked in production).
create publication supabase_realtime;

create schema auth;
create function auth.uid() returns uuid language sql stable as
$$ select coalesce(
     nullif(current_setting('request.jwt.claim.sub', true), ''),
     (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
   )::uuid $$;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase's default privileges: every new table/function in public is
-- readable/writable/executable by anon, authenticated and service_role.
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;

create table public.profiles (id uuid primary key, role text not null default 'business');

create function public.is_admin() returns boolean
language sql stable security definer set search_path to 'public' set row_security = off
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create table public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  business_name text,
  industry text, city text, phone text, email text, website_url text,
  address text, description text, logo_url text,
  slug text,
  is_verified boolean not null default false,
  trust_score integer not null default 0,
  trust_signals jsonb,
  created_at timestamptz default now()
);
alter table public.businesses enable row level security;
-- Anonymous visitors (the public profile page) may read only these columns,
-- exactly like 20261002000300 + 20261003000100 in production.
revoke select on public.businesses from anon;
grant select (id, business_name, industry, city, phone, email, website_url, address,
              description, logo_url, trust_score, is_verified, created_at, slug)
  on public.businesses to anon;
create policy businesses_select on public.businesses for select using (true);
create policy businesses_insert on public.businesses for insert with check ((select auth.uid()) = user_id);
create policy businesses_update on public.businesses for update using ((select auth.uid()) = user_id);
create policy businesses_delete on public.businesses for delete using ((select auth.uid()) = user_id);

-- Same gating as protect_business_trust_fields() in 20260909180000_trust_score_v2
-- (score computation stubbed: 10 base + 40 when verified).
create function public.protect_business_trust_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if tg_op = 'INSERT' then new.is_verified := false;
    elsif tg_op = 'UPDATE' then new.is_verified := old.is_verified;
    end if;
  end if;
  new.trust_score := 10 + case when new.is_verified then 40 else 0 end;
  new.trust_signals := jsonb_build_object('stub', true);
  return new;
end $$;
create trigger protect_business_trust_fields_trigger
  before insert or update on public.businesses
  for each row execute function public.protect_business_trust_fields();

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  sender_name text, sender_phone text, content text,
  is_read boolean default false, created_at timestamptz default now());

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  reviewer_name text, rating integer, comment text,
  created_at timestamptz default now(),
  moderation_status text not null default 'published'
    check (moderation_status in ('published', 'flagged', 'removed')));

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid unique references public.businesses(id) on delete cascade,
  plan text, status text, paystack_reference text,
  expires_at timestamptz, trial_started_at timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now());

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null);

-- Same generated-column rule as 20261014055333_inventory_stock_management.
create table public.inventory_items (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  quantity integer not null default 0,
  low_stock_threshold integer,
  unit text,
  stock_status text generated always as (
    case when quantity <= 0 then 'out_of_stock'
         when quantity <= coalesce(low_stock_threshold, 0) then 'low_stock'
         else 'in_stock' end) stored);

-- feedback keeps its row when a business is deleted (FK is SET NULL in production).
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete set null,
  message text);

-- Append-only stock history, copied from 20261014055333_inventory_stock_management
-- (reduced to the columns the tests touch). The guard is the part that matters: it
-- refuses direct UPDATE/DELETE but allows FK cascades (pg_trigger_depth() > 1), so
-- deleting a whole business must still work.
create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  product_name text not null,
  movement_type text not null,
  quantity_change integer not null,
  created_at timestamptz not null default now());

create function public.inventory_movements_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if pg_trigger_depth() > 1 then
    if tg_op = 'DELETE' then return old; end if;
    if tg_op = 'UPDATE'
       and new.listing_id is null and old.listing_id is not null
       and (to_jsonb(new) - 'listing_id') = (to_jsonb(old) - 'listing_id') then
      return new;
    end if;
  end if;
  raise exception 'inventory_movements is append-only' using errcode = '42501';
end $$;
create trigger inventory_movements_guard_trg
  before update or delete on public.inventory_movements
  for each row execute function public.inventory_movements_guard();

-- Production touches the parent business on every review change (trust score
-- recompute), including when a business delete cascades into reviews. Copied from
-- 20260909180000_trust_score_v2 so the cascade path is exercised for real.
create function public.touch_business_trust_score() returns trigger
language plpgsql security definer set search_path = public set row_security = off as $$
declare v_business_id uuid;
begin
  v_business_id := coalesce(new.business_id, old.business_id);
  if v_business_id is not null then
    update public.businesses set id = id where id = v_business_id;
  end if;
  return coalesce(new, old);
end $$;
create trigger touch_trust_score_on_review
  after insert or update or delete on public.reviews
  for each row execute function public.touch_business_trust_score();

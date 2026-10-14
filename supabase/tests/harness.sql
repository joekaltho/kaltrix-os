-- Minimal stand-in for the Supabase pieces the migration depends on.
-- TEST HARNESS ONLY: never applied anywhere real.
-- roles are cluster-wide, so tolerate them already existing
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth;
-- Same definition Supabase ships: read the JWT subject from either GUC form
-- (the SQL tests set request.jwt.claim.sub; PostgREST sets request.jwt.claims).
create function auth.uid() returns uuid language sql stable as
$$ select coalesce(
     nullif(current_setting('request.jwt.claim.sub', true), ''),
     (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
   )::uuid $$;
do $$ begin create role authenticator login noinherit; exception when duplicate_object then null; end $$;
grant anon, authenticated to authenticator;
grant usage on schema auth, public to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
-- Shapes copied from production (businesses subset; listings per 20260809205015)
create table public.businesses (id uuid primary key default gen_random_uuid(), user_id uuid not null, business_name text);
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null, description text, price integer default 0, image_url text,
  is_active boolean default true, created_at timestamptz default timezone('utc'::text, now()));
alter table public.listings enable row level security;
create policy listings_all_own on public.listings for all
  using ((select auth.uid()) = (select b.user_id from public.businesses b where b.id = listings.business_id))
  with check ((select auth.uid()) = (select b.user_id from public.businesses b where b.id = listings.business_id));
create policy listings_public_select on public.listings for select using (is_active = true);

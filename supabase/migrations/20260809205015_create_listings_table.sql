create table public.listings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  name text not null,
  description text,
  price integer default 0,
  image_url text,
  is_active boolean default true,
  created_at timestamptz default timezone('utc'::text, now())
);

create index listings_business_id_idx on public.listings(business_id);

alter table public.listings enable row level security;

create policy "listings_all_own" on public.listings
  for all
  using (auth.uid() = (select businesses.user_id from businesses where businesses.id = listings.business_id))
  with check (auth.uid() = (select businesses.user_id from businesses where businesses.id = listings.business_id));

create policy "listings_public_select" on public.listings
  for select
  using (is_active = true);

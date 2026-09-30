create table if not exists public.rate_limits (
  key          text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 1,
  primary key (key, window_start)
);
create index if not exists rate_limits_window_start_idx on public.rate_limits (window_start);
alter table public.rate_limits enable row level security;
drop policy if exists "rate_limits_no_direct_access" on public.rate_limits;
create policy "rate_limits_no_direct_access" on public.rate_limits for all using (false) with check (false);
revoke all on table public.rate_limits from anon, authenticated;
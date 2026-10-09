-- Product feedback from businesses (signed-in dashboard users) and customers
-- (anyone on the public site). Replaces the waitlist email's feedback ask with
-- a real, in-app channel that Joe reads in /admin.
--
-- Write path: ONLY the server route /api/feedback (service role, rate-limited,
-- validated). anon/authenticated get no INSERT privilege, same pattern as
-- messages / reviews / review_reports (see 20261002000200).
-- Read path: admins only (RLS), via the existing admin dashboard.
--
-- Idempotent: safe to re-run.

create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  source      text not null check (source in ('business', 'customer')),
  kind        text not null check (kind in ('bug', 'idea', 'other')),
  message     text not null check (char_length(message) between 3 and 2000),
  -- Optional way to reply (email or phone). Customers only; businesses are
  -- already identified through business_id.
  contact     text check (contact is null or char_length(contact) <= 254),
  business_id uuid references public.businesses (id) on delete set null,
  status      text not null default 'new' check (status in ('new', 'reviewed', 'done')),
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_at_idx  on public.feedback (created_at desc);
create index if not exists feedback_business_id_idx on public.feedback (business_id);

alter table public.feedback enable row level security;

drop policy if exists feedback_select_admin on public.feedback;
create policy feedback_select_admin on public.feedback
  for select to authenticated
  using ((select public.is_admin()));

drop policy if exists feedback_update_admin on public.feedback;
create policy feedback_update_admin on public.feedback
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- Table grants default to full access for anon/authenticated in Supabase;
-- strip them and give back exactly what the admin UI needs. service_role is
-- untouched, so the server route keeps working.
revoke all on table public.feedback from anon, authenticated;
grant select on table public.feedback to authenticated;
grant update (status) on table public.feedback to authenticated;

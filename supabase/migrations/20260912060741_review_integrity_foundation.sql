-- Review integrity foundation: moderation state, a real report mechanism,
-- and evidence-based integrity signals.
--
-- PROBLEM THIS ADDRESSES
-- -----------------------
-- Reviews today are fully anonymous (reviewer_name/rating/comment only --
-- "Anyone can leave a review" INSERT policy, with_check true, no login,
-- no reviewer identity at all) with zero moderation surface: no report
-- mechanism, no moderation state, nothing to distinguish a real review
-- from a fake one beyond a human reading it.
--
-- This is a FOUNDATION, not a fake-review detector. Per the brief: a
-- suspicious review gets flagged -> reviewed by a human (admin) ->
-- removed/restricted only when appropriate. Nothing here auto-labels a
-- review fake or auto-removes it. A flagged review stays publicly visible
-- (with an "under review" affordance the frontend can render) until an
-- admin actually acts on it.
--
-- WHAT THIS MIGRATION DOES
-- -------------------------
-- 1. reviews: add moderation_status (published/flagged/removed, default
--    published), flagged_reason/flagged_at, moderated_by/moderated_at,
--    plus lightweight, privacy-conscious signal fields captured at
--    submission (reviewer_ip_hash -- sha256, never the raw IP;
--    reviewer_phone/reviewer_email -- both optional, only ever used to
--    check "did this person actually do business with this business"
--    against customers/bookings/invoices; never displayed publicly).
-- 2. protect_review_integrity_fields(): a BEFORE INSERT/UPDATE trigger,
--    same pattern as protect_business_trust_fields() -- a client can never
--    write moderation_status/flagged_*/moderated_* directly (every new
--    review always starts clean at 'published' with no moderation
--    footprint, and only an admin session's UPDATE can move it). This
--    matters because review submission stays public/anonymous by product
--    decision (see reviews_public_insert.sql) -- anyone can still lie
--    about reviewer_name same as before; this only closes the door on a
--    submitter pre-marking their own review as already-reviewed/dismissed.
-- 3. review_reports: a real "Report review" mechanism. Anyone can file a
--    report (same public-insert pattern as reviews/messages). business_id
--    is filled server-side (BEFORE INSERT trigger, copied from the
--    reviewed review) so it can't be spoofed independent of review_id --
--    it exists purely so business owners can see reports on their own
--    reviews without a join. Reports never touch the review directly;
--    they're reviewed by an admin who sets open -> dismissed | upheld.
-- 4. auto_flag_review_on_reports(): AFTER INSERT trigger on review_reports
--    -- once a review accumulates 3+ OPEN reports, flip it from
--    published -> flagged (flag only, never remove). Purely a volume
--    signal for admin attention, not a verdict.
-- 5. compute_review_integrity_signals(review_id): read-only, evidence-based
--    signal computation from data already stored -- no fabricated
--    numbers. Returns open/total report counts, a burst signal (reviews
--    from the same ip_hash across the whole platform in the last 24h),
--    a duplicate-content signal (identical comment text elsewhere), and
--    a verified_interaction signal (reviewer_phone/email matches a real
--    customer/booking/invoice row for this business). This is the
--    building block for surfacing signals in the admin moderation view;
--    it does not itself change moderation_status.
-- 6. SELECT policy on reviews tightens to: published/flagged reviews stay
--    public; removed reviews are visible only to admin or the reviewed
--    business's own owner (so a business can see what was removed and
--    why, same as they already can for their own messages).
--
-- SAFE TO RE-RUN: every statement is CREATE OR REPLACE / DROP IF EXISTS /
-- ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

-- 1. Reviews: moderation + signal-capture columns.
alter table public.reviews
  add column if not exists moderation_status text not null default 'published',
  add column if not exists flagged_reason text,
  add column if not exists flagged_at timestamptz,
  add column if not exists moderated_by uuid references public.profiles(id),
  add column if not exists moderated_at timestamptz,
  add column if not exists reviewer_ip_hash text,
  add column if not exists reviewer_phone text,
  add column if not exists reviewer_email text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'reviews_moderation_status_check'
  ) then
    alter table public.reviews
      add constraint reviews_moderation_status_check
      check (moderation_status in ('published', 'flagged', 'removed'));
  end if;
end $$;

create index if not exists reviews_moderation_status_idx on public.reviews(moderation_status);
create index if not exists reviews_ip_hash_idx on public.reviews(reviewer_ip_hash) where reviewer_ip_hash is not null;
create index if not exists reviews_business_created_idx on public.reviews(business_id, created_at desc);

-- 2. Lock down the moderation/footprint fields -- same pattern as
--    protect_business_trust_fields(). Every INSERT always starts clean;
--    only an admin session's UPDATE can move moderation_status or set the
--    flagged_*/moderated_* fields.
create or replace function public.protect_review_integrity_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.moderation_status := 'published';
    new.flagged_reason := null;
    new.flagged_at := null;
    new.moderated_by := null;
    new.moderated_at := null;
  elsif TG_OP = 'UPDATE' then
    if not public.is_admin() then
      new.moderation_status := old.moderation_status;
      new.flagged_reason := old.flagged_reason;
      new.flagged_at := old.flagged_at;
      new.moderated_by := old.moderated_by;
      new.moderated_at := old.moderated_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_review_integrity_fields_trigger on public.reviews;
create trigger protect_review_integrity_fields_trigger
  before insert or update on public.reviews
  for each row execute function public.protect_review_integrity_fields();

-- 3. Reviews now need an UPDATE policy (there wasn't one at all --
--    moderation was impossible via RLS before this). Admin-only: a
--    business can't unilaterally remove its own bad-but-real reviews.
drop policy if exists "Admins can moderate reviews" on public.reviews;
create policy "Admins can moderate reviews"
  on public.reviews
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- Tighten the public SELECT policy: published/flagged stay visible to
-- everyone (a flag is not a verdict); removed is admin- or
-- business-owner-visible only, same access level they already have for
-- their own messages.
drop policy if exists "Anyone can view reviews" on public.reviews;
create policy "Published and flagged reviews are public"
  on public.reviews
  for select
  using (
    moderation_status <> 'removed'
    or public.is_admin()
    or exists (
      select 1 from public.businesses
      where businesses.id = reviews.business_id and businesses.user_id = auth.uid()
    )
  );

-- 4. Report mechanism.
create table if not exists public.review_reports (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  reason text not null,
  details text,
  reporter_contact text,
  status text not null default 'open',
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'review_reports_reason_check') then
    alter table public.review_reports
      add constraint review_reports_reason_check
      check (reason in ('fake', 'spam', 'self_review', 'offensive', 'irrelevant', 'other'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'review_reports_status_check') then
    alter table public.review_reports
      add constraint review_reports_status_check
      check (status in ('open', 'dismissed', 'upheld'));
  end if;
end $$;

create index if not exists review_reports_review_id_idx on public.review_reports(review_id);
create index if not exists review_reports_business_id_idx on public.review_reports(business_id);
create index if not exists review_reports_status_idx on public.review_reports(status);

alter table public.review_reports enable row level security;

-- business_id is filled server-side from the reviewed review -- never
-- trust a client-sent value here, it's what RLS keys business-owner
-- visibility off of.
create or replace function public.fill_review_report_business_id()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
begin
  select business_id into new.business_id from public.reviews where id = new.review_id;
  if TG_OP = 'INSERT' then
    new.status := 'open';
    new.reviewed_by := null;
    new.reviewed_at := null;
  elsif TG_OP = 'UPDATE' then
    if not public.is_admin() then
      new.status := old.status;
      new.reviewed_by := old.reviewed_by;
      new.reviewed_at := old.reviewed_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists fill_review_report_business_id_trigger on public.review_reports;
create trigger fill_review_report_business_id_trigger
  before insert or update on public.review_reports
  for each row execute function public.fill_review_report_business_id();

drop policy if exists "Anyone can report a review" on public.review_reports;
create policy "Anyone can report a review"
  on public.review_reports
  for insert
  with check (true);

drop policy if exists "Admins can view all reports" on public.review_reports;
create policy "Admins can view all reports"
  on public.review_reports
  for select
  using (public.is_admin());

drop policy if exists "Business owners can view reports on their reviews" on public.review_reports;
create policy "Business owners can view reports on their reviews"
  on public.review_reports
  for select
  using (
    exists (
      select 1 from public.businesses
      where businesses.id = review_reports.business_id and businesses.user_id = auth.uid()
    )
  );

drop policy if exists "Admins can update reports" on public.review_reports;
create policy "Admins can update reports"
  on public.review_reports
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- 5. Volume signal: 3+ OPEN reports on a review flags it (flag only,
--    never removes). Re-running dismissals/uphelds never re-flags --
--    this only fires going 0/1/2 -> 3 open reports.
create or replace function public.auto_flag_review_on_reports()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_open_count int;
begin
  select count(*) into v_open_count
  from public.review_reports
  where review_id = new.review_id and status = 'open';

  if v_open_count >= 3 then
    update public.reviews
      set moderation_status = 'flagged',
          flagged_reason = coalesce(flagged_reason, v_open_count || ' open reports'),
          flagged_at = coalesce(flagged_at, timezone('utc', now()))
      where id = new.review_id and moderation_status = 'published';
  end if;

  return new;
end;
$$;

drop trigger if exists auto_flag_review_on_reports_trigger on public.review_reports;
create trigger auto_flag_review_on_reports_trigger
  after insert on public.review_reports
  for each row execute function public.auto_flag_review_on_reports();

-- 6. Read-only integrity signal computation. Callable by an authenticated
--    admin session from the moderation view; SECURITY DEFINER only to
--    read across reviews/customers/bookings/invoices for the matching
--    check, never to write anything.
create or replace function public.compute_review_integrity_signals(p_review_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_review record;
  v_open_reports int;
  v_total_reports int;
  v_burst_count int;
  v_duplicate_count int;
  v_verified_interaction boolean := false;
begin
  select * into v_review from public.reviews where id = p_review_id;
  if v_review is null then
    return jsonb_build_object('error', 'review not found');
  end if;

  select count(*) filter (where status = 'open'), count(*)
    into v_open_reports, v_total_reports
    from public.review_reports where review_id = p_review_id;

  -- Burst: how many reviews (any business) share this reviewer's ip_hash
  -- in the 24h window around this one -- a real customer leaves one
  -- review; a coordinated campaign leaves many, fast.
  if v_review.reviewer_ip_hash is not null then
    select count(*) into v_burst_count
    from public.reviews
    where reviewer_ip_hash = v_review.reviewer_ip_hash
      and created_at between v_review.created_at - interval '24 hours'
                          and v_review.created_at + interval '24 hours';
  else
    v_burst_count := 0;
  end if;

  -- Duplicate content: identical comment text left elsewhere (copy-paste
  -- review farms tend to reuse text).
  if v_review.comment is not null and length(trim(v_review.comment)) > 0 then
    select count(*) into v_duplicate_count
    from public.reviews
    where id <> p_review_id and comment = v_review.comment;
  else
    v_duplicate_count := 0;
  end if;

  -- Verified interaction: this reviewer's self-reported phone/email
  -- matches a real customer/booking/invoice row for the SAME business --
  -- real evidence the reviewer actually did business here, without
  -- requiring a login.
  if v_review.reviewer_phone is not null or v_review.reviewer_email is not null then
    select exists (
      select 1 from public.customers
      where business_id = v_review.business_id
        and ((v_review.reviewer_phone is not null and phone = v_review.reviewer_phone)
          or (v_review.reviewer_email is not null and email = v_review.reviewer_email))
      union all
      select 1 from public.bookings
      where business_id = v_review.business_id
        and ((v_review.reviewer_phone is not null and customer_phone = v_review.reviewer_phone)
          or (v_review.reviewer_email is not null and customer_email = v_review.reviewer_email))
      union all
      select 1 from public.invoices
      where business_id = v_review.business_id
        and v_review.reviewer_phone is not null and customer_phone = v_review.reviewer_phone
    ) into v_verified_interaction;
  end if;

  return jsonb_build_object(
    'review_id', p_review_id,
    'moderation_status', v_review.moderation_status,
    'open_reports', v_open_reports,
    'total_reports', v_total_reports,
    'burst_count_24h', v_burst_count,
    'duplicate_comment_count', v_duplicate_count,
    'verified_interaction', v_verified_interaction
  );
end;
$$;

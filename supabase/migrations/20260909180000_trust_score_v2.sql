-- TrustScore v2: evidence-based trust engine
--
-- PROBLEM THIS FIXES
-- -------------------
-- trust_score is currently computed client-side (src/lib/trust-score.ts) from
-- pure self-reported profile fields (name length, description length, has a
-- website, has a logo, etc). The client sends that number on every business
-- create/update. A DB trigger (protect_business_trust_fields) already
-- silently ignores that client-sent value for non-admin sessions, which is
-- why trust_score has been stuck at 0 for every business created after that
-- trigger shipped -- except that same trigger lets an ADMIN session write
-- ANY number 1-100 by hand via the admin panel's manual input. Right now the
-- only live business (Kaltrix Ajency) shows "TrustScore: 75" with
-- is_verified = false, zero reviews, zero bookings, zero invoices -- that 75
-- is a number a human typed into a box, not evidence of anything.
--
-- WHAT THIS MIGRATION DOES
-- -------------------------
-- Makes trust_score (and a new trust_signals breakdown) ALWAYS computed by
-- the database, for every INSERT/UPDATE on businesses, from real signals:
--
--   Verified (40 pts max, real evidence)
--     - admin_verified   35 pts  -- human-reviewed via admin panel (kept)
--     - email_verified    5 pts  -- Supabase Auth email confirmation
--
--   Behavioral (45 pts max, earned through real activity)
--     - reviews          20 pts  -- real rows in `reviews`
--     - activity         20 pts  -- real rows in `bookings` + `invoices`
--     - longevity         5 pts  -- time since business was created
--
--   Self-reported (15 pts max, capped low on purpose)
--     - profile          15 pts  -- name/industry/city/phone/website/
--                                    description/logo presence
--
-- Nobody -- including admin -- can hand-type trust_score anymore. is_verified
-- stays admin-only (that's a legitimate human decision, not a fake signal).
-- Reviews/bookings/invoices changing automatically recomputes the owning
-- business's score via small AFTER triggers that "touch" the businesses row.
--
-- SAFE TO RE-RUN: every statement is CREATE OR REPLACE / DROP IF EXISTS.

-- 1. Store the breakdown alongside the score so the UI can render it without
--    extra round trips.
alter table public.businesses
  add column if not exists trust_signals jsonb not null default '[]'::jsonb;

-- 2. Pure computation function. Takes the business's field values directly
--    (not a SELECT against businesses) so it's safe to call from a BEFORE
--    INSERT/UPDATE trigger, where the row being written isn't visible yet
--    via a normal SELECT. It still reads reviews/bookings/invoices/
--    auth.users, which is fine -- those tables aren't the ones being
--    written in the same statement.
create or replace function public.calculate_trust_score_from_fields(
  p_business_id uuid,
  p_user_id uuid,
  p_business_name text,
  p_industry text,
  p_city text,
  p_phone text,
  p_website_url text,
  p_description text,
  p_logo_url text,
  p_is_verified boolean,
  p_created_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_email_confirmed boolean;
  v_review_count int;
  v_avg_rating numeric;
  v_bookings_count int;
  v_invoices_count int;
  v_days_on_platform int;
  v_profile_points int := 0;
  v_profile_max constant int := 15;
  v_verified_points int;
  v_email_points int;
  v_reviews_points int;
  v_activity_points int;
  v_longevity_points int;
  v_total int;
  v_signals jsonb;
begin
  -- Verified: admin decision (real, human-reviewed)
  v_verified_points := case when coalesce(p_is_verified, false) then 35 else 0 end;

  -- Verified: Supabase Auth email confirmation (real, near-universal but real)
  select (email_confirmed_at is not null) into v_email_confirmed
  from auth.users where id = p_user_id;
  v_email_points := case when coalesce(v_email_confirmed, false) then 5 else 0 end;

  -- Behavioral: real customer reviews
  select count(*), coalesce(avg(rating), 0)
    into v_review_count, v_avg_rating
    from public.reviews where business_id = p_business_id;
  v_reviews_points := case
    when v_review_count = 0 then 0
    else least(v_review_count, 10) + round((v_avg_rating / 5.0) * 10)
  end;

  -- Behavioral: real bookings + invoices (legitimate platform usage)
  select count(*) into v_bookings_count from public.bookings where business_id = p_business_id;
  select count(*) into v_invoices_count from public.invoices where business_id = p_business_id;
  v_activity_points := least(v_bookings_count, 10) + least(v_invoices_count, 10);

  -- Behavioral: time on platform, capped at 5 points (~5 months)
  v_days_on_platform := greatest(0, extract(day from now() - coalesce(p_created_at, now()))::int);
  v_longevity_points := least(5, floor(v_days_on_platform / 30.0))::int;

  -- Self-reported: profile completeness. Capped at 15/100 on purpose --
  -- this is the piece the business fully controls, so it must never be
  -- able to carry the score on its own.
  if p_business_name is not null and p_business_name <> '' then v_profile_points := v_profile_points + 2; end if;
  if p_industry is not null and p_industry <> '' then v_profile_points := v_profile_points + 2; end if;
  if p_city is not null and p_city <> '' then v_profile_points := v_profile_points + 2; end if;
  if p_phone is not null and p_phone <> '' then v_profile_points := v_profile_points + 2; end if;
  if p_website_url is not null and p_website_url <> '' then v_profile_points := v_profile_points + 2; end if;
  if p_description is not null and length(p_description) >= 100 then v_profile_points := v_profile_points + 3; end if;
  if p_logo_url is not null and p_logo_url <> '' then v_profile_points := v_profile_points + 2; end if;

  v_total := v_verified_points + v_email_points + v_reviews_points + v_activity_points + v_longevity_points + v_profile_points;
  v_total := greatest(0, least(100, v_total));

  v_signals := jsonb_build_array(
    jsonb_build_object(
      'key', 'admin_verified', 'label', 'Verified by KaltrixOS', 'tier', 'verified',
      'status', case when coalesce(p_is_verified, false) then 'complete' else 'none' end,
      'detail', case when coalesce(p_is_verified, false) then 'Reviewed and verified by our team' else 'Not yet verified' end,
      'points', v_verified_points, 'max_points', 35
    ),
    jsonb_build_object(
      'key', 'email_verified', 'label', 'Email verified', 'tier', 'verified',
      'status', case when coalesce(v_email_confirmed, false) then 'complete' else 'none' end,
      'detail', case when coalesce(v_email_confirmed, false) then 'Email confirmed' else 'Email not confirmed yet' end,
      'points', v_email_points, 'max_points', 5
    ),
    jsonb_build_object(
      'key', 'reviews', 'label', 'Customer reviews', 'tier', 'behavioral',
      'status', case when v_review_count = 0 then 'none' when v_review_count >= 5 then 'complete' else 'partial' end,
      'detail', case when v_review_count = 0 then 'No reviews yet' else v_review_count || ' review(s), ' || round(v_avg_rating, 1) || ' avg rating' end,
      'points', v_reviews_points, 'max_points', 20
    ),
    jsonb_build_object(
      'key', 'activity', 'label', 'Business activity', 'tier', 'behavioral',
      'status', case when (v_bookings_count + v_invoices_count) = 0 then 'none' when (v_bookings_count + v_invoices_count) >= 10 then 'complete' else 'partial' end,
      'detail', case when (v_bookings_count + v_invoices_count) = 0 then 'No bookings or invoices yet' else v_bookings_count || ' booking(s), ' || v_invoices_count || ' invoice(s)' end,
      'points', v_activity_points, 'max_points', 20
    ),
    jsonb_build_object(
      'key', 'longevity', 'label', 'Time on KaltrixOS', 'tier', 'behavioral',
      'status', case when v_longevity_points = 0 then 'none' when v_longevity_points >= 5 then 'complete' else 'partial' end,
      'detail', case when v_days_on_platform < 30 then 'Joined less than a month ago' else (v_days_on_platform / 30) || ' month(s) on KaltrixOS' end,
      'points', v_longevity_points, 'max_points', 5
    ),
    jsonb_build_object(
      'key', 'profile', 'label', 'Profile completeness', 'tier', 'self_reported',
      'status', case when v_profile_points >= v_profile_max then 'complete' when v_profile_points = 0 then 'none' else 'partial' end,
      'detail', v_profile_points || ' of ' || v_profile_max || ' profile details complete',
      'points', v_profile_points, 'max_points', v_profile_max
    )
  );

  return jsonb_build_object('score', v_total, 'signals', v_signals);
end;
$$;

-- 3. Extend the existing trust-field guard: is_verified stays admin-only
--    (unchanged behavior), and trust_score/trust_signals are now ALWAYS
--    system-computed -- nobody, including admin, writes them directly
--    anymore. This replaces the old manual "type a number 1-100" path.
create or replace function public.protect_business_trust_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if auth.uid() is not null and not public.is_admin() then
    if TG_OP = 'INSERT' then
      new.is_verified := false;
    elsif TG_OP = 'UPDATE' then
      new.is_verified := old.is_verified;
    end if;
  end if;

  v_result := public.calculate_trust_score_from_fields(
    new.id, new.user_id, new.business_name, new.industry, new.city, new.phone,
    new.website_url, new.description, new.logo_url, new.is_verified,
    coalesce(new.created_at, now())
  );

  new.trust_score := (v_result->>'score')::int;
  new.trust_signals := v_result->'signals';

  return new;
end;
$$;
-- (trigger protect_business_trust_fields_trigger already points at this
-- function -- no need to recreate it.)

-- 4. Recompute automatically when reviews/bookings/invoices change, by
--    touching the parent business row so the trigger above re-runs.
create or replace function public.touch_business_trust_score()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_business_id uuid;
begin
  v_business_id := coalesce(new.business_id, old.business_id);
  if v_business_id is not null then
    update public.businesses set id = id where id = v_business_id;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists touch_trust_score_on_review on public.reviews;
create trigger touch_trust_score_on_review
  after insert or update or delete on public.reviews
  for each row execute function public.touch_business_trust_score();

drop trigger if exists touch_trust_score_on_booking on public.bookings;
create trigger touch_trust_score_on_booking
  after insert or update or delete on public.bookings
  for each row execute function public.touch_business_trust_score();

drop trigger if exists touch_trust_score_on_invoice on public.invoices;
create trigger touch_trust_score_on_invoice
  after insert or update or delete on public.invoices
  for each row execute function public.touch_business_trust_score();

-- 5. Backfill: recompute every existing business row once so trust_score/
--    trust_signals reflect real evidence immediately (this is what will
--    turn Kaltrix Ajency's 75 into an honest, low, explainable number).
update public.businesses set id = id;

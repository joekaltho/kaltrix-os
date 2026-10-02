-- PHASE B (lockdown) -- apply ONLY AFTER Phase A is applied AND the new code
-- is deployed and verified in production (reviews, messages and reports all
-- submitting through /api/*). Applying this first would break the live forms.
--
-- Closes direct writes through the public Supabase API (anon key) on the four
-- tables. Table grants for anon/authenticated were full (INSERT/UPDATE/DELETE/
-- TRUNCATE), with RLS as the only barrier; this removes the public INSERT
-- policies AND the underlying privileges (defense in depth). service_role is
-- untouched, so the server routes, webhook and admin job keep working.
-- TrustScore logic is not touched.

-- ============ reviews ============
drop policy if exists "Anyone can leave a review" on public.reviews;

revoke all on table public.reviews from anon, authenticated;

-- Public/read access to every column EXCEPT reviewer_phone, reviewer_email and
-- reviewer_ip_hash. (Column list is explicit on purpose: any column added later
-- is private until deliberately granted.)
grant select (id, business_id, reviewer_name, rating, comment, created_at,
              moderation_status, flagged_reason, flagged_at, moderated_by, moderated_at)
  on public.reviews to anon, authenticated;

-- Admin moderation (RLS policy "Admins can moderate reviews" still gates WHO):
-- only the three columns the admin UI actually writes.
grant update (moderation_status, moderated_by, moderated_at)
  on public.reviews to authenticated;

-- ============ review_reports ============
drop policy if exists "Anyone can report a review" on public.review_reports;

revoke all on table public.review_reports from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.review_reports from authenticated;

-- SELECT stays (admins / business owners via existing policies).
-- Admin dismiss/uphold writes exactly these columns.
grant update (status, reviewed_by, reviewed_at)
  on public.review_reports to authenticated;

-- ============ messages ============
drop policy if exists "Anyone can send a message to a business" on public.messages;
-- FOR ALL policy that also let owners insert/update/delete any column. Its
-- SELECT behaviour is duplicated by messages_select_own, which stays.
drop policy if exists "Business owners can view their messages" on public.messages;

revoke all on table public.messages from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.messages from authenticated;

-- Owners can read their inbox (messages_select_own) and may change ONLY is_read
-- (messages_update_own still gates which rows).
grant update (is_read) on public.messages to authenticated;

-- ============ waitlist ============
drop policy if exists "Anyone can join waitlist" on public.waitlist;

revoke all on table public.waitlist from anon;
revoke insert, update, delete, truncate, references, trigger
  on table public.waitlist from authenticated;
-- Admin SELECT policy and the service-role send-waitlist-emails job unchanged.

-- Fix: reviews.INSERT currently requires an authenticated session
-- ("Authenticated users can insert reviews", auth.role() = 'authenticated'),
-- but the review form on the public business page
-- (src/app/(public)/business/[slug]/page.tsx) has no login step at all —
-- it just asks for a name, a star rating, and a comment, the same shape as
-- the "message this business" form, whose INSERT policy is already public
-- ("Anyone can send a message to a business", with_check = true).
--
-- Net effect right now: every real customer who isn't logged into a
-- KaltrixOS *business* account (i.e. nearly everyone submitting a review)
-- gets an RLS rejection on submit. The client code silently swallowed that
-- error and showed a fake success message with a fake review injected into
-- the list — that part is already fixed in the app code (this migration is
-- the other half of the fix).
--
-- Applied to production.
--
-- Safe to re-run.

drop policy if exists "Authenticated users can insert reviews" on public.reviews;

create policy "Anyone can leave a review"
  on public.reviews
  for insert
  with check (true);

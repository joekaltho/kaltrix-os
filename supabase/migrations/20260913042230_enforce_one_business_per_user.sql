-- Found during P1 E2E testing (Sep 12-13, 2026): nothing in the database
-- stopped one user_id from owning more than one business. The only
-- protection was create-business/page.tsx's client-side "check existing
-- business first" query -- a classic check-then-insert race, and no
-- protection at all against a direct API/RLS-level insert.
--
-- This matters because the entire app assumes "one business per user" at
-- the query level: every dashboard/guard/RPC call does
-- `.eq('user_id', user.id).single()` (dashboard/page.tsx, PremiumGuard,
-- ListingCapGuard, getCurrentBusinessAndPlan, admin checks, etc).
-- PostgREST's .single() does not silently pick one row when 2+ match --
-- it errors. Verified this concretely with a test insert: a second
-- businesses row for the same user_id inserted successfully, which would
-- have broken every one of those .single() calls for that account,
-- locking the owner out of their own dashboard with an opaque error.
--
-- Confirmed via `select user_id, count(*) ... having count(*) > 1` that
-- no real production business has this problem today (only my own test
-- duplicate did, since deleted) -- safe to add the constraint now.
--
-- Fix: enforce the invariant the app already assumes, at the database
-- level, so it holds regardless of application-layer bugs, race
-- conditions, or direct API calls -- not just when the client-side check
-- happens to run first.

alter table public.businesses
  add constraint businesses_user_id_key unique (user_id);

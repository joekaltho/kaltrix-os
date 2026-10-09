-- Hardening: trigger-only SECURITY DEFINER functions and plan_has_feature.
--
-- The Supabase security advisor flags 8 SECURITY DEFINER functions in `public`
-- that anon / authenticated can EXECUTE (default PUBLIC execute). Seven of them
-- are trigger functions: nothing calls them as RPC (the app's only .rpc()
-- calls are check_rate_limit, get_business_pulse, submit_review_report), and
-- PostgREST cannot run a trigger function as an RPC anyway. Revoking EXECUTE
-- from public/anon/authenticated closes the advisor finding with no behaviour
-- change: Postgres checks EXECUTE on a trigger function when the trigger is
-- created, not each time it fires, so the triggers keep working for every
-- caller (verified on a scratch database as `authenticated` and as a
-- non-owner role).
--
-- Deliberately NOT changed: public.is_admin(). It is SECURITY DEFINER but only
-- reports whether the *caller* (auth.uid()) is an admin, and RLS policies
-- evaluated as anon/authenticated call it, so it must stay executable.
--
-- Also fixes the mutable search_path on public.plan_has_feature(text, text).
-- Its body references no schema objects, so an empty search_path is safe.
--
-- Idempotent: safe to re-run.

revoke execute on function public.auto_flag_review_on_reports()        from public, anon, authenticated;
revoke execute on function public.fill_review_report_business_id()     from public, anon, authenticated;
revoke execute on function public.handle_new_user()                    from public, anon, authenticated;
revoke execute on function public.protect_business_trust_fields()      from public, anon, authenticated;
revoke execute on function public.protect_profile_role()               from public, anon, authenticated;
revoke execute on function public.protect_review_integrity_fields()    from public, anon, authenticated;
revoke execute on function public.touch_business_trust_score()         from public, anon, authenticated;

alter function public.plan_has_feature(text, text) set search_path = '';

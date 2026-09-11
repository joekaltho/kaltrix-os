-- These three functions are meant to run only as triggers (provision_trial_subscription,
-- protect_subscription_fields) or from the pg_cron job (expire_trial_subscriptions) —
-- none of them are meant to be called directly by a client. By default Postgres/Supabase
-- grants EXECUTE on new public-schema functions to anon/authenticated, which exposes them
-- at /rest/v1/rpc/<fn>. Revoking that doesn't affect trigger firing (trigger invocation
-- doesn't go through the caller's EXECUTE privilege) or the cron job (runs as the job
-- owner), it only closes the direct-RPC path. (Note: handle_new_user, is_admin,
-- protect_business_trust_fields and protect_profile_role have this same RPC exposure
-- pre-existing from before this change — left alone here since fixing those isn't part of
-- this migration's scope, flagged separately.)
revoke execute on function public.provision_trial_subscription() from anon, authenticated, public;
revoke execute on function public.protect_subscription_fields() from anon, authenticated, public;
revoke execute on function public.expire_trial_subscriptions() from anon, authenticated, public;

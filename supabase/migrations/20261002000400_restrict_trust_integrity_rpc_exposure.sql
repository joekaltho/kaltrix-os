-- Captures a change already applied manually in production.
-- Remove SECURITY DEFINER trust/integrity functions from public RPC access;
-- service_role only. Function definitions are unchanged. Idempotent: safe to
-- re-run. anon and authenticated are revoked explicitly so a fresh-database
-- replay cannot inherit default EXECUTE privileges.

revoke execute on function public.calculate_trust_score_from_fields(
  uuid, uuid, text, text, text, text, text, text, text, boolean, timestamptz
) from public, anon, authenticated;

revoke execute on function public.compute_review_integrity_signals(
  uuid
) from public, anon, authenticated;

grant execute on function public.calculate_trust_score_from_fields(
  uuid, uuid, text, text, text, text, text, text, text, boolean, timestamptz
) to service_role;

grant execute on function public.compute_review_integrity_signals(
  uuid
) to service_role;

-- Captures a change already applied manually in production.
-- Restrict anonymous access to public.businesses to an explicit column
-- allowlist. Idempotent: safe to re-run.

revoke all on table public.businesses from anon;

grant select (
  id, business_name, industry, city, phone, website_url, description,
  logo_url, trust_score, is_verified, created_at, slug, payment_instructions
) on table public.businesses to anon;

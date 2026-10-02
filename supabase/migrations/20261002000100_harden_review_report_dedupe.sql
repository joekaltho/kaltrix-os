-- PHASE A (additive, non-breaking) -- apply BEFORE deploying the new code.
-- Adds the one-report-per-visitor-per-review mechanism used by
-- /api/review-reports. Changes nothing about existing tables, policies or
-- grants, so it cannot affect anything live today.

-- Private de-duplication ledger: one row per (review, hashed reporter).
-- RLS on + no policies + all privileges revoked = reachable only by
-- service_role and the SECURITY DEFINER function below.
create table if not exists public.review_report_fingerprints (
  review_id     uuid        not null references public.reviews(id) on delete cascade,
  reporter_hash text        not null,
  created_at    timestamptz not null default timezone('utc', now()),
  primary key (review_id, reporter_hash)
);

alter table public.review_report_fingerprints enable row level security;
revoke all on table public.review_report_fingerprints from anon, authenticated;

-- Atomic: records the fingerprint and the report in ONE transaction, so a
-- failed report can never burn the visitor's one allowed report.
-- Returns 'ok' | 'duplicate' | 'not_found'.
-- The existing triggers on review_reports still fire on the insert below
-- (business_id fill, status forced to 'open', auto-flag at 3+ open reports).
create or replace function public.submit_review_report(
  p_review_id     uuid,
  p_reason        text,
  p_details       text,
  p_reporter_hash text
)
returns text
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_inserted integer;
begin
  if p_reason is null
     or p_reason not in ('fake', 'spam', 'self_review', 'offensive', 'irrelevant', 'other') then
    raise exception 'invalid reason';
  end if;
  if p_reporter_hash is null or length(p_reporter_hash) = 0 then
    raise exception 'invalid reporter hash';
  end if;

  if not exists (select 1 from public.reviews where id = p_review_id) then
    return 'not_found';
  end if;

  insert into public.review_report_fingerprints (review_id, reporter_hash)
  values (p_review_id, p_reporter_hash)
  on conflict do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return 'duplicate';
  end if;

  insert into public.review_reports (review_id, reason, details)
  values (p_review_id, p_reason, nullif(left(p_details, 500), ''));

  return 'ok';
end;
$$;

revoke all on function public.submit_review_report(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.submit_review_report(uuid, text, text, text) to service_role;

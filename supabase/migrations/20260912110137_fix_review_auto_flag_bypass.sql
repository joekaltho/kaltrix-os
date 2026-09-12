-- Bug found during testing of review_integrity_foundation: the auto-flag
-- trigger (auto_flag_review_on_reports, fired when a review hits 3+ open
-- reports) tried to UPDATE reviews.moderation_status to 'flagged', but
-- protect_review_integrity_fields_trigger's UPDATE branch resets that
-- field back to OLD unless public.is_admin() is true. is_admin() checks
-- auth.uid() from the CALLER's session (the person filing the report --
-- usually anonymous), not the SECURITY DEFINER function's owner, so the
-- system's own automated flag was being silently reverted every time.
-- Verified with a manual test: 4 open reports on a test review produced
-- no flag until this fix; a follow-up report after this fix flagged it
-- correctly, and a subsequent non-admin UPDATE attempt to set
-- moderation_status='removed' was still correctly reverted -- confirming
-- the fix only opens a narrow bypass for the system's own trigger, not
-- for arbitrary callers. Test rows were deleted afterward.
--
-- Fix: a transaction-local flag the automated flagger sets right before
-- its own UPDATE, which the protection trigger treats as an explicit,
-- narrow bypass -- alongside is_admin(), never in place of it. This can't
-- be triggered by an ordinary client request (a single INSERT via
-- PostgREST can't first run set_config in the same transaction), so it
-- doesn't reopen the "client can write its own moderation state" gap this
-- trigger exists to close.

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
    if not public.is_admin()
       and coalesce(current_setting('app.system_review_moderation', true), 'false') <> 'true' then
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
    perform set_config('app.system_review_moderation', 'true', true);
    update public.reviews
      set moderation_status = 'flagged',
          flagged_reason = coalesce(flagged_reason, v_open_count || ' open reports'),
          flagged_at = coalesce(flagged_at, timezone('utc', now()))
      where id = new.review_id and moderation_status = 'published';
  end if;

  return new;
end;
$$;

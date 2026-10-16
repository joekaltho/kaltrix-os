-- In-app notifications for business owners.
--
-- DESIGN
--   * One table, public.notifications, per business. Every row is created by
--     the database itself (triggers on the tables where the events already
--     happen), so a notification exists no matter which code path caused the
--     event -- public API routes, the Paystack webhook, the admin page, cron.
--   * Owners can READ their own rows and mark them read (UPDATE read_at only).
--     They cannot insert, delete, or edit any other column: anon/authenticated
--     have no INSERT/DELETE privilege and only column-level UPDATE (read_at).
--   * Notification creation can NEVER block or roll back the event that caused
--     it: every trigger swallows its own errors with a WARNING.
--   * Duplicates are impossible by construction: UNIQUE (business_id,
--     dedupe_key) + ON CONFLICT DO NOTHING.
--   * Text is generated here from fixed templates; user-supplied text (reviewer
--     / sender name, product name, message snippet) is whitespace-collapsed and
--     length-capped, and the UI renders it as plain text. `href` is constrained
--     to in-app paths, so a notification can never carry an external link.
--
-- EVENTS COVERED (all are things the product can actually emit today)
--   new_message           customer sent a message through the public profile
--   new_review            customer left a review
--   review_flagged        a review on the profile was flagged for moderation
--   review_removed        a review was removed from the public profile
--   verification_granted  admin marked the business Verified
--   verification_removed  admin removed Verified status
--   plan_activated        a Paystack payment was recorded for a paid plan
--   trial_ending          30-day Pro trial ends within 3 days (hourly sweep)
--   trial_ended           Pro trial lapsed to the Free plan
--   plan_expired          a paid plan period lapsed to the Free plan
--   low_stock             inventory item crossed its low-stock level
--   out_of_stock          inventory item hit zero
-- Bookings are not an event: the product has no public booking flow, owners
-- create them themselves, so there is nothing inbound to notify about.
--
-- Idempotent: safe to re-run.

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses (id) on delete cascade,
  type        text not null check (type in (
                'new_message', 'new_review', 'review_flagged', 'review_removed',
                'verification_granted', 'verification_removed',
                'plan_activated', 'plan_expired', 'trial_ending', 'trial_ended',
                'low_stock', 'out_of_stock')),
  title       text not null check (char_length(title) between 1 and 120),
  body        text check (body is null or char_length(body) <= 300),
  -- In-app destinations only (a dashboard tab/page or the business's own
  -- public page). Anything else is rejected by the database.
  href        text check (href is null
                or href ~ '^/(dashboard(/[a-z-]+)?(\?tab=[a-z]+)?|business/[A-Za-z0-9_-]+)$'),
  dedupe_key  text not null check (char_length(dedupe_key) between 1 and 200),
  created_at  timestamptz not null default now(),
  read_at     timestamptz,
  unique (business_id, dedupe_key)
);

create index if not exists notifications_business_created_idx
  on public.notifications (business_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (business_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own on public.notifications
  for select to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = notifications.business_id and b.user_id = (select auth.uid())
  ));

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own on public.notifications
  for update to authenticated
  using (exists (
    select 1 from public.businesses b
    where b.id = notifications.business_id and b.user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.businesses b
    where b.id = notifications.business_id and b.user_id = (select auth.uid())
  ));

-- Supabase grants full access to anon/authenticated by default; strip it and
-- give back exactly: read, and mark-as-read.
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

-- Helpers ---------------------------------------------------------------------
-- Collapse whitespace/newlines and cap length for user-supplied text.
create or replace function public.notif_clean(p_text text, p_max integer)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(btrim(regexp_replace(coalesce(p_text, ''), '\s+', ' ', 'g')), p_max)
$$;

create or replace function public.push_notification(
  p_business_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_href text,
  p_dedupe_key text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (business_id, type, title, body, href, dedupe_key)
  values (p_business_id, p_type, p_title, nullif(p_body, ''), p_href, p_dedupe_key)
  on conflict (business_id, dedupe_key) do nothing;
exception when others then
  raise warning 'push_notification(%) failed for business %: %', p_type, p_business_id, sqlerrm;
end;
$$;

-- 1. Customer message ---------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notification(
    new.business_id,
    'new_message',
    'New message from ' || coalesce(nullif(public.notif_clean(new.sender_name, 60), ''), 'a customer'),
    public.notif_clean(new.content, 100),
    '/dashboard?tab=inbox',
    'message:' || new.id
  );
  return new;
exception when others then
  raise warning 'notify_new_message failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists notify_new_message_trigger on public.messages;
create trigger notify_new_message_trigger
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- 2. Customer review ----------------------------------------------------------
create or replace function public.notify_new_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
begin
  select slug into v_slug from public.businesses where id = new.business_id;
  perform public.push_notification(
    new.business_id,
    'new_review',
    'New ' || new.rating || '-star review from '
      || coalesce(nullif(public.notif_clean(new.reviewer_name, 60), ''), 'a customer'),
    public.notif_clean(new.comment, 100),
    case when v_slug ~ '^[A-Za-z0-9_-]+$' then '/business/' || v_slug else '/dashboard' end,
    'review:' || new.id
  );
  return new;
exception when others then
  raise warning 'notify_new_review failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists notify_new_review_trigger on public.reviews;
create trigger notify_new_review_trigger
  after insert on public.reviews
  for each row execute function public.notify_new_review();

-- 3. Review moderation --------------------------------------------------------
create or replace function public.notify_review_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_href text;
begin
  select slug into v_slug from public.businesses where id = new.business_id;
  v_href := case when v_slug ~ '^[A-Za-z0-9_-]+$' then '/business/' || v_slug else '/dashboard' end;

  if new.moderation_status = 'flagged' then
    perform public.push_notification(
      new.business_id, 'review_flagged',
      'A review on your profile was flagged',
      'It stays visible with an "Under review" note until our team decides.',
      v_href,
      'review_flagged:' || new.id || ':' || gen_random_uuid()
    );
  elsif new.moderation_status = 'removed' then
    perform public.push_notification(
      new.business_id, 'review_removed',
      'A review was removed from your profile',
      'Our team removed a review. It no longer shows on your public profile.',
      v_href,
      'review_removed:' || new.id
    );
  end if;
  return new;
exception when others then
  raise warning 'notify_review_moderation failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists notify_review_moderation_trigger on public.reviews;
create trigger notify_review_moderation_trigger
  after update on public.reviews
  for each row
  when (old.moderation_status is distinct from new.moderation_status)
  execute function public.notify_review_moderation();

-- 4. Verification -------------------------------------------------------------
create or replace function public.notify_verification_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_verified is true then
    perform public.push_notification(
      new.id, 'verification_granted',
      'Your business is now Verified',
      'The Verified badge now shows on your public profile.',
      case when new.slug ~ '^[A-Za-z0-9_-]+$' then '/business/' || new.slug else '/dashboard' end,
      'verified:' || gen_random_uuid()
    );
  else
    perform public.push_notification(
      new.id, 'verification_removed',
      'Your Verified status was removed',
      'The badge no longer shows on your public profile. If you think this is a mistake, tell us through Send feedback.',
      '/dashboard/feedback',
      'unverified:' || gen_random_uuid()
    );
  end if;
  return new;
exception when others then
  raise warning 'notify_verification_change failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists notify_verification_change_trigger on public.businesses;
create trigger notify_verification_change_trigger
  after update on public.businesses
  for each row
  when (old.is_verified is distinct from new.is_verified)
  execute function public.notify_verification_change();

-- 5. Subscription / billing ---------------------------------------------------
create or replace function public.notify_subscription_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active'
     and new.plan in ('growth', 'pro')
     and new.paystack_reference is not null
     and (tg_op = 'INSERT' or new.paystack_reference is distinct from old.paystack_reference) then
    perform public.push_notification(
      new.business_id, 'plan_activated',
      'Payment received: ' || initcap(new.plan) || ' plan is active',
      case when new.expires_at is not null
           then 'Active until ' || to_char(new.expires_at at time zone 'Africa/Lagos', 'FMDD FMMon YYYY') || '.'
      end,
      '/dashboard',
      'plan_activated:' || new.paystack_reference
    );
  elsif tg_op = 'UPDATE' and old.status = 'trialing' and new.status = 'active' and new.plan = 'free' then
    perform public.push_notification(
      new.business_id, 'trial_ended',
      'Your Pro trial has ended',
      'You are now on the Free plan. Upgrade to keep Bookings, CRM, Invoices and Business Pulse.',
      '/dashboard/upgrade',
      'trial_ended:' || coalesce(new.trial_started_at::text, new.business_id::text)
    );
  elsif tg_op = 'UPDATE' and old.status = 'active' and old.plan in ('growth', 'pro') and new.plan = 'free' then
    perform public.push_notification(
      new.business_id, 'plan_expired',
      'Your ' || initcap(old.plan) || ' plan has ended',
      'You are now on the Free plan. Choose a plan to get your paid features back.',
      '/dashboard/upgrade',
      'plan_expired:' || coalesce(old.paystack_reference, old.id::text)
    );
  end if;
  return new;
exception when others then
  raise warning 'notify_subscription_change failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists notify_subscription_change_trigger on public.subscriptions;
create trigger notify_subscription_change_trigger
  after insert or update on public.subscriptions
  for each row execute function public.notify_subscription_change();

-- 6. Inventory ----------------------------------------------------------------
-- Fires only when stock_status (a generated column) moves INTO low/out of
-- stock. While an unread alert for the same product + status exists, further
-- crossings are skipped, so an item bouncing around its threshold can't spam.
create or replace function public.notify_stock_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
  v_type text;
begin
  v_type := case new.stock_status when 'out_of_stock' then 'out_of_stock' else 'low_stock' end;

  if exists (
    select 1 from public.notifications n
    where n.business_id = new.business_id
      and n.type = v_type
      and n.read_at is null
      and n.dedupe_key like 'stock:' || new.listing_id || ':%'
  ) then
    return new;
  end if;

  select public.notif_clean(l.name, 60) into v_name from public.listings l where l.id = new.listing_id;
  v_name := coalesce(nullif(v_name, ''), 'A product');

  perform public.push_notification(
    new.business_id,
    v_type,
    case v_type when 'out_of_stock' then v_name || ' is out of stock' else v_name || ' is running low' end,
    case v_type
      when 'out_of_stock' then 'Record new stock in Inventory when it arrives.'
      else new.quantity || coalesce(' ' || nullif(public.notif_clean(new.unit, 20), ''), '') || ' left'
           || case when new.low_stock_threshold is not null
                   then ' (alert level ' || new.low_stock_threshold || ').' else '.' end
    end,
    '/dashboard?tab=inventory',
    'stock:' || new.listing_id || ':' || new.stock_status || ':' || gen_random_uuid()
  );
  return new;
exception when others then
  raise warning 'notify_stock_change failed: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists notify_stock_change_trigger on public.inventory_items;
create trigger notify_stock_change_trigger
  after update on public.inventory_items
  for each row
  when (old.stock_status is distinct from new.stock_status
        and new.stock_status in ('low_stock', 'out_of_stock'))
  execute function public.notify_stock_change();

-- 7. Trial ending soon (time-based, so a sweep rather than a trigger) ----------
-- Same pattern as expire_trial_subscriptions(): a SECURITY DEFINER function
-- run by pg_cron. Idempotent -- one notification per trial, however often it
-- runs.
create or replace function public.notify_trials_ending()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select s.business_id, s.expires_at, s.trial_started_at
      from public.subscriptions s
     where s.status = 'trialing'
       and s.plan = 'pro'
       and s.expires_at is not null
       and s.expires_at > now()
       and s.expires_at <= now() + interval '3 days'
  loop
    perform public.push_notification(
      r.business_id, 'trial_ending',
      'Your Pro trial ends soon',
      'Your trial ends on ' || to_char(r.expires_at at time zone 'Africa/Lagos', 'FMDD FMMon YYYY')
        || '. Choose a plan to keep Bookings, CRM, Invoices and Business Pulse.',
      '/dashboard/upgrade',
      'trial_ending:' || coalesce(r.trial_started_at::text, r.business_id::text)
    );
  end loop;
end;
$$;

-- pg_cron already runs in production (expire-trial-subscriptions); guarded so
-- this file also applies on a database without the extension.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('notify-trials-ending', '17 * * * *', 'select public.notify_trials_ending();');
  end if;
end;
$$;

-- Trigger / sweep / helper functions are never meant to be called as RPC
-- (same hardening as 20261009153208).
revoke execute on function public.notif_clean(text, integer)  from public, anon, authenticated;
revoke execute on function public.push_notification(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.notify_new_message()         from public, anon, authenticated;
revoke execute on function public.notify_new_review()          from public, anon, authenticated;
revoke execute on function public.notify_review_moderation()   from public, anon, authenticated;
revoke execute on function public.notify_verification_change() from public, anon, authenticated;
revoke execute on function public.notify_subscription_change() from public, anon, authenticated;
revoke execute on function public.notify_stock_change()        from public, anon, authenticated;
revoke execute on function public.notify_trials_ending()       from public, anon, authenticated;

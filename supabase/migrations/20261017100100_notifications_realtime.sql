-- Push notifications to the open dashboard instead of polling every minute.
--
-- Supabase Realtime streams row changes for tables that are in the
-- `supabase_realtime` publication (it exists on every project; in this one it is
-- currently empty). Adding `notifications` lets the bell hear about new rows (and
-- reads made in another tab/device) as they happen.
--
-- SECURITY: Realtime applies the table's row-level security per subscriber, using
-- the subscriber's own JWT. The existing `notifications_select_own` policy therefore
-- decides who receives what: an owner is only ever sent their own business's rows,
-- and anonymous clients receive nothing. No new access is granted by this change.
--
-- The app keeps working without this migration: if the subscription is refused it
-- falls back to polling (every 60 s), and with it live polling only runs every 5
-- minutes as a safety net.
--
-- Idempotent (ALTER PUBLICATION ... ADD TABLE errors if already a member).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;

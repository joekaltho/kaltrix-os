create or replace function public.get_dashboard_summary(p_business_id uuid)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_owner uuid;
  v_today date := (now() at time zone 'utc')::date;
begin
  select user_id into v_owner from public.businesses where id = p_business_id;

  if auth.uid() is null or v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  return jsonb_build_object(
    'bookings_total',
      (select count(*) from public.bookings where business_id = p_business_id),
    'bookings_today',
      (select count(*) from public.bookings
        where business_id = p_business_id and booking_date_time::date = v_today),
    'today_preview',
      coalesce((
        select jsonb_agg(t order by t.created_at desc, t.id desc)
        from (
          select id, customer_name, service_description, status, created_at
          from public.bookings
          where business_id = p_business_id and booking_date_time::date = v_today
          order by created_at desc, id desc
          limit 3
        ) t
      ), '[]'::jsonb),
    'customers_total',
      (select count(*) from public.customers where business_id = p_business_id),
    'invoices_total',
      (select count(*) from public.invoices where business_id = p_business_id),
    'invoices_unpaid',
      (select count(*) from public.invoices where business_id = p_business_id and status = 'unpaid'),
    'revenue_paid',
      coalesce((select sum(total) from public.invoices
        where business_id = p_business_id and status = 'paid'), 0),
    'messages_total',
      (select count(*) from public.messages where business_id = p_business_id),
    'messages_unread',
      (select count(*) from public.messages
        where business_id = p_business_id and is_read is not true),
    'revenue_series',
      coalesce((
        select jsonb_agg(t order by t.created_at desc, t.id desc)
        from (
          select id, created_at, total
          from public.invoices
          where business_id = p_business_id and status = 'paid'
          order by created_at desc, id desc
          limit 60
        ) t
      ), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_dashboard_summary(uuid) from public, anon;
grant execute on function public.get_dashboard_summary(uuid) to authenticated;

create or replace function public.get_admin_overview_stats()
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_admin() then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  return jsonb_build_object(
    'total_users', (select count(*) from public.profiles),
    'businesses', (select count(*) from public.businesses),
    'paid_plans', (
      select count(*) from public.subscriptions s
      where (case
        when s.status = 'active' and (s.expires_at is null or s.expires_at > now()) then s.plan
        when s.status = 'trialing' and s.expires_at is not null and s.expires_at > now() then s.plan
        else 'free'
      end) <> 'free'
    ),
    'no_website', (select count(*) from public.businesses where coalesce(website_url, '') = ''),
    'unverified', (select count(*) from public.businesses where is_verified is not true),
    'flagged', (
      select count(*) from public.businesses
      where coalesce(website_url, '') = ''
         or coalesce(trust_score, 0) < 50
         or is_verified is not true
    ),
    'waitlist', (select count(*) from public.waitlist)
  );
end;
$$;

revoke all on function public.get_admin_overview_stats() from public, anon;
grant execute on function public.get_admin_overview_stats() to authenticated;

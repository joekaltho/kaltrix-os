-- Business Pulse: real-data operational snapshot for a business.
--
-- WHY THIS EXISTS
-- ----------------
-- Post-launch spec calls for a "Business Pulse" view: revenue, expenses,
-- profit, invoice/transaction health, customer health, growth, and a
-- Business Health Score that is explicitly NOT the same thing as
-- TrustScore (see 20260909_trust_score_v2.sql). TrustScore asks "how
-- trustworthy does this business look to a stranger" (verification,
-- reviews, profile completeness). Business Health asks "how is the
-- day-to-day operation actually going" (revenue trend, invoice payment
-- rate, customer growth, booking fulfillment, recent activity) --
-- signals TrustScore never looks at.
--
-- WHAT THIS MIGRATION DOES
-- -------------------------
-- 1. Adds public.expenses (new -- no expense tracking existed before
--    this). Required because Profit = Revenue - Expenses is a
--    defined-done requirement, and profit cannot be computed honestly
--    without a real expenses source. Same ownership/RLS pattern as
--    invoices/bookings ("<table>_all_own": auth.uid() must be the
--    owning business's user_id).
-- 2. Adds get_business_pulse(business_id, period_days), a single
--    SECURITY INVOKER function that computes everything the Business
--    Pulse UI needs in one round trip (current period, comparison
--    period, growth direction, health score + breakdown), all from real
--    rows in invoices/bookings/customers/listings/expenses. RLS on
--    those tables (already in place) means a caller only ever sees
--    their own business's data through this function, exactly as if
--    they'd queried the tables directly -- reinforced here with an
--    explicit ownership check so a mismatched business_id fails fast
--    instead of quietly returning zeroed-out metrics.
--
-- SAFE TO RE-RUN: CREATE TABLE IF NOT EXISTS / CREATE OR REPLACE.

-- 1. Expenses -------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade,
  amount integer not null default 0 check (amount >= 0),
  category text not null default 'general',
  description text,
  expense_date date not null default current_date,
  created_at timestamptz not null default timezone('utc'::text, now())
);

create index if not exists expenses_business_id_date_idx
  on public.expenses (business_id, expense_date desc);

alter table public.expenses enable row level security;

drop policy if exists expenses_all_own on public.expenses;
create policy expenses_all_own on public.expenses
  for all
  using (auth.uid() = (select businesses.user_id from public.businesses where businesses.id = expenses.business_id))
  with check (auth.uid() = (select businesses.user_id from public.businesses where businesses.id = expenses.business_id));

-- 2. get_business_pulse ----------------------------------------------------
create or replace function public.get_business_pulse(
  p_business_id uuid,
  p_period_days int default 30
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_owner uuid;
  v_business_created timestamptz;
  v_now timestamptz := now();
  v_period_start timestamptz;
  v_prev_start timestamptz;
  v_prev_end timestamptz;
  v_period_days int := greatest(1, coalesce(p_period_days, 30));

  v_rev_current numeric; v_rev_previous numeric;
  v_exp_current numeric; v_exp_previous numeric;
  v_expenses_tracked boolean;

  v_inv_total int; v_inv_paid int; v_inv_unpaid int; v_inv_overdue int;
  v_inv_outstanding_amount numeric;
  v_inv_period_count int; v_paid_period_count int;

  v_cust_total int; v_cust_new_current int; v_cust_new_previous int;

  v_book_total int; v_book_period int;
  v_book_confirmed int; v_book_completed int; v_book_cancelled int; v_book_pending int;

  v_listings_total int; v_listings_active int;
  v_expenses_total int;

  v_has_any_data boolean;
  v_has_comparison boolean;

  v_growth_status text;
  v_growth_basis text;

  v_health_score int := 0;
  v_health_factors jsonb := '[]'::jsonb;
  v_health_available boolean;

  v_f_revenue int; v_f_invoice int; v_f_customer int; v_f_booking int; v_f_recency int;
  v_last_activity timestamptz;
begin
  select user_id, created_at into v_owner, v_business_created
    from public.businesses where id = p_business_id;

  if v_owner is null or v_owner <> auth.uid() then
    return jsonb_build_object('error', 'not_authorized');
  end if;

  v_period_start := v_now - make_interval(days => v_period_days);
  v_prev_start := v_now - make_interval(days => v_period_days * 2);
  v_prev_end := v_period_start;
  v_has_comparison := v_business_created <= v_prev_start;

  -- Revenue: paid invoices only -- status = 'paid' is the only record of
  -- money actually received. Unpaid/overdue are not revenue yet.
  select coalesce(sum(total), 0) into v_rev_current
    from public.invoices
    where business_id = p_business_id and status = 'paid' and created_at >= v_period_start and created_at <= v_now;
  select coalesce(sum(total), 0) into v_rev_previous
    from public.invoices
    where business_id = p_business_id and status = 'paid' and created_at >= v_prev_start and created_at < v_prev_end;

  -- Expenses (day-granularity, matching the expense_date column)
  select count(*) into v_expenses_total from public.expenses where business_id = p_business_id;
  v_expenses_tracked := v_expenses_total > 0;
  select coalesce(sum(amount), 0) into v_exp_current
    from public.expenses
    where business_id = p_business_id and expense_date >= v_period_start::date and expense_date <= v_now::date;
  select coalesce(sum(amount), 0) into v_exp_previous
    from public.expenses
    where business_id = p_business_id and expense_date >= v_prev_start::date and expense_date < v_prev_end::date;

  -- Invoices / transactions
  select count(*) into v_inv_total from public.invoices where business_id = p_business_id;
  select count(*) into v_inv_paid from public.invoices where business_id = p_business_id and status = 'paid';
  select count(*) into v_inv_unpaid from public.invoices where business_id = p_business_id and status = 'unpaid';
  select count(*) into v_inv_overdue from public.invoices where business_id = p_business_id and status = 'overdue';
  select coalesce(sum(total), 0) into v_inv_outstanding_amount
    from public.invoices where business_id = p_business_id and status in ('unpaid', 'overdue');
  select count(*) into v_inv_period_count
    from public.invoices where business_id = p_business_id and created_at >= v_period_start;
  select count(*) into v_paid_period_count
    from public.invoices where business_id = p_business_id and status = 'paid' and created_at >= v_period_start;

  -- Customers
  select count(*) into v_cust_total from public.customers where business_id = p_business_id;
  select count(*) into v_cust_new_current
    from public.customers where business_id = p_business_id and created_at >= v_period_start;
  select count(*) into v_cust_new_previous
    from public.customers where business_id = p_business_id and created_at >= v_prev_start and created_at < v_prev_end;

  -- Bookings
  select count(*) into v_book_total from public.bookings where business_id = p_business_id;
  select count(*) into v_book_period from public.bookings where business_id = p_business_id and created_at >= v_period_start;
  select count(*) into v_book_confirmed from public.bookings where business_id = p_business_id and status = 'confirmed' and created_at >= v_period_start;
  select count(*) into v_book_completed from public.bookings where business_id = p_business_id and status = 'completed' and created_at >= v_period_start;
  select count(*) into v_book_cancelled from public.bookings where business_id = p_business_id and status = 'cancelled' and created_at >= v_period_start;
  select count(*) into v_book_pending from public.bookings where business_id = p_business_id and status = 'pending' and created_at >= v_period_start;

  -- Listings
  select count(*), count(*) filter (where is_active) into v_listings_total, v_listings_active
    from public.listings where business_id = p_business_id;

  v_has_any_data := (v_inv_total > 0) or (v_book_total > 0) or (v_cust_total > 0)
    or (v_listings_total > 0) or (v_expenses_total > 0);

  -- Growth: revenue trend is the primary signal; new-customer trend is
  -- the fallback for businesses that haven't recorded revenue yet.
  if not v_has_comparison then
    v_growth_status := 'not_enough_data';
    v_growth_basis := 'Business needs to be active for at least ' || (v_period_days * 2) || ' days to compare periods';
  elsif v_rev_current = 0 and v_rev_previous = 0 then
    if v_cust_new_current = 0 and v_cust_new_previous = 0 then
      v_growth_status := 'not_enough_data';
      v_growth_basis := 'No revenue or new customers recorded in either period yet';
    elsif v_cust_new_current > v_cust_new_previous then
      v_growth_status := 'growing';
      v_growth_basis := 'New customers increased period over period';
    elsif v_cust_new_current < v_cust_new_previous then
      v_growth_status := 'declining';
      v_growth_basis := 'New customers decreased period over period';
    else
      v_growth_status := 'stable';
      v_growth_basis := 'New customers unchanged period over period';
    end if;
  elsif v_rev_previous = 0 and v_rev_current > 0 then
    v_growth_status := 'growing';
    v_growth_basis := 'Revenue recorded this period with none in the comparison period';
  elsif v_rev_current >= v_rev_previous * 1.05 then
    v_growth_status := 'growing';
    v_growth_basis := 'Revenue up vs. the comparison period';
  elsif v_rev_current <= v_rev_previous * 0.95 then
    v_growth_status := 'declining';
    v_growth_basis := 'Revenue down vs. the comparison period';
  else
    v_growth_status := 'stable';
    v_growth_basis := 'Revenue roughly unchanged vs. the comparison period';
  end if;

  -- Business Health Score: operational signals only, distinct from
  -- TrustScore (verification/reviews/profile completeness). Every point
  -- here is earned by real usage of the product, never by a form field.
  v_health_available := v_has_any_data;

  if v_health_available then
    -- Revenue activity, 25 pts
    v_f_revenue := case
      when v_rev_current > 0 and v_growth_status = 'growing' then 25
      when v_rev_current > 0 and v_growth_status = 'stable' then 18
      when v_rev_current > 0 then 10
      when v_paid_period_count = 0 and v_inv_total = 0 then 0
      else 5
    end;

    -- Invoice payment health, 20 pts: paid ratio, penalized for overdue
    v_f_invoice := case
      when v_inv_total = 0 then 0
      else greatest(0, round((v_inv_paid::numeric / v_inv_total) * 20) - least(10, v_inv_overdue * 3))::int
    end;

    -- Customer growth, 20 pts
    v_f_customer := case
      when v_cust_total = 0 then 0
      when v_cust_new_current > v_cust_new_previous then 20
      when v_cust_new_current > 0 then 14
      else 8
    end;

    -- Booking fulfillment, 15 pts: confirmed/completed vs cancelled this period
    v_f_booking := case
      when v_book_period = 0 then (case when v_book_total > 0 then 6 else 0 end)
      else greatest(0, round(((v_book_confirmed + v_book_completed)::numeric / v_book_period) * 15))::int
    end;

    -- Recent activity, 20 pts: any real row touched within the window
    select max(t) into v_last_activity from (
      select max(created_at) as t from public.invoices where business_id = p_business_id
      union all select max(created_at) from public.bookings where business_id = p_business_id
      union all select max(created_at) from public.customers where business_id = p_business_id
      union all select max(created_at) from public.expenses where business_id = p_business_id
    ) s;
    v_f_recency := case
      when v_last_activity is null then 0
      when v_last_activity >= v_period_start then 20
      when v_last_activity >= v_prev_start then 10
      else 0
    end;

    v_health_score := greatest(0, least(100, v_f_revenue + v_f_invoice + v_f_customer + v_f_booking + v_f_recency));

    v_health_factors := jsonb_build_array(
      jsonb_build_object('key','revenue','label','Revenue activity',
        'detail', case when v_rev_current > 0 then '₦' || to_char(v_rev_current, 'FM999,999,999') || ' recorded this period' else 'No revenue recorded this period' end,
        'points', v_f_revenue, 'max_points', 25),
      jsonb_build_object('key','invoice_health','label','Invoice payment health',
        'detail', case when v_inv_total = 0 then 'No invoices yet' else v_inv_paid || ' of ' || v_inv_total || ' invoices paid, ' || v_inv_overdue || ' overdue' end,
        'points', v_f_invoice, 'max_points', 20),
      jsonb_build_object('key','customer_health','label','Customer growth',
        'detail', case when v_cust_total = 0 then 'No customers yet' else v_cust_new_current || ' new this period vs ' || v_cust_new_previous || ' prior' end,
        'points', v_f_customer, 'max_points', 20),
      jsonb_build_object('key','booking_fulfillment','label','Booking fulfillment',
        'detail', case when v_book_period = 0 then 'No bookings this period' else (v_book_confirmed + v_book_completed) || ' of ' || v_book_period || ' bookings confirmed or completed' end,
        'points', v_f_booking, 'max_points', 15),
      jsonb_build_object('key','recency','label','Recent activity',
        'detail', case when v_last_activity is null then 'No recorded activity yet' else 'Last activity ' || to_char(v_last_activity, 'DD Mon YYYY') end,
        'points', v_f_recency, 'max_points', 20)
    );
  end if;

  return jsonb_build_object(
    'period_days', v_period_days,
    'period_start', v_period_start,
    'period_end', v_now,
    'previous_period_start', v_prev_start,
    'previous_period_end', v_prev_end,
    'has_comparison_period', v_has_comparison,
    'has_any_data', v_has_any_data,
    'business_created_at', v_business_created,

    'revenue', jsonb_build_object('current', v_rev_current, 'previous', v_rev_previous),
    'expenses', jsonb_build_object('current', v_exp_current, 'previous', v_exp_previous, 'tracked', v_expenses_tracked),
    'profit', case when v_expenses_tracked then jsonb_build_object(
        'available', true, 'current', v_rev_current - v_exp_current, 'previous', v_rev_previous - v_exp_previous
      ) else jsonb_build_object('available', false) end,

    'invoices', jsonb_build_object(
      'total', v_inv_total, 'paid', v_inv_paid, 'unpaid', v_inv_unpaid, 'overdue', v_inv_overdue,
      'outstanding_count', v_inv_unpaid + v_inv_overdue, 'outstanding_amount', v_inv_outstanding_amount,
      'period_count', v_inv_period_count
    ),
    'transactions', jsonb_build_object('period_count', v_paid_period_count, 'period_amount', v_rev_current),

    'customers', jsonb_build_object(
      'total', v_cust_total, 'new_current', v_cust_new_current, 'new_previous', v_cust_new_previous
    ),

    'bookings', jsonb_build_object(
      'total', v_book_total, 'period_count', v_book_period,
      'confirmed', v_book_confirmed, 'completed', v_book_completed,
      'cancelled', v_book_cancelled, 'pending', v_book_pending
    ),

    'listings', jsonb_build_object('total', v_listings_total, 'active', v_listings_active),

    'growth', jsonb_build_object('status', v_growth_status, 'basis', v_growth_basis),

    'business_health', jsonb_build_object(
      'available', v_health_available,
      'score', case when v_health_available then v_health_score else null end,
      'factors', v_health_factors
    )
  );
end;
$$;

grant execute on function public.get_business_pulse(uuid, int) to authenticated;

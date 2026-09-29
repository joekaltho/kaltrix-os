alter policy "Admin can view all leads" on public.leads
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));

alter policy "Business owners can view their messages" on public.messages
  using (exists (select 1 from public.businesses where businesses.id = messages.business_id and businesses.user_id = (select auth.uid())));

alter policy messages_select_own on public.messages
  using ((select auth.uid()) = (select businesses.user_id from public.businesses where businesses.id = messages.business_id));

alter policy messages_update_own on public.messages
  using ((select auth.uid()) = (select businesses.user_id from public.businesses where businesses.id = messages.business_id));

alter policy "Users can view own profile" on public.profiles
  using ((select auth.uid()) = id);

alter policy "Users can insert own profile" on public.profiles
  with check ((select auth.uid()) = id);

alter policy "Users can update own profile" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy businesses_insert on public.businesses
  with check ((select auth.uid()) = user_id);

alter policy businesses_update on public.businesses
  using ((select auth.uid()) = user_id);

alter policy businesses_delete on public.businesses
  using ((select auth.uid()) = user_id);

alter policy "Admins can view all waitlist" on public.waitlist
  using ((select profiles.role from public.profiles where profiles.id = (select auth.uid())) = 'admin');

alter policy "Only admins can view email logs" on public.email_logs
  using (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));

alter policy "Only admins can insert email logs" on public.email_logs
  with check (exists (select 1 from public.profiles where profiles.id = (select auth.uid()) and profiles.role = 'admin'));

alter policy subscriptions_all_own on public.subscriptions
  using ((select auth.uid()) = (select businesses.user_id from public.businesses where businesses.id = subscriptions.business_id))
  with check ((select auth.uid()) = (select businesses.user_id from public.businesses where businesses.id = subscriptions.business_id));

alter policy listings_all_own on public.listings
  using ((select auth.uid()) = (select businesses.user_id from public.businesses where businesses.id = listings.business_id))
  with check ((select auth.uid()) = (select businesses.user_id from public.businesses where businesses.id = listings.business_id));

alter policy expenses_all_own on public.expenses
  using ((select auth.uid()) = (select businesses.user_id from public.businesses where businesses.id = expenses.business_id))
  with check ((select auth.uid()) = (select businesses.user_id from public.businesses where businesses.id = expenses.business_id));

alter policy "Published and flagged reviews are public" on public.reviews
  using (
    moderation_status <> 'removed'
    or public.is_admin()
    or exists (select 1 from public.businesses where businesses.id = reviews.business_id and businesses.user_id = (select auth.uid()))
  );

alter policy "Business owners can view reports on their reviews" on public.review_reports
  using (exists (select 1 from public.businesses where businesses.id = review_reports.business_id and businesses.user_id = (select auth.uid())));

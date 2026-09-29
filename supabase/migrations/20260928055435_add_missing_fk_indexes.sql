create index if not exists idx_customers_business_id on public.customers (business_id);
create index if not exists idx_invoices_business_id on public.invoices (business_id);
create index if not exists idx_leads_business_id on public.leads (business_id);
create index if not exists idx_messages_business_id on public.messages (business_id);
create index if not exists idx_reviews_moderated_by on public.reviews (moderated_by);
create index if not exists idx_review_reports_reviewed_by on public.review_reports (reviewed_by);

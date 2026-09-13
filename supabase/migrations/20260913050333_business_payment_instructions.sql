-- P2 item 7 (invoice workflow): a business needs a way to tell customers
-- how to actually pay an invoice. There is no existing payment gateway
-- wired to invoices (Paystack in this codebase is subscription billing
-- only; "KaltrixPay" isn't an implemented integration anywhere in this
-- schema), so per the brief: don't invent fake payment/account info, and
-- don't build a payment gateway now. This is the honest version --
-- optional, business-provided free text (e.g. bank transfer details, a
-- mobile money handle) shown on the customer-facing invoice view. Empty
-- by default; the invoice page shows a neutral "contact the business"
-- fallback when a business hasn't filled this in, never fabricated info.

alter table public.businesses
  add column if not exists payment_instructions text;

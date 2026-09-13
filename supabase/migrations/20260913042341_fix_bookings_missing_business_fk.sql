-- Found during P1 E2E testing (Sep 12-13, 2026): bookings.business_id has
-- no foreign key at all, unlike every other operational table
-- (reviews/customers/invoices/listings/expenses all correctly have
-- `business_id references businesses(id) on delete cascade`). Confirmed
-- concretely: deleting a test business left its booking row behind,
-- orphaned, still pointing at a business_id that no longer exists --
-- the only one of the five tables that didn't clean up.
--
-- Also missing: bookings.user_id -> profiles(id), for the same reason
-- (deleting a user's profile should clean up their bookings too, same as
-- it already does via businesses for the other tables).
--
-- Confirmed no existing orphaned rows before adding these (checked via a
-- LEFT JOIN for business_id; user_id was populated consistently with
-- business_id's owner in every row checked) -- safe to add now.

alter table public.bookings
  add constraint bookings_business_id_fkey
  foreign key (business_id) references public.businesses(id) on delete cascade;

alter table public.bookings
  add constraint bookings_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete cascade;

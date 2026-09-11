-- Fix: bookings.status CHECK constraint rejects 'completed'.
--
-- CONFIRMED BUG
-- -------------
-- The dashboard's "Mark Complete" button (src/app/(dashboard)/dashboard/page.tsx,
-- updateBookingStatus) writes status = 'completed' for a confirmed booking,
-- and src/types Booking.status already types 'completed' as valid. But
-- bookings_status_check only ever allowed ('pending', 'confirmed',
-- 'cancelled') -- 'completed' was never in the allowed list. Every click
-- of "Mark Complete" fails with a Postgres check-constraint violation.
-- The client-side update call has no error handling, so the UI
-- optimistically shows "completed" while the database silently keeps the
-- old status -- the booking reverts to its real status on next reload,
-- with no error ever surfaced to the business owner.
--
-- FIX: widen the constraint to match what the app has always intended to
-- allow. No data migration needed -- no row could have ever been written
-- with status = 'completed' given the old constraint.

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
  check (status = any (array['pending'::text, 'confirmed'::text, 'cancelled'::text, 'completed'::text]));

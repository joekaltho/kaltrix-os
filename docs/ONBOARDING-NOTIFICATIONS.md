# Onboarding emails, announcements, notifications, verification

Added Oct 15 2026. Migrations: `20261015120000_admin_set_business_verified`,
`20261015120100_welcome_email_outbox`, `20261015120200_business_notifications`
(apply in that order; each is idempotent).

## Welcome email

- **Trigger:** creating a business inserts one `email_deliveries` row
  (`kind = 'welcome'`, `pending`) via a database trigger. The trigger can never
  fail a registration. Businesses that existed before the migration get no row,
  so nobody receives a retroactive welcome.
- **Send:** `POST /api/onboarding/welcome`, called once by the create-business
  page and once per tab session by the dashboard while the business is under 7
  days old (the retry path). The route takes **no input**: the recipient is the
  signed-in user's *confirmed* email, the business is looked up from the
  session. Auth required; rate-limited per user (10/h) and per IP (30/h).
- **No duplicates:** `claim_email_delivery()` is one atomic `UPDATE ...
  RETURNING`, so concurrent requests can't both win (raced 8-way x 40 in
  `supabase/tests/onboarding_concurrency.sh`). Resend also receives
  `Idempotency-Key: welcome-<business id>`, covering a crash between "accepted"
  and "marked sent". `UNIQUE (business_id, kind)` is the last guard.
- **Failures:** the HTTP response is always `{ status }` with 200 and never
  affects the dashboard. A failed send is recorded (`failed`, short
  non-sensitive `last_error` such as `resend_403_validation_error`) and retried
  on the owner's next dashboard load, 2 min apart, max 3 attempts. A claim
  abandoned mid-send is reclaimable after 10 min.
- **No key configured:** `RESEND_API_KEY` unset leaves rows `pending` (no attempt
  used); they go out once the key exists, if the owner opens the dashboard
  within 7 days of registering.
- **Sender:** `KaltrixOS <updates@kaltrixos.com>` (constant in `src/lib/resend.ts`).
  No `resend` package: plain `fetch` to Resend's REST API.

### Checking on it (SQL)

```sql
-- Overview
select status, count(*) from email_deliveries group by 1;
-- What went wrong
select business_id, status, attempts, last_error, updated_at
  from email_deliveries where status <> 'sent' order by updated_at desc;
-- Re-queue one that ran out of attempts (after fixing the cause)
update email_deliveries set status = 'pending', attempts = 0, last_error = null
  where business_id = '<id>' and kind = 'welcome';
```

## "NEW" badge + Inventory intro

`src/lib/feature-announcements.ts` defines the rules; `use-announcement.ts`
applies them. The badge shows next to Inventory in the sidebar (and as a dot on
mobile's "More") until the user opens Inventory once or the announcement expires
(`expiresAt`, currently 2026-12-15). The intro card on the Inventory tab shows
until dismissed. State is per browser + business in `localStorage`; nothing is
stored server-side. To announce another feature, add an `Announcement` and pass
`isNew` on its nav item.

Anyone who already tracks at least one product is not shown the badge or the intro:
the dashboard does a head-only count of `inventory_items` while the badge would
show, and the Inventory tab re-checks when it loads. Either way it is recorded as
seen/dismissed, so it stays gone even if they later stop tracking.

## Notifications

Table `notifications`, written **only by database triggers**, so every code path
(public API routes, Paystack webhook, admin page, cron) is covered. Owners can
read their own rows and set `read_at`; they cannot create, edit or delete.
`href` is constrained to in-app paths by a CHECK (and re-checked in the UI).
Notification failures are swallowed with a WARNING: they can never roll back the
message, review, payment, stock change or verification that caused them.

| Type | Source |
| --- | --- |
| `new_message` | row in `messages` |
| `new_review` | row in `reviews` |
| `review_flagged`, `review_removed` | `reviews.moderation_status` changes |
| `verification_granted`, `verification_removed` | `businesses.is_verified` changes |
| `plan_activated` | Paystack payment recorded in `subscriptions` (deduped per reference) |
| `trial_ending` | hourly `pg_cron` job `notify-trials-ending` (<= 3 days left) |
| `trial_ended`, `plan_expired` | subscription lapses to Free |
| `low_stock`, `out_of_stock` | `inventory_items.stock_status` crosses the line |

Not covered on purpose: bookings (owner-created; there is no public booking
flow, so nothing inbound), overdue invoices (a time-based sweep like
`notify_trials_ending` is the natural next addition).

### How the bell stays current

Migration `20261017100100_notifications_realtime` adds `notifications` to the
`supabase_realtime` publication, so new rows (and reads made in another tab or
device) are pushed to the open dashboard. Realtime applies the table's RLS per
subscriber using their own JWT, so an owner only ever receives their own business's
rows. The event is only a nudge: the hook re-reads (debounced 400 ms) rather than
trusting the payload. Polling remains as the fallback: every 60 s with no live
connection (migration not applied, websocket blocked, network drop) and every 5 min
as a safety net while live, plus a refresh whenever the tab regains focus. The app
works without the migration; it just polls.

### Retention

`prune_notifications()` runs daily (`prune-notifications`, 03:41 UTC): read
notifications are deleted 30 days after being read, and anything is deleted at 180
days. Unread notifications younger than 180 days are always kept. Pruning cannot
re-create a notification (see the comment in the migration); `email_deliveries` is
intentionally not pruned.

## Verified badge fix

Root cause: `businesses` has no admin UPDATE policy, so the admin page's direct
`update ... is_verified = true` matched **0 rows with no error**, while the page
flipped its own state to "Verified". The public profile reads the real value, so
it never showed the badge. Now `admin_set_business_verified(id, bool)` (admin
only, changes nothing but `is_verified`) is the write path, and the admin page
updates only after the database confirms, showing an error otherwise.

## Admin delete fix (Oct 16 2026)

Same root cause for *Delete business*: `businesses_delete` is owner-only, so an
admin's delete matched 0 rows and the page removed the row from its list anyway.
Now `admin_delete_business(id)` (admin only; migration
`20261016100000_admin_delete_business`) is the only path. The page confirms with
the business name and what will be removed, and changes its list only after the
database returns the deleted row. Deleting cascades to every dependent table
(`feedback` is kept, detached); it is irreversible and does not delete the auth
user. `src/lib/admin-actions.ts` holds the "success only if the database
confirmed" rule for both verify and delete. Review dismiss/uphold now also check
their write counts instead of assuming success.

### Logo cleanup on delete

Deleting a business now also removes its logo file. Storage has no delete policy for
anyone, so this runs server-side: the page calls `DELETE /api/admin/businesses/<id>`,
which runs the same `admin_delete_business()` with the **caller's own session** (the
database still decides who is an admin) and only then, with the service role,
removes the file. Rules (`src/lib/logo-storage.ts`, `src/lib/admin-delete.ts`):

- the file is removed only after the database confirmed the delete; a refused or
  failed delete never touches storage;
- `logo_url` is owner-writable, so it is never trusted on its own: only a flat file
  on this project's `logos` bucket named `<deleted owner's user id>-<timestamp>.<ext>`
  is eligible, and only if no remaining business still references the same URL;
- a storage failure never hides a successful delete: the admin sees "Deleted ..., but
  its logo file could not be removed".

Not covered: replacing a logo from the profile page still leaves the previous file
behind, and files already orphaned before this change (production had one at the time
of writing) stay until removed by hand.

## Welcome-email retry and Resend idempotency

Resend keeps an `Idempotency-Key` for 24 h: same key + same payload returns the
original email; same key + *different* payload is `409
invalid_idempotent_request`. A retry rebuilds the email, so if the owner renamed
their business after an attempt Resend had already accepted (response lost), the
retry gets that 409. On a retry (attempt >= 2) that 409 now means "already
accepted": the row is recorded `sent` with `last_error = 'idempotent_replay'`
instead of burning the remaining attempts. On a first attempt it stays a failure.

## UI notes

The notification panel is rendered through a portal into `<body>`. The mobile top
bar uses `backdrop-filter` (`.glass`), which makes it the containing block for
`position: fixed` children; without the portal the click-away layer covered only
the bar and tapping elsewhere did not close the panel.

## Tests

See `supabase/tests/README.md`. `npm test` covers the pure logic (templates,
transport, delivery orchestration, notification helpers).

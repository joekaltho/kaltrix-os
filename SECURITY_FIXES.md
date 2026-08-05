# KaltrixOS pre-launch audit — Aug 2, 2026

## Already live in Supabase (nothing to do)

1. **`bookings` table was world-readable + world-writable.** Anyone, unauthenticated,
   could read every business's full booking list (customer name/phone/notes) and
   insert bogus bookings into any business. Dropped the two `USING (true)` /
   `WITH CHECK (true)` policies causing it; the correct owner-scoped policy was
   already underneath.
2. **`profiles.role` self-escalation.** Any logged-in user could PATCH their own
   `role` to `'admin'` via a raw API call — RLS only checks row ownership, not
   which columns changed. Fixed at the grant level: `authenticated` can now only
   update `name` on `profiles`. Also found and fixed a **pre-existing bug**
   while testing this: the `Admins can view all profiles` policy queried
   `profiles` from inside its own policy (self-reference), which threw
   `infinite recursion detected in policy` — meaning **the admin dashboard's
   user list was already broken** before I touched anything. Fixed by routing
   it through `is_admin()` instead of an inline subquery.
3. **`businesses.trust_score` / `is_verified` forgeable.** Both are computed
   client-side and written straight through RLS, so any owner could set their
   own trust score to 100 or flip on the verified badge. Added a trigger: new
   businesses always start at 0/unverified; only an admin account can change
   either afterward. Tested via a simulated non-admin session — forgery
   attempt is silently ignored, values stay unchanged.
4. **`logos` storage bucket had zero upload policies.** Every logo upload has
   been silently failing for every user (RLS defaults to deny with no policy
   present). Added scoped upload policies + capped file size to 5MB + locked
   to real image MIME types (was unlimited size, any file type — someone
   could've hosted arbitrary files on your domain).
5. Hardened `handle_new_user()` against search_path hijacking.
6. Deduped several redundant/duplicate RLS policies left over from overlapping
   migrations (profiles, invoices, messages, waitlist) — cosmetic, not a
   vuln, just cleanup.

## Fixed in code — drop these 4 files into your repo, commit, push

- `src/lib/supabase/server.ts` — **new file**. This didn't exist and
  `send-waitlist-emails` imported it — **the app currently fails to build.**
  This alone is launch-blocking regardless of anything else in this report.
- `src/app/api/send-waitlist-emails/route.ts` — switched to the service-role
  client. It was using the session-bound client, which (via RLS) would
  silently return 0 waitlist emails sent unless called from an active
  logged-in browser session.
- `package.json` + `package-lock.json` — dependency fixes:
  - Bumped Next.js 16.2.10 → 16.2.12. 16.2.10 was vulnerable to a July 2026
    batch of 9 CVEs (SSRF via rewrites, Server Action DoS, cache confusion,
    one middleware auth-bypass — your `proxy.ts` naming isn't in scope for
    that specific one, the other 8 are unrelated to that detail).
  - Removed `paystack` and `flutterwave-react-v3` npm packages — both
    **completely unused** (zero imports anywhere in `src/`), and `paystack`
    was dragging in the long-deprecated `request` library with permanently
    unpatched CVEs (`qs`, `tough-cookie`, `uuid`).
  - Added `overrides` forcing `postcss`/`sharp` (nested inside Next's own
    tooling) to patched versions.
  - Net result: `npm audit` went from **12 vulnerabilities (2 critical, 6
    high, 4 moderate) → 0.**
- Verified: `npm run build` passes clean after all of the above.

No env var changes needed for any of this — it's a straight code drop.

## Still needs you (not something I can do from here)

- **Enable "Leaked password protection"** — Supabase Dashboard → Authentication
  → Policies. 2-minute toggle, checks new passwords against HaveIBeenPwned.
  Not exposed through SQL/the API I have access to.
- Confirm **Paystack production keys** are actually set in Vercel's env vars,
  and the **webhook URL is registered** in Paystack's dashboard pointing at
  `/api/webhooks/paystack` (the handler itself is solid — signature verified,
  server-side re-verification against Paystack's API, amount checked against
  plan price, idempotent — it just needs to actually be wired up on
  Paystack's end).
- **`RESEND_API_KEY`** + sender domain verification, or waitlist emails won't
  send.
- **Subscription expiry tracking** — not built as far as I can see in the
  current repo.

## Known, not fixed (low priority / your call)

- `messages` and `waitlist` both have intentionally-public INSERT policies
  (anyone can message a business or join the waitlist without an account) —
  this looks deliberate given the public contact form / waitlist signup, left
  as-is.
- `is_admin()` and `handle_new_user()` are technically callable by anyone via
  RPC (`/rest/v1/rpc/is_admin`). Low risk — `is_admin()` just returns your own
  admin status, `handle_new_user()` is a trigger function that errors if
  called outside trigger context — but Supabase's linter flags it. Left alone
  since tightening it risks touching something the role-escalation fix now
  depends on, this close to launch.
- The client-side "your trust score will be X" preview shown while filling
  out the business creation form no longer matches what actually gets saved
  (always starts at 0 now). Cosmetic mismatch, not a bug — worth a copy
  tweak post-launch.

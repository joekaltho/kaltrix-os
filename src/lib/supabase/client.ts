import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Perf note (Sep 2026 platform-wide performance audit):
// supabase.auth.getUser() makes a real network round trip to the Auth
// server every time it's called, to re-verify the JWT server-side.
// Production logs showed this endpoint (/auth/v1/user) being hit ~120x/day
// with individual calls up to ~500ms, because nearly every dashboard page
// called it at least once on mount AND again on form submit, on top of the
// one middleware.ts already does per request.
//
// middleware.ts is the real trust boundary (it gates /dashboard and /admin
// server-side before any of these components render) and should keep using
// getUser(). Everywhere else, this app only needs "my own user id" to build
// a query -- and Postgres RLS enforces real authorization on every query
// regardless of what the client believes, so reading the id from the SDK's
// local session cache (no network call in the common case) is just as safe
// and a lot faster. Use this instead of auth.getUser() in 'use client'
// components.
export async function getSessionUser(supabase: ReturnType<typeof createClient>) {
  const { data: { session } } = await supabase.auth.getSession()
  return { data: { user: session?.user ?? null } }
}
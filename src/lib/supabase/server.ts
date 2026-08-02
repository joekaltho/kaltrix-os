import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Server-side Supabase client for use in Server Components, Route Handlers,
// and Server Actions. Uses the anon key + the caller's own session cookies,
// so it is still bound by RLS like any authenticated/anon request — this is
// NOT the service-role client (see service.ts for that).
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component that can't set cookies (no
            // active response to attach them to). Safe to ignore as long as
            // middleware.ts/proxy.ts is refreshing the session elsewhere.
          }
        },
      },
    }
  )
}

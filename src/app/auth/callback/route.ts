import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') || '/dashboard'
  const error = searchParams.get('error')
  const errorCode = searchParams.get('error_code')

  // Supabase redirected here with an error (expired link, access denied, etc.)
  if (error) {
    const message =
      errorCode === 'otp_expired' ? 'expired' : errorCode === 'access_denied' ? 'denied' : 'invalid'
    return NextResponse.redirect(`${origin}/forgot-password?error=${message}`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // setAll called from a Server Component render — safe to ignore,
            // the session is refreshed on the next request via proxy.ts
          }
        },
      },
    }
  )

  let user = null

  if (code) {
    const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (!exchangeError) user = data.user
  }

  if (token_hash && type) {
    const { data, error: otpError } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!otpError) user = data.user
  }

  if (!user) {
    return NextResponse.redirect(`${origin}/forgot-password?error=expired`)
  }

  // Password-recovery flow: send the user straight to the set-new-password form,
  // skip profile/business bootstrap since they already have an account.
  if (next === '/reset-password' || type === 'recovery') {
    return NextResponse.redirect(`${origin}/reset-password`)
  }

  // Signup / magic-link flow: ensure a profile row exists, then route to the
  // dashboard (or business onboarding if they haven't created a business yet).
  const { data: existingProfile } = await supabase.from('profiles').select('id').eq('id', user.id).single()

  if (!existingProfile) {
    const name = user.user_metadata?.name || user.email?.split('@')[0] || 'User'
    await supabase.from('profiles').insert({
      id: user.id,
      name,
      email: user.email,
      role: 'business',
    })
  }

  const { data: business } = await supabase.from('businesses').select('id').eq('user_id', user.id).single()

  const redirectTo = next !== '/dashboard' ? next : business ? '/dashboard' : '/dashboard/create-business'

  return NextResponse.redirect(`${origin}${redirectTo}`)
}

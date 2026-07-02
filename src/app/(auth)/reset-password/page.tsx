import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')
  const next = searchParams.get('next') || '/dashboard'
  const error = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')

  // Handle Supabase error redirects (expired links, access denied etc.)
  if (error) {
    const message = errorCode === 'otp_expired'
      ? 'expired'
      : errorCode === 'access_denied'
      ? 'denied'
      : 'invalid'
    return NextResponse.redirect(`${origin}/forgot-password?error=${message}`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  let user = null

  if (code) {
    const { data, err } = await supabase.auth.exchangeCodeForSession(code) as any
    if (!err) user = data?.user
  }

  if (token_hash && type) {
    const { data, err } = await supabase.auth.verifyOtp({ token_hash, type: type as any }) as any
    if (!err) user = data?.user
  }

  if (user) {
    // If this is a password reset flow, go straight to reset page
    if (next === '/reset-password' || type === 'recovery') {
      return NextResponse.redirect(`${origin}/reset-password`)
    }

    // Check profile
    const { data: existingProfile } = await supabase
      .from('profiles').select('id').eq('id', user.id).single()

    if (!existingProfile) {
      const name = user.user_metadata?.name || user.email?.split('@')[0] || 'User'
      await supabase.from('profiles').insert({
        id: user.id,
        name,
        email: user.email,
        role: 'business',
      })
    }

    const { data: business } = await supabase
      .from('businesses').select('id').eq('user_id', user.id).single()

    const redirectTo = next !== '/dashboard'
      ? next
      : business ? '/dashboard' : '/dashboard/create-business'

    return NextResponse.redirect(`${origin}${redirectTo}`)
  }

  return NextResponse.redirect(`${origin}/forgot-password?error=expired`)
}
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type')

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
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) user = data.user
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type: type as any })
    if (!error) user = data.user
  }

  if (user) {
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

    const redirectTo = business ? '/dashboard' : '/dashboard/create-business'
    return NextResponse.redirect(`${origin}${redirectTo}`)
  }

  return NextResponse.redirect(`${origin}/login?error=confirm_failed`)
}
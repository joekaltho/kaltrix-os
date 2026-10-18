import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { apiError, checkRateLimits, rateLimitResponse } from '@/lib/api-guard'
import { deleteBusinessAndLogo } from '@/lib/admin-delete'
import { LOGO_BUCKET, logoObjectName } from '@/lib/logo-storage'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Admin: delete a business and its logo file.
//
// Who may do this is decided by the DATABASE, not this route: the delete runs
// through admin_delete_business() with the CALLER's own session, which raises
// `forbidden` for anyone who isn't an admin. The service role is used for exactly
// two things, both after the delete is confirmed: checking that no other business
// shares the logo URL, and removing the logo object (Storage has no delete policy
// for anyone, by design). See src/lib/admin-delete.ts for the ordering rules.
export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    if (!UUID.test(id)) return apiError('Invalid business id', 400)

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Please sign in', 401)

    let service: ReturnType<typeof createServiceClient>
    try {
      service = createServiceClient()
    } catch (err) {
      console.error('Admin delete: service client unavailable:', err instanceof Error ? err.message : err)
      return apiError('Service temporarily unavailable — please try again shortly', 503)
    }

    const limit = await checkRateLimits(service, [{ key: `admin-delete:${user.id}`, max: 30, windowSeconds: 3600 }])
    if (limit.status !== 'ok') return rateLimitResponse(limit)

    const result = await deleteBusinessAndLogo(id, {
      logoNameFor: (logoUrl, ownerId) => logoObjectName(logoUrl, ownerId, process.env.NEXT_PUBLIC_SUPABASE_URL),
      readBusiness: async (businessId) => {
        const { data, error } = await supabase.from('businesses').select('user_id, logo_url').eq('id', businessId).maybeSingle()
        if (error) throw new Error(error.code)
        return data
      },
      callDelete: async (businessId) => {
        const { data, error } = await supabase.rpc('admin_delete_business', { p_business_id: businessId })
        return { data, error: error ? { message: error.message, code: error.code } : null }
      },
      logoStillReferenced: async (logoUrl) => {
        const { count, error } = await service.from('businesses').select('id', { count: 'exact', head: true }).eq('logo_url', logoUrl)
        if (error) throw new Error(error.code)
        return (count ?? 0) > 0
      },
      removeLogo: async (name) => {
        const { data, error } = await service.storage.from(LOGO_BUCKET).remove([name])
        if (error) {
          console.error('Admin delete: logo removal failed:', error.message)
          return { removed: false, error: error.message }
        }
        return { removed: (data?.length ?? 0) > 0, error: null }
      },
    })

    if (!result.ok) return apiError(result.message, result.status)
    return NextResponse.json({ id: result.id, business_name: result.business_name, logo: result.logo })
  } catch (err) {
    console.error('Admin delete error:', err instanceof Error ? err.message : err)
    return apiError('Something went wrong', 500)
  }
}

'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentPlan, getListingLimit } from '@/lib/check-plan'

interface ListingCapGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

function ListingCapGuardContent({ children, redirectTo = '/dashboard/upgrade' }: ListingCapGuardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAccess = async () => {
      const plan = await getCurrentPlan()
      const limit = getListingLimit(plan)

      // null = unlimited on this plan, nothing to check
      if (limit === null) {
        setAllowed(true)
        return
      }

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: business } = await supabase
        .from('businesses').select('id').eq('user_id', user.id).single()

      if (!business) {
        // No business yet - let the form itself surface that message
        setAllowed(true)
        return
      }

      const { count } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)

      if ((count ?? 0) >= limit) {
        const returnUrl = window.location.pathname
        router.push(`${redirectTo}?required=listings&returnUrl=${encodeURIComponent(returnUrl)}`)
      } else {
        setAllowed(true)
      }
    }
    checkAccess()
  }, [redirectTo, router])

  if (allowed === null) {
    return (
      <div className="min-h-screen bg-ivory font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-inkFaint text-sm">Checking access...</p>
        </div>
      </div>
    )
  }

  return allowed ? <>{children}</> : null
}

export default function ListingCapGuard(props: ListingCapGuardProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-ivory font-sans flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-inkFaint text-sm">Loading...</p>
          </div>
        </div>
      }
    >
      <ListingCapGuardContent {...props} />
    </Suspense>
  )
}

'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getCurrentBusinessAndPlan, getListingLimit } from '@/lib/check-plan'
import { BusinessProvider } from '@/lib/business-context'

interface ListingCapGuardProps {
  children: React.ReactNode
  redirectTo?: string
}

function ListingCapGuardContent({ children, redirectTo = '/dashboard/upgrade' }: ListingCapGuardProps) {
  const router = useRouter()
  const supabase = createClient()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)

  useEffect(() => {
    const checkAccess = async () => {
      const { userId, businessId, plan } = await getCurrentBusinessAndPlan()
      setBusinessId(businessId)
      const limit = getListingLimit(plan)

      // null = unlimited on this plan, nothing to check
      if (limit === null) {
        setAllowed(true)
        return
      }

      if (!userId) { router.push('/login'); return }

      if (!businessId) {
        // No business yet - let the form itself surface that message
        setAllowed(true)
        return
      }

      const { count } = await supabase
        .from('listings')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)

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

  return allowed ? <BusinessProvider value={businessId}>{children}</BusinessProvider> : null
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

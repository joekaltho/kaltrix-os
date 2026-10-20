'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import { getCurrentBusinessAndPlan, hasFeature } from '@/lib/check-plan'
import { readIdentityCache } from '@/lib/session-cache'
import { BusinessProvider } from '@/lib/business-context'
import FormPageSkeleton from '@/components/ui/FormPageSkeleton'

interface PremiumGuardProps {
  children: React.ReactNode
  feature: 'bookings' | 'crm' | 'invoices'
  redirectTo?: string
}

function PremiumGuardContent({ children, feature, redirectTo = '/dashboard/upgrade' }: PremiumGuardProps) {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)
  const [businessId, setBusinessId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const checkAccess = async () => {
      // Fast path: if this session's last-known plan already includes the feature,
      // show the page now instead of waiting on the network. The real check below
      // still runs every time, and a denial sends the user away exactly as before.
      const { data: { user } } = await getSessionUser(createClient())
      const cached = readIdentityCache(user?.id)
      if (cached && hasFeature(cached.plan, feature) && !cancelled) {
        setBusinessId(cached.businessId)
        setAllowed(true)
      }

      const { businessId, plan } = await getCurrentBusinessAndPlan()
      if (cancelled) return
      setBusinessId(businessId)
      if (hasFeature(plan, feature)) {
        setAllowed(true)
      } else {
        setAllowed(null) // back to the loading skeleton while we redirect
        const returnUrl = window.location.pathname
        router.push(`${redirectTo}?required=${feature}&returnUrl=${encodeURIComponent(returnUrl)}`)
      }
    }
    checkAccess()
    return () => { cancelled = true }
  }, [feature, redirectTo, router])

  if (allowed === null) {
    return (
      <FormPageSkeleton />
    )
  }

  return allowed ? <BusinessProvider value={businessId}>{children}</BusinessProvider> : null
}

export default function PremiumGuard(props: PremiumGuardProps) {
  return (
    <Suspense
      fallback={<FormPageSkeleton />}
    >
      <PremiumGuardContent {...props} />
    </Suspense>
  )
}
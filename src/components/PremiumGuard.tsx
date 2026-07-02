'use client'

import { Suspense } from 'react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getCurrentPlan, hasFeature } from '@/lib/check-plan'

interface PremiumGuardProps {
  children: React.ReactNode
  feature: 'bookings' | 'crm' | 'invoices'
  redirectTo?: string
}

function PremiumGuardContent({ children, feature, redirectTo = '/dashboard/upgrade' }: PremiumGuardProps) {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null)

  useEffect(() => {
    const checkAccess = async () => {
      const plan = await getCurrentPlan()
      if (hasFeature(plan, feature)) {
        setAllowed(true)
      } else {
        const returnUrl = window.location.pathname
        router.push(`${redirectTo}?required=${feature}&returnUrl=${encodeURIComponent(returnUrl)}`)
      }
    }
    checkAccess()
  }, [feature, redirectTo, router])

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

export default function PremiumGuard(props: PremiumGuardProps) {
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
      <PremiumGuardContent {...props} />
    </Suspense>
  )
}
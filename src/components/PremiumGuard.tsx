'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getCurrentPlan, hasFeature } from '@/lib/check-plan'

interface PremiumGuardProps {
  children: React.ReactNode
  feature: 'bookings' | 'crm' | 'invoices'
  redirectTo?: string
}

// Inner component that actually uses useSearchParams
function PremiumGuardContent({ children, feature, redirectTo = '/dashboard/upgrade' }: PremiumGuardProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 text-xl animate-pulse">Checking access...</div>
      </div>
    )
  }

  return allowed ? <>{children}</> : null
}

// Wrapper that provides the Suspense boundary
export default function PremiumGuard(props: PremiumGuardProps) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-green-400 text-xl animate-pulse">Loading...</div>
        </div>
      }
    >
      <PremiumGuardContent {...props} />
    </Suspense>
  )
}
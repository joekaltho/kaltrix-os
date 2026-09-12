'use client'

import { createContext, useContext } from 'react'

// Populated by PremiumGuard / ListingCapGuard once they've already resolved
// the caller's business id to decide feature access. The /new page submit
// handlers read it from here instead of re-querying `businesses` for the
// same row a second time (see check-plan.ts's getCurrentBusinessAndPlan).
const BusinessContext = createContext<string | null>(null)

export const BusinessProvider = BusinessContext.Provider

export function useBusinessId(): string | null {
  return useContext(BusinessContext)
}

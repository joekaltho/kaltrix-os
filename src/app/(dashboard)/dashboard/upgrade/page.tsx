'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function UpgradePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentPlan, setCurrentPlan] = useState('free')

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push('/login?redirect=/dashboard/upgrade')
        return
      }
      
      setIsAuthenticated(true)

      // Check current plan
      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('business_id', user.id)
        .single()

      if (subscription) {
        setCurrentPlan(subscription.plan)
      }
      setLoading(false)
    }
    checkUser()
  }, [router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory dark:bg-ink flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand/20 border-t-brand rounded-full animate-spin" />
          <p className="text-inkFaint text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="min-h-screen bg-ivory dark:bg-ink py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        
        {/* Back button */}
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-inkFaint hover:text-ink transition mb-8 text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-brand/10 border border-brand/20 rounded-full px-4 py-1.5 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-slow" />
            <span className="text-brand text-xs font-black uppercase tracking-wide">Coming Soon</span>
          </div>
          
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-ink mb-4 leading-tight">
            Something Big is
            <span className="text-brand block">Coming.</span>
          </h1>
          
          <p className="text-inkMid text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
            We're building the most powerful business OS for African SMEs. 
            Premium features are on the way — and they'll be worth the wait.
          </p>
        </div>

        {/* Current Plan Badge */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex items-center gap-3 bg-white dark:bg-ivoryDim border border-border rounded-full px-6 py-3 shadow-card">
            <span className="text-inkFaint text-sm font-medium">Current Plan:</span>
            <span className="text-ink font-black text-sm capitalize">{currentPlan}</span>
            {currentPlan === 'free' && (
              <span className="bg-brandBg text-brand text-xs font-black px-3 py-1 rounded-full border border-brand/20">
                Free Forever
              </span>
            )}
          </div>
        </div>

        {/* Coming Soon Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-12">
          {/* Growth Plan */}
          <div className="bg-white dark:bg-ivoryDim rounded-2xl p-8 border border-border shadow-card relative overflow-hidden group transition-all duration-500 hover:shadow-lift hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-brand/5 to-transparent rounded-full blur-2xl" />
            
            <div className="relative">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-inkFaint">Growth</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-ink">₦8,250</span>
                    <span className="text-inkFaint text-sm">/mo equiv</span>
                  </div>
                </div>
                <div className="bg-brand/10 border border-brand/20 rounded-full px-3 py-1">
                  <span className="text-brand text-xs font-black">Most Popular</span>
                </div>
              </div>
              
              <p className="text-inkMid text-sm mb-6">For businesses ready to grow</p>
              
              <div className="space-y-2.5 mb-6">
                {['Everything in Free', 'Verified badge', 'Priority listing', 'Bookings', 'CRM', 'Invoices'].map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-brandBg border border-brand/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-inkMid text-sm">{feature}</p>
                  </div>
                ))}
              </div>
              
              <div className="w-full py-3 rounded-xl bg-ivory dark:bg-ink/50 border border-border text-center text-inkFaint text-sm font-medium">
                🔒 Unlock with Premium
              </div>
            </div>
          </div>

          {/* Pro Plan */}
          <div className="bg-white dark:bg-ivoryDim rounded-2xl p-8 border-2 border-brand/30 shadow-brand relative overflow-hidden group transition-all duration-500 hover:shadow-brandLg hover:-translate-y-1">
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-brand/10 to-transparent rounded-full blur-2xl" />
            
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="gradient-brand text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wide shadow-brand">
                Best Value
              </span>
            </div>
            
            <div className="relative mt-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-inkFaint">Pro</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-ink">₦20,800</span>
                    <span className="text-inkFaint text-sm">/mo equiv</span>
                  </div>
                </div>
                <div className="bg-ink rounded-full px-3 py-1">
                  <span className="text-white text-xs font-black">Elite</span>
                </div>
              </div>
              
              <p className="text-inkMid text-sm mb-6">For businesses that dominate</p>
              
              <div className="space-y-2.5 mb-6">
                {['Everything in Growth', 'Featured placement', 'Analytics', 'Priority support', 'Agency consultation'].map((feature) => (
                  <div key={feature} className="flex items-center gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-brandBg border border-brand/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-2.5 h-2.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-inkMid text-sm">{feature}</p>
                  </div>
                ))}
              </div>
              
              <div className="w-full py-3 rounded-xl bg-gradient-brand text-white text-center text-sm font-black">
                ⭐ Coming Soon
              </div>
            </div>
          </div>
        </div>

        {/* Waitlist CTA */}
        <div className="text-center bg-ink rounded-2xl p-10 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-transparent" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.05),transparent_70%)] animate-pulse-slow" />
          
          <div className="relative">
            <h3 className="text-2xl font-black text-white mb-3">
              Want early access to premium features?
            </h3>
            <p className="text-white/40 text-sm mb-6 max-w-md mx-auto">
              We're hand-picking early adopters to test our premium features before the public launch.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <input
                type="email"
                placeholder="Enter your email"
                className="w-full sm:w-64 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-brand transition text-sm"
              />
              <button className="gradient-brand text-white font-black px-6 py-3 rounded-xl transition hover:shadow-brandLg hover:-translate-y-0.5 transform duration-200 text-sm whitespace-nowrap">
                Get Early Access
              </button>
            </div>
            <p className="text-white/20 text-xs mt-3">We'll notify you when premium features launch</p>
          </div>
        </div>

        {/* Feature Preview */}
        <div className="mt-12">
          <h3 className="text-lg font-black text-center text-ink mb-6">What's Coming in Premium</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: '📊', label: 'Advanced Analytics' },
              { icon: '🤖', label: 'AI-Powered Insights' },
              { icon: '📱', label: 'Mobile App' },
              { icon: '🔗', label: 'API Access' },
            ].map((item) => (
              <div key={item.label} className="bg-white dark:bg-ivoryDim rounded-xl p-4 border border-border text-center group hover:border-brand/20 transition-all duration-300 hover:-translate-y-1 hover:shadow-card">
                <div className="text-3xl mb-2 group-hover:scale-110 transition-transform duration-300">{item.icon}</div>
                <p className="text-inkFaint text-xs font-medium">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12">
          <p className="text-inkFaint text-xs">
            Your free plan is active forever. Upgrade whenever you're ready.
          </p>
          <Link href="/dashboard" className="text-brand text-sm font-medium hover:underline inline-block mt-2">
            ← Back to Dashboard
          </Link>
        </div>

      </div>
    </div>
  )
}
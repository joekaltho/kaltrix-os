'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { getSubscriptionState, SubscriptionState } from '@/lib/check-plan'
import Link from 'next/link'

type BillingCycle = '6month' | 'annual'

interface PlanConfig {
  name: string
  planKey: string
  desc: string
  tagline: string
  highlight: boolean
  badge?: string
  features: string[]
  prices: {
    '6month': { ngn: number; usd: number }
    annual: { ngn: number; usd: number }
  }
  monthlyEquiv: {
    '6month': { ngn: number; usd: string }
    annual: { ngn: number; usd: string }
  }
  dailyEquiv: {
    '6month': string
    annual: string
  }
}

const PLANS: PlanConfig[] = [
  {
    name: 'Free',
    planKey: 'free',
    desc: 'Get found online today',
    tagline: 'No credit card needed',
    highlight: false,
    features: [
      'Business profile & TrustScore',
      'Basic listing on Discover',
      'Customer inbox',
      'Public business page',
      'Shop — up to 10 listings',
    ],
    prices: { '6month': { ngn: 0, usd: 0 }, annual: { ngn: 0, usd: 0 } },
    monthlyEquiv: { '6month': { ngn: 0, usd: '0' }, annual: { ngn: 0, usd: '0' } },
    dailyEquiv: { '6month': '', annual: '' },
  },
  {
    name: 'Growth',
    planKey: 'growth',
    desc: 'Everything you need to run and grow',
    tagline: 'Less than ₦330/day',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Everything in Free',
      'Unlimited Shop listings',
      'Verified badge on profile',
      'Priority discovery listing',
      'Bookings management',
      'Customer CRM',
      'Invoice generator',
      'WhatsApp notifications',
    ],
    prices: { '6month': { ngn: 55000, usd: 33 }, annual: { ngn: 99000, usd: 60 } },
    monthlyEquiv: { '6month': { ngn: 9167, usd: '5.50' }, annual: { ngn: 8250, usd: '5' } },
    dailyEquiv: { '6month': 'Less than ₦306/day', annual: 'Less than ₦275/day' },
  },
  {
    name: 'Pro',
    planKey: 'pro',
    desc: 'For businesses serious about scale',
    tagline: 'Less than ₦600/day',
    highlight: false,
    features: [
      'Everything in Growth',
      'Featured homepage placement',
      'Revenue & booking analytics',
      'Priority support',
      'Custom agency consultation',
      'Early access to new features',
    ],
    prices: { '6month': { ngn: 99000, usd: 60 }, annual: { ngn: 179000, usd: 108 } },
    monthlyEquiv: { '6month': { ngn: 16500, usd: '10' }, annual: { ngn: 14917, usd: '9' } },
    dailyEquiv: { '6month': 'Less than ₦550/day', annual: 'Less than ₦497/day' },
  },
]

declare global {
  interface Window {
    PaystackPop: {
      setup: (config: Record<string, unknown>) => { openIframe: () => void }
    }
  }
}

export default function UpgradePage() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('free')
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingPlan, setProcessingPlan] = useState('')
  const [billing, setBilling] = useState<BillingCycle>('annual')
  const [paystackLoaded, setPaystackLoaded] = useState(false)

  // Load Paystack inline script
  useEffect(() => {
    if (document.getElementById('paystack-script')) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- script already present from a prior mount; one-time sync, not a cascading chain
      setPaystackLoaded(true)
      return
    }
    const script = document.createElement('script')
    script.id = 'paystack-script'
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.onload = () => setPaystackLoaded(true)
    document.body.appendChild(script)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles').select('name').eq('id', user.id).single()
      if (profile) setUserName(profile.name)

      const { data: business } = await supabase
        .from('businesses').select('id').eq('user_id', user.id).maybeSingle()
      if (business) {
        setBusinessId(business.id)
        const subState = await getSubscriptionState(business.id)
        setSubscription(subState)
        setCurrentPlan(subState.plan)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

const handlePaymentSuccess = useCallback(async (planKey: string, reference: string) => {
    // The Paystack webhook (server-to-server, src/app/api/webhooks/paystack)
    // does the actual verification and subscription write. The client-side
    // callback firing does NOT mean the subscription is active yet — this
    // just polls until the webhook's write lands.
    const POLL_INTERVAL_MS = 2000
    const MAX_ATTEMPTS = 15 // ~30s

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan, paystack_reference')
        .eq('business_id', businessId)
        .maybeSingle()

      if (subscription?.paystack_reference === reference && subscription.plan === planKey) {
        setCurrentPlan(planKey)
        router.push('/dashboard?upgraded=true')
        setProcessingPlan('')
        return
      }
    }

    // Webhook hasn't landed yet after ~30s — payment likely still succeeded
    // (Paystack webhooks can lag), so don't tell the user it failed.
    alert(
      "Payment received — we're confirming it now, this can take a minute. " +
      'Your plan will update automatically. If it doesn\'t within a few minutes, ' +
      'contact kaltrix.ng@gmail.com with reference: ' + reference
    )
    setProcessingPlan('')
  }, [businessId, router, supabase])

  const handlePayment = (plan: PlanConfig) => {
    const publicKey = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
    if (!publicKey || publicKey === 'pk_test_PLACEHOLDER') {
      alert('Payment is being set up. Contact kaltrix.ng@gmail.com to upgrade manually.')
      return
    }
    if (!paystackLoaded || !window.PaystackPop) {
      alert('Payment system is loading, please try again in a moment.')
      return
    }
    const price = plan.prices[billing].ngn
    setProcessingPlan(plan.planKey)

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: userEmail,
      amount: price * 100, // Paystack uses kobo
      currency: 'NGN',
      // eslint-disable-next-line react-hooks/purity -- runs inside a click handler, not during render
      ref: `kaltrix-${businessId}-${Date.now()}`,
      metadata: {
        custom_fields: [
          { display_name: 'Business ID', variable_name: 'business_id', value: businessId },
          { display_name: 'Plan', variable_name: 'plan', value: plan.planKey },
          { display_name: 'Billing', variable_name: 'billing', value: billing },
          { display_name: 'Customer Name', variable_name: 'name', value: userName },
        ],
      },
      callback: (response: { reference: string }) => {
        handlePaymentSuccess(plan.planKey, response.reference)
      },
      onClose: () => {
        setProcessingPlan('')
      },
    })

    handler.openIframe()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory font-sans flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-inkFaint text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory text-ink font-sans px-4 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link href="/dashboard" className="text-inkFaint hover:text-ink transition text-sm font-medium">
            ← Back to Dashboard
          </Link>
          <div className="bg-brandBg border border-brand/20 rounded-xl px-4 py-2 text-center">
            <p className="text-inkFaint text-xs">Current Plan</p>
            <p className="text-brand font-black capitalize">{currentPlan}</p>
            {subscription?.isTrialing && (
              <p className="text-inkFaint text-[11px] font-semibold">
                Trial · {subscription.trialDaysLeft}d left
              </p>
            )}
          </div>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-black text-ink">Unlock the full KaltrixOS</h1>
          <p className="text-inkFaint mt-1">
            Businesses on Growth close <span className="text-ink font-semibold">3× more leads</span> than free-tier profiles.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="bg-white border border-border rounded-2xl p-1.5 flex items-center gap-1 shadow-card">
            <button
              onClick={() => setBilling('6month')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                billing === '6month' ? 'bg-ink text-ivory shadow' : 'text-inkFaint hover:text-ink'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                billing === 'annual' ? 'bg-ink text-ivory shadow' : 'text-inkFaint hover:text-ink'
              }`}
            >
              Annual
              <span className="bg-brand text-white text-xs font-black px-2 py-0.5 rounded-full">Best deal</span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.planKey
            const price = plan.prices[billing].ngn
            const usdPrice = plan.prices[billing].usd
            const monthlyNgn = plan.monthlyEquiv[billing].ngn
            const monthlyUsd = plan.monthlyEquiv[billing].usd
            const daily = plan.dailyEquiv[billing]

            return (
              <div
                key={plan.planKey}
                className={`rounded-2xl p-7 border relative flex flex-col transition ${
                  plan.highlight
                    ? 'border-brand/40 bg-brandBg shadow-brand'
                    : 'border-border bg-white shadow-card'
                }`}
              >
                {/* Badge */}
                {(isCurrent || (plan.badge && !isCurrent)) && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    {isCurrent ? (
                      <span className="bg-inkMid text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider">
                        Current Plan
                      </span>
                    ) : (
                      <span className="gradient-brand text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wider">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                )}

                <p className="text-xs font-black uppercase tracking-widest text-inkFaint mb-4">{plan.name}</p>

                {/* Price */}
                {price === 0 ? (
                  <div className="mb-4">
                    <p className="text-5xl font-black text-ink">Free</p>
                    <p className="text-inkFaint text-sm mt-1">{plan.tagline}</p>
                  </div>
                ) : (
                  <div className="mb-4">
                    <div className="flex items-end gap-1 mb-0.5">
                      <p className="text-4xl sm:text-5xl font-black text-ink">₦{monthlyNgn.toLocaleString()}</p>
                      <p className="text-inkFaint text-sm mb-2">/mo</p>
                    </div>
                    <p className="text-inkFaint text-xs">${monthlyUsd}/mo equivalent</p>
                    <div className="mt-3 bg-ivoryDim rounded-lg px-3 py-2 inline-block border border-border">
                      <p className="text-inkFaint text-xs">
                        Billed as <span className="text-ink font-bold">₦{price.toLocaleString()}</span>
                        <span className="text-inkFaint"> (${usdPrice}) · {billing === 'annual' ? '1 year' : '6 months'}</span>
                      </p>
                    </div>
                    {daily && <p className="text-brand text-xs mt-2 font-semibold">{daily}</p>}
                  </div>
                )}

                <p className="text-inkFaint text-sm mb-5">{plan.desc}</p>

                {/* Features */}
                <div className="space-y-2.5 mb-7 flex-1">
                  {plan.features.map((feature) => (
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

                {/* CTA */}
                {isCurrent ? (
                  <div className="text-center font-black py-3.5 rounded-xl bg-ivoryDim text-inkFaint border border-border text-sm">
                    Current Plan
                  </div>
                ) : plan.planKey === 'free' ? (
                  <div className="text-center font-black py-3.5 rounded-xl bg-ivoryDim text-inkFaint border border-border text-sm">
                    Free Forever
                  </div>
                ) : (
                  <button
                    onClick={() => handlePayment(plan)}
                    disabled={processingPlan === plan.planKey}
                    className={`w-full text-center font-black py-3.5 rounded-xl transition text-sm disabled:opacity-60 flex items-center justify-center gap-2 ${
                      plan.highlight
                        ? 'gradient-brand text-white shadow-brand hover:shadow-brandLg'
                        : 'bg-ink hover:bg-inkMid text-ivory'
                    }`}
                  >
                    {processingPlan === plan.planKey ? (
                      <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</>
                    ) : `Get ${plan.name}`}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Trust bar */}
        <div className="flex flex-wrap justify-center gap-6 text-inkFaint text-sm mb-12">
          {['Secure payment via Paystack', 'Nigerian-owned', 'Instant activation', 'Cancel anytime'].map(item => (
            <div key={item} className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              {item}
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="border border-border rounded-2xl p-8 mb-12 bg-white shadow-card">
          <h2 className="text-lg font-black mb-6">Common questions</h2>
          <div className="space-y-5">
            {[
              { q: 'Why no monthly plan?', a: 'We want partners, not trial users. 6-month and annual plans let us give you real support and better features.' },
              { q: 'What happens when my plan expires?', a: 'Your account drops back to Free. Your data stays safe — you just lose access to premium features until you renew.' },
              { q: 'How does payment work?', a: 'We use Paystack — Nigeria\'s most trusted payment platform. Card, bank transfer, and USSD all supported.' },
              { q: "Is it worth it for a small business?", a: "One new customer from Discover pays for a month of Growth. If you're already doing digital, this just amplifies what you have." },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-border pb-5 last:border-0 last:pb-0">
                <p className="font-black text-ink mb-1">{q}</p>
                <p className="text-inkFaint text-sm leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Agency services */}
        <div className="bg-inkStatic rounded-2xl p-8 relative overflow-hidden">
          <div className="absolute top-[-30%] right-[-5%] w-[40%] h-[200%] bg-brand/8 blur-3xl rounded-full pointer-events-none" />
          <h2 className="text-xl font-black text-white mb-2 relative z-10">Need a Custom Website?</h2>
          <p className="text-white/40 mb-6 text-sm relative z-10">
            Kaltrix Agency builds professional websites, booking systems, CRMs and full digital setups.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 relative z-10">
            {[
              { service: 'Professional Website', price: 'From ₦150,000' },
              { service: 'Booking System', price: 'From ₦80,000' },
              { service: 'Full Digital Setup', price: 'From ₦300,000' },
            ].map((item) => (
              <div key={item.service} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="font-semibold text-white text-sm">{item.service}</p>
                <p className="text-brand text-sm mt-1">{item.price}</p>
              </div>
            ))}
          </div>
          <a
            href="mailto:kaltrix.ng@gmail.com?subject=Agency Services Inquiry"
            className="relative z-10 inline-block gradient-brand text-white font-black px-8 py-3 rounded-xl transition shadow-brand text-sm"
          >
            Contact Kaltrix Agency
          </a>
        </div>

      </div>
    </div>
  )
}
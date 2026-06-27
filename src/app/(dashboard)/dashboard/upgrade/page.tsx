'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { FlutterWaveButton, closePaymentModal } from 'flutterwave-react-v3'

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
    ],
    prices: {
      '6month': { ngn: 0, usd: 0 },
      annual: { ngn: 0, usd: 0 },
    },
    monthlyEquiv: {
      '6month': { ngn: 0, usd: '0' },
      annual: { ngn: 0, usd: '0' },
    },
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
      'Verified badge on profile',
      'Priority discovery listing',
      'Bookings management',
      'Customer CRM',
      'Invoice generator',
      'WhatsApp notifications',
    ],
    prices: {
      '6month': { ngn: 55000, usd: 33 },
      annual: { ngn: 99000, usd: 60 },
    },
    monthlyEquiv: {
      '6month': { ngn: 9167, usd: '5.50' },
      annual: { ngn: 8250, usd: '5' },
    },
    dailyEquiv: {
      '6month': 'Less than ₦306/day',
      annual: 'Less than ₦275/day',
    },
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
    prices: {
      '6month': { ngn: 99000, usd: 60 },
      annual: { ngn: 179000, usd: 108 },
    },
    monthlyEquiv: {
      '6month': { ngn: 16500, usd: '10' },
      annual: { ngn: 14917, usd: '9' },
    },
    dailyEquiv: {
      '6month': 'Less than ₦550/day',
      annual: 'Less than ₦497/day',
    },
  },
]

export default function UpgradePage() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('free')
  const [loading, setLoading] = useState(true)
  const [processingPlan, setProcessingPlan] = useState('')
  const [billing, setBilling] = useState<BillingCycle>('annual')

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUserEmail(user.email || '')

      const { data: profile } = await supabase
        .from('profiles').select('name').eq('id', user.id).single()
      if (profile) setUserName(profile.name)

      const { data: business } = await supabase
        .from('businesses').select('id').eq('user_id', user.id).single()
      if (business) {
        setBusinessId(business.id)
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('plan')
          .eq('business_id', business.id)
          .eq('status', 'active')
          .single()
        if (subscription) setCurrentPlan(subscription.plan)
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  const handlePaymentSuccess = async (response: any, planKey: string) => {
    if (response.status === 'successful') {
      const { error } = await supabase.from('subscriptions').upsert({
        business_id: businessId,
        plan: planKey,
        status: 'active',
        updated_at: new Date().toISOString(),
      })
      if (!error) {
        setCurrentPlan(planKey)
        router.push('/dashboard?upgraded=true')
      } else {
        alert('Payment successful but failed to update subscription. Please contact support.')
      }
    }
    setProcessingPlan('')
    closePaymentModal()
  }

  const getFlutterwaveConfig = (plan: PlanConfig) => {
    const publicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY
    if (!publicKey || publicKey === 'FLWPUBK_TEST-PLACEHOLDER') {
      alert('Payment system is being set up. Please contact kaltrix.ng@gmail.com to upgrade manually.')
      return null
    }
    const price = plan.prices[billing].ngn
    return {
      public_key: publicKey,
      tx_ref: `kaltrix-${businessId}-${Date.now()}`,
      amount: price,
      currency: 'NGN',
      payment_options: 'card,ussd,banktransfer',
      customer: {
        email: userEmail,
        name: userName || 'Customer',
        phone_number: '08000000000',
      },
      customizations: {
        title: 'KaltrixOS',
        description: `${plan.name} Plan — ${billing === 'annual' ? '1 Year' : '6 Months'}`,
        logo: 'https://kaltrix-os.vercel.app/logo.png',
      },
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 text-xl animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">
            ← Back to Dashboard
          </Link>
          <div className="bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-2 text-center">
            <p className="text-gray-400 text-xs">Current Plan</p>
            <p className="text-green-400 font-black capitalize">{currentPlan}</p>
          </div>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-black">Unlock the full KaltrixOS</h1>
          <p className="text-gray-400 mt-1">
            Businesses on Growth close <span className="text-white font-semibold">3× more leads</span> than free listings.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-10">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-1.5 flex items-center gap-1">
            <button
              onClick={() => setBilling('6month')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                billing === '6month'
                  ? 'bg-white text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                billing === 'annual'
                  ? 'bg-white text-black shadow'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Annual
              <span className="bg-green-400 text-black text-xs font-black px-2 py-0.5 rounded-full">
                Best deal
              </span>
            </button>
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.planKey
            const price = plan.prices[billing].ngn
            const usdPrice = plan.prices[billing].usd
            const monthlyNgn = plan.monthlyEquiv[billing].ngn
            const monthlyUsd = plan.monthlyEquiv[billing].usd
            const daily = plan.dailyEquiv[billing]
            const config = getFlutterwaveConfig(plan)
            const isPaymentValid = config !== null && price > 0

            return (
              <div
                key={plan.planKey}
                className={`rounded-2xl p-8 border transition relative flex flex-col ${
                  plan.highlight
                    ? 'border-green-400/50 bg-green-400/5 shadow-2xl shadow-green-400/10'
                    : 'border-gray-800 bg-gray-900'
                }`}
              >
                {/* Badge */}
                {(isCurrent || (plan.badge && !isCurrent)) && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    {isCurrent ? (
                      <span className="bg-gray-700 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider">
                        Current Plan
                      </span>
                    ) : (
                      <span className="bg-green-400 text-black text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider">
                        {plan.badge}
                      </span>
                    )}
                  </div>
                )}

                <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-4">{plan.name}</p>

                {/* Price — monthly equiv is the HERO number */}
                {price === 0 ? (
                  <div className="mb-4">
                    <p className="text-5xl font-black">Free</p>
                    <p className="text-gray-500 text-sm mt-1">{plan.tagline}</p>
                  </div>
                ) : (
                  <div className="mb-4">
                    {/* Monthly equiv — BIG */}
                    <div className="flex items-end gap-1 mb-0.5">
                      <p className="text-5xl font-black">₦{monthlyNgn.toLocaleString()}</p>
                      <p className="text-gray-400 text-sm mb-2">/mo</p>
                    </div>
                    <p className="text-gray-500 text-xs">${monthlyUsd}/mo equivalent</p>

                    {/* Lump sum — small */}
                    <div className="mt-3 bg-black/30 rounded-lg px-3 py-2 inline-block">
                      <p className="text-gray-400 text-xs">
                        Billed as <span className="text-white font-bold">₦{price.toLocaleString()}</span>
                        <span className="text-gray-500"> (${usdPrice}) — {billing === 'annual' ? '1 year' : '6 months'}</span>
                      </p>
                    </div>

                    {/* Daily framing */}
                    {daily && (
                      <p className="text-green-400 text-xs mt-2 font-semibold">{daily}</p>
                    )}
                  </div>
                )}

                <p className="text-gray-500 text-sm mb-6">{plan.desc}</p>

                {/* Features */}
                <div className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      </div>
                      <p className="text-gray-300 text-sm">{feature}</p>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {isCurrent ? (
                  <div className="text-center font-black py-4 rounded-xl bg-gray-800 text-gray-500">
                    Current Plan
                  </div>
                ) : plan.planKey === 'free' ? (
                  <div className="text-center font-black py-4 rounded-xl bg-gray-800 text-gray-500">
                    Free Forever
                  </div>
                ) : isPaymentValid ? (
                  <FlutterWaveButton
                    key={`${plan.planKey}-${billing}`}
                    {...config}
                    text={processingPlan === plan.planKey ? 'Processing...' : `Start ${plan.name} →`}
                    callback={(response) => handlePaymentSuccess(response, plan.planKey)}
                    onClose={() => setProcessingPlan('')}
                    className={`w-full text-center font-black py-4 rounded-xl transition text-base ${
                      plan.highlight
                        ? 'bg-green-400 hover:bg-green-300 text-black shadow-lg shadow-green-400/20'
                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                    }`}
                  />
                ) : (
                  <button
                    onClick={() => window.location.href = 'mailto:kaltrix.ng@gmail.com?subject=Upgrade Request'}
                    className="w-full text-center font-black py-4 rounded-xl bg-gray-800 hover:bg-gray-700 text-white transition"
                  >
                    Contact to Upgrade
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Trust bar */}
        <div className="flex flex-wrap justify-center gap-6 text-gray-500 text-sm mb-12">
          {[
            '🔒 Secure via Flutterwave',
            '🇳🇬 Nigerian-owned',
            '⚡ Instant activation',
            '📞 Cancel anytime',
          ].map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>

        {/* FAQ — objection handling */}
        <div className="border border-gray-800 rounded-2xl p-8 mb-12">
          <h2 className="text-lg font-black mb-6">Common questions</h2>
          <div className="space-y-5">
            {[
              {
                q: 'Why no monthly plan?',
                a: 'We want partners, not trial users. The 6-month and annual plans let us give you real support and better features — not a watered-down monthly experience.',
              },
              {
                q: 'What happens when my plan expires?',
                a: 'Your account drops back to Free automatically. Your data stays safe — you just lose access to premium features until you renew.',
              },
              {
                q: 'Can I pay in dollars?',
                a: 'Our payment processor Flutterwave charges in Naira, but we show dollar equivalents for reference. International cards work fine.',
              },
              {
                q: 'Is it worth it for a small business?',
                a: "One new customer from Discover pays for a month of Growth. If you're already doing digital, this just amplifies what you have.",
              },
            ].map(({ q, a }) => (
              <div key={q} className="border-b border-gray-800 pb-5 last:border-0 last:pb-0">
                <p className="font-bold text-white mb-1">{q}</p>
                <p className="text-gray-400 text-sm">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Agency Services */}
        <div className="bg-green-400/5 border border-green-400/20 rounded-2xl p-8">
          <h2 className="text-xl font-black text-green-400 mb-2">Need a Custom Website?</h2>
          <p className="text-gray-400 mb-6">
            Kaltrix Agency builds professional websites, booking systems, CRMs and
            full digital setups. Custom pricing based on your needs.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[
              { service: 'Professional Website', price: 'From ₦150,000' },
              { service: 'Booking System', price: 'From ₦80,000' },
              { service: 'Full Digital Setup', price: 'From ₦300,000' },
            ].map((item) => (
              <div key={item.service} className="bg-black/30 rounded-xl p-4">
                <p className="font-semibold text-sm">{item.service}</p>
                <p className="text-green-400 text-sm mt-1">{item.price}</p>
              </div>
            ))}
          </div>
          <a
            href="mailto:kaltrix.ng@gmail.com?subject=Agency Services Inquiry"
            className="bg-green-400 hover:bg-green-300 text-black font-black px-8 py-3 rounded-xl transition inline-block"
          >
            Contact Kaltrix Agency
          </a>
        </div>

      </div>
    </div>
  )
}

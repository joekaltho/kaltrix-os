'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { FlutterWaveButton, closePaymentModal } from 'flutterwave-react-v3'

interface Plan {
  name: string
  price: number
  period: string
  desc: string
  features: string[]
  highlight: boolean
  current: boolean
  planKey: string
}

export default function UpgradePage() {
  const router = useRouter()
  const supabase = createClient()
  const [userEmail, setUserEmail] = useState('')
  const [userName, setUserName] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [currentPlan, setCurrentPlan] = useState('free')
  const [loading, setLoading] = useState(true)
  const [processingPlan, setProcessingPlan] = useState('')

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
      if (business) setBusinessId(business.id)

      const { data: subscription } = await supabase
        .from('subscriptions')
        .select('plan')
        .eq('business_id', business?.id)
        .eq('status', 'active')
        .single()
      if (subscription) setCurrentPlan(subscription.plan)

      setLoading(false)
    }
    fetchData()
  }, [supabase, router])

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
        console.error('Subscription update error:', error)
        alert('Payment successful but failed to update subscription. Please contact support.')
      }
    }
    setProcessingPlan('')
    closePaymentModal()
  }

  const handlePaymentClose = () => {
    setProcessingPlan('')
  }

  const getFlutterwaveConfig = (plan: Plan) => {
    const publicKey = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY

    if (!publicKey || publicKey === 'FLWPUBK_TEST-PLACEHOLDER') {
      alert('Payment system is being set up. Please contact kaltrix.ng@gmail.com to upgrade manually.')
      return null
    }

    return {
      public_key: publicKey,
      tx_ref: `kaltrix-${businessId}-${Date.now()}`,
      amount: plan.price,
      currency: 'NGN',
      payment_options: 'card,ussd,banktransfer',
      customer: {
        email: userEmail,
        name: userName || 'Customer',
        phone_number: '08000000000', // ✅ FIX: Added required phone_number field
      },
      customizations: {
        title: 'KaltrixOS',
        description: `${plan.name} Plan — Monthly Subscription`,
        logo: 'https://kaltrix-os.vercel.app/logo.png',
      },
    }
  }

  const plans: Plan[] = [
    {
      name: 'Free',
      price: 0,
      period: 'forever',
      desc: 'Get found online today',
      planKey: 'free',
      features: [
        'Business profile',
        'TrustScore',
        'Basic listing on discover',
        'Customer messaging',
      ],
      highlight: false,
      current: currentPlan === 'free',
    },
    {
      name: 'Growth',
      price: 25000,
      period: 'per month',
      desc: 'For businesses ready to grow',
      planKey: 'growth',
      features: [
        'Everything in Free',
        'Verified badge',
        'Priority discovery listing',
        'Bookings management',
        'Customer CRM',
        'Invoice generator',
      ],
      highlight: true,
      current: currentPlan === 'growth',
    },
    {
      name: 'Pro',
      price: 60000,
      period: 'per month',
      desc: 'For businesses that dominate',
      planKey: 'pro',
      features: [
        'Everything in Growth',
        'Featured placement',
        'Revenue analytics',
        'WhatsApp notifications',
        'Priority support',
        'Custom agency services',
      ],
      highlight: false,
      current: currentPlan === 'pro',
    },
  ]

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
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold mt-2">Upgrade Your Plan</h1>
            <p className="text-gray-400 mt-1">Get more from KaltrixOS</p>
          </div>
          <div className="bg-green-400/10 border border-green-400/20 rounded-xl px-4 py-2 text-center">
            <p className="text-gray-400 text-xs">Current Plan</p>
            <p className="text-green-400 font-black capitalize">{currentPlan}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {plans.map((plan) => {
            const config = getFlutterwaveConfig(plan)
            const isPaymentValid = config !== null && plan.price > 0

            return (
              <div key={plan.name} className={`rounded-2xl p-8 border transition relative ${
                plan.highlight
                  ? 'border-green-400/50 bg-green-400/5 shadow-xl shadow-green-400/10'
                  : 'border-gray-800 bg-gray-900'
              }`}>
                {plan.highlight && !plan.current && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-green-400 text-black text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}
                {plan.current && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-gray-700 text-white text-xs font-black px-4 py-1.5 rounded-full uppercase tracking-wider">
                      Current Plan
                    </span>
                  </div>
                )}

                <p className="text-gray-400 text-sm font-bold uppercase tracking-wider mb-2">{plan.name}</p>
                <div className="flex items-end gap-1 mb-1">
                  <p className="text-4xl font-black">
                    {plan.price === 0 ? 'Free' : `N${plan.price.toLocaleString()}`}
                  </p>
                  {plan.price > 0 && <p className="text-gray-500 text-sm mb-1.5">/{plan.period}</p>}
                </div>
                <p className="text-gray-500 text-sm mb-8">{plan.desc}</p>

                <div className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-3">
                      <div className="w-5 h-5 rounded-full bg-green-400/10 border border-green-400/20 flex items-center justify-center flex-shrink-0">
                        <div className="w-2 h-2 rounded-full bg-green-400" />
                      </div>
                      <p className="text-gray-300 text-sm">{feature}</p>
                    </div>
                  ))}
                </div>

                {plan.current ? (
                  <div className="block text-center font-black py-4 rounded-xl bg-gray-800 text-gray-500 text-lg">
                    Current Plan
                  </div>
                ) : plan.planKey === 'free' ? (
                  <div className="block text-center font-black py-4 rounded-xl bg-gray-800 text-gray-500 text-lg">
                    Free Forever
                  </div>
                ) : isPaymentValid ? (
                  <FlutterWaveButton
                    key={plan.planKey}
                    {...config}
                    text={processingPlan === plan.planKey ? 'Processing...' : `Upgrade to ${plan.name}`}
                    callback={(response) => handlePaymentSuccess(response, plan.planKey)}
                    onClose={handlePaymentClose}
                    className={`w-full block text-center font-black py-4 rounded-xl transition text-lg disabled:opacity-50 ${
                      plan.highlight
                        ? 'bg-green-400 hover:bg-green-300 text-black shadow-lg shadow-green-400/20'
                        : 'bg-gray-800 hover:bg-gray-700 text-white'
                    }`}
                    disabled={processingPlan !== ''}
                  />
                ) : (
                  <button
                    disabled
                    className="w-full block text-center font-black py-4 rounded-xl bg-gray-800 text-gray-500 text-lg cursor-not-allowed"
                  >
                    Payment Unavailable
                  </button>
                )}
              </div>
            )
          })}
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
              { service: 'Professional Website', price: 'From N150,000' },
              { service: 'Booking System', price: 'From N80,000' },
              { service: 'Full Digital Setup', price: 'From N300,000' },
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
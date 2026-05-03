'use client'

import Link from 'next/link'

export default function UpgradePage() {
  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-4xl mx-auto">

        <div className="mb-8">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">
            Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold mt-2">Upgrade Your Plan</h1>
          <p className="text-gray-400 mt-1">Get more from KaltrixOS with a premium plan</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            {
              name: 'Free',
              price: 'N0',
              period: 'forever',
              desc: 'Get found online today',
              features: [
                'Business profile',
                'TrustScore',
                'Basic listing on discover',
                'Customer messaging',
              ],
              highlight: false,
              current: true,
            },
            {
              name: 'Growth',
              price: 'N25,000',
              period: 'per month',
              desc: 'For businesses ready to grow',
              features: [
                'Everything in Free',
                'Verified badge',
                'Priority discovery listing',
                'Bookings management',
                'Customer CRM',
                'Invoice generator',
              ],
              highlight: true,
              current: false,
            },
            {
              name: 'Pro',
              price: 'N60,000',
              period: 'per month',
              desc: 'For businesses that dominate',
              features: [
                'Everything in Growth',
                'Featured placement',
                'Revenue analytics',
                'WhatsApp notifications',
                'Priority support',
                'Custom agency services',
              ],
              highlight: false,
              current: false,
            },
          ].map((plan) => (
            <div key={plan.name} className={`rounded-2xl p-8 border transition relative ${
              plan.highlight
                ? 'border-green-400/50 bg-green-400/5 shadow-xl shadow-green-400/10'
                : 'border-gray-800 bg-gray-900'
            }`}>
              {plan.highlight && (
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
                <p className="text-4xl font-black">{plan.price}</p>
                <p className="text-gray-500 text-sm mb-1.5">/{plan.period}</p>
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
              ) : (
                <a
                  href="mailto:kaltrix.ng@gmail.com?subject=KaltrixOS Upgrade Request"
                  className={`block text-center font-black py-4 rounded-xl transition text-lg ${
                    plan.highlight
                      ? 'bg-green-400 hover:bg-green-300 text-black shadow-lg shadow-green-400/20'
                      : 'bg-gray-800 hover:bg-gray-700 text-white'
                  }`}
                >
                  Upgrade Now
                </a>
              )}
            </div>
          ))}
        </div>

        {/* Agency Services */}
        <div className="bg-green-400/5 border border-green-400/20 rounded-2xl p-8">
          <h2 className="text-xl font-black text-green-400 mb-2">Need a Custom Website?</h2>
          <p className="text-gray-400 mb-6">
            Kaltrix Agency builds professional websites, booking systems, CRMs and
            full digital setups for businesses. Custom pricing based on your needs.
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
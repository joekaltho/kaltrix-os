'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function LandingPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: insertError } = await supabase
      .from('waitlist')
      .insert({ email, name, business_type: businessType })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('This email is already on the waitlist!')
      } else {
        setError(insertError.message)
      }
      setLoading(false)
      return
    }

    setSubmitted(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Navbar */}
      <nav className="border-b border-gray-800/50 px-6 py-4 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-sm z-10">
        <span className="text-xl font-bold tracking-tight">
          Kaltrix<span className="text-green-400">OS</span>
        </span>
        <div className="flex items-center gap-3">
          <Link href="/discover" className="text-sm text-gray-400 hover:text-white transition hidden md:block">
            Discover Businesses
          </Link>
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition px-3 py-1.5">
            Login
          </Link>
          <a href="#waitlist" className="bg-green-400 hover:bg-green-300 text-black text-sm font-bold px-5 py-2.5 rounded-lg transition">
            Join Waitlist
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-green-400/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-green-400/5 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-4xl mx-auto px-6 py-32 text-center relative">

          <h1 className="text-6xl md:text-8xl font-black mb-8 leading-none tracking-tight">
            Get Found.
            <br />
            <span className="text-green-400">Get Trusted.</span>
            <br />
            Get Paid.
          </h1>

          <p className="text-gray-300 text-xl md:text-2xl max-w-3xl mx-auto mb-12 leading-relaxed font-light">
            KaltrixOS is the complete business operating system built for African SMEs.
            A verified profile. A TrustScore. Bookings, invoices, CRM — all in one dashboard.
            <span className="text-white font-semibold"> Built in Nigeria. Built for Africa.</span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <a
              href="#waitlist"
              className="bg-green-400 hover:bg-green-300 text-black font-black px-10 py-5 rounded-xl transition text-xl shadow-lg shadow-green-400/20 hover:shadow-green-400/40"
            >
              Join the Waitlist
            </a>
            <Link
              href="/discover"
              className="bg-gray-900 hover:bg-gray-800 text-white font-bold px-10 py-5 rounded-xl transition text-xl border border-gray-700 hover:border-gray-500"
            >
              Explore Businesses
            </Link>
          </div>

          <p className="text-gray-600 text-sm">
            Free forever. No credit card. No setup fee. Just results.
          </p>

          {/* Hero Visual */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent z-10 pointer-events-none rounded-2xl" />
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 text-left shadow-2xl shadow-green-400/5">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-gray-600 text-xs ml-2">KaltrixOS Dashboard</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'TrustScore', value: '85', color: 'text-green-400' },
                  { label: 'Today Bookings', value: '7', color: 'text-green-400' },
                  { label: 'Revenue', value: 'N420K', color: 'text-green-400' },
                  { label: 'New Messages', value: '3', color: 'text-yellow-400' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <p className="text-gray-500 text-xs mb-1">{stat.label}</p>
                    <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Website', status: 'Live', color: 'text-green-400' },
                  { label: 'Verification', status: 'Verified', color: 'text-green-400' },
                  { label: 'Reviews', status: '4.8 stars', color: 'text-yellow-400' },
                ].map((item) => (
                  <div key={item.label} className="bg-gray-800 rounded-lg p-3 border border-gray-700">
                    <p className="text-gray-500 text-xs">{item.label}</p>
                    <p className={`text-sm font-bold ${item.color}`}>{item.status}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="border-y border-gray-800 bg-gray-900/80">
        <div className="max-w-6xl mx-auto px-6 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { number: '40M+', label: 'SMEs in Nigeria alone' },
              { number: '<2%', label: 'Have functional websites' },
              { number: '98%', label: 'Economically invisible' },
              { number: '$1T+', label: 'Untapped opportunity' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-4xl md:text-5xl font-black text-green-400 mb-2">{stat.number}</p>
                <p className="text-gray-500 text-sm">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <p className="text-red-400 text-sm font-bold uppercase tracking-widest mb-4">The Reality</p>
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Millions of Businesses.
            <br />
            <span className="text-red-400">Zero Online Presence.</span>
          </h2>
          <p className="text-gray-400 text-xl max-w-3xl mx-auto leading-relaxed">
            Right now in Nigeria, Ghana, Kenya — real businesses with real products
            and real customers are losing money every single day because nobody can
            find them online. Not because their product is bad.
            Because they are <span className="text-white font-semibold">invisible.</span>
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              number: '1',
              title: 'Invisible to Google',
              desc: 'A customer searches for your service. You don\'t show up. Your competitor does. You lose the sale before you even knew it existed.',
              color: 'border-red-400/30 bg-red-400/5',
              tag: 'text-red-400 bg-red-400/10 border-red-400/20',
              tagText: 'Critical Problem',
            },
            {
              number: '2',
              title: 'No Credibility Signal',
              desc: 'Customers want to trust you but have no way to verify you are legitimate. No reviews. No score. No proof. They go with someone else.',
              color: 'border-yellow-400/30 bg-yellow-400/5',
              tag: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
              tagText: 'Major Problem',
            },
            {
              number: '3',
              title: 'No Tools to Grow',
              desc: 'Managing bookings on WhatsApp. Invoices on paper. Customers in memory. No system means no growth. Just survival.',
              color: 'border-orange-400/30 bg-orange-400/5',
              tag: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
              tagText: 'Costly Problem',
            },
          ].map((item) => (
            <div key={item.number} className={`rounded-2xl p-8 border ${item.color}`}>
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${item.tag} inline-block mb-6`}>
                {item.tagText}
              </span>
              <div className="text-5xl font-black text-gray-800 mb-4">{item.number}</div>
              <h3 className="text-2xl font-black mb-4">{item.title}</h3>
              <p className="text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Solution */}
      <section className="bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-28">
          <div className="text-center mb-16">
            <p className="text-green-400 text-sm font-bold uppercase tracking-widest mb-4">The Solution</p>
            <h2 className="text-4xl md:text-6xl font-black mb-6">
              Everything Your Business
              <br />
              <span className="text-green-400">Needs. One Platform.</span>
            </h2>
            <p className="text-gray-400 text-xl max-w-2xl mx-auto">
              KaltrixOS does not just give you a profile. It gives your business
              a complete operating system — from discovery to revenue.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: 'V', title: 'Verified Business Profile', desc: 'A professional, verified profile that makes you look legitimate and trustworthy to every customer who finds you.' },
              { icon: 'T', title: 'TrustScore Engine', desc: 'A real credibility score out of 100 built from reviews, verification, and digital presence. Customers know exactly who to trust.' },
              { icon: 'B', title: 'Bookings System', desc: 'Accept and manage appointments directly. No more WhatsApp back and forth. Just confirmed bookings in your dashboard.' },
              { icon: 'C', title: 'Customer CRM', desc: 'Every customer saved automatically. Full history. Know your best customers and reach them when it matters most.' },
              { icon: 'I', title: 'Invoice Generator', desc: 'Create professional invoices in seconds. Send them. Track what is paid. Know exactly where your money is.' },
              { icon: 'R', title: 'Revenue Dashboard', desc: 'See your revenue, bookings, and growth in real time. Run your business on data not guesswork.' },
            ].map((feature) => (
              <div key={feature.title} className="bg-gray-900 rounded-2xl p-8 border border-gray-800 hover:border-green-400/40 transition-all group cursor-default">
                <div className="w-12 h-12 bg-green-400/10 border border-green-400/20 rounded-2xl flex items-center justify-center text-green-400 font-black text-lg mb-6 group-hover:bg-green-400 group-hover:text-black transition-all">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black mb-3">{feature.title}</h3>
                <p className="text-gray-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <p className="text-green-400 text-sm font-bold uppercase tracking-widest mb-4">Simple Process</p>
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Live in <span className="text-green-400">5 Minutes.</span>
          </h2>
          <p className="text-gray-400 text-xl">No tech skills. No setup fee. Just your business online.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {[
            { step: '01', title: 'Register Your Business', desc: 'Create your free account. Fill in your business details. Upload your logo. Done in under 5 minutes.' },
            { step: '02', title: 'Get Your TrustScore', desc: 'Your profile is scored instantly out of 100. See exactly what to improve to rank higher and attract more customers.' },
            { step: '03', title: 'Grow Your Business', desc: 'Customers discover you, message you, book you, and review you. You manage everything from one powerful dashboard.' },
          ].map((item, i) => (
            <div key={item.step} className="relative">
              {i < 2 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-px bg-gradient-to-r from-gray-700 to-transparent z-0" />
              )}
              <div className="text-7xl font-black text-gray-800/60 mb-6 leading-none">{item.step}</div>
              <h3 className="text-2xl font-black mb-4">{item.title}</h3>
              <p className="text-gray-400 leading-relaxed text-lg">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Investor Section */}
      <section className="bg-gray-900/50 border-y border-gray-800">
        <div className="max-w-6xl mx-auto px-6 py-28">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
            <div>
              <p className="text-green-400 text-sm font-bold uppercase tracking-widest mb-6">For Investors</p>
              <h2 className="text-4xl md:text-5xl font-black mb-8 leading-tight">
                We Are Building the Infrastructure Africa&apos;s Economy Has Been Missing.
              </h2>
              <p className="text-gray-400 text-lg leading-relaxed mb-8">
                KaltrixOS is not a directory. It is the credibility and operating layer
                sitting beneath 44 million SMEs that have never had digital infrastructure.
                We monetize through subscriptions, premium services, and a built-in
                agency pipeline that converts platform users into full agency clients.
              </p>
              <div className="space-y-4">
                {[
                  '44M+ SMEs across Africa with zero digital infrastructure',
                  'Recurring subscription revenue from day one',
                  'Built-in lead generation for Kaltrix Agency',
                  'Data layer for fintech, banks, and investors',
                  'Expansion roadmap: Ghana, Kenya, South Africa',
                ].map((point) => (
                  <div key={point} className="flex items-start gap-4">
                    <div className="w-6 h-6 rounded-full bg-green-400/10 border border-green-400/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-green-400" />
                    </div>
                    <p className="text-gray-300">{point}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { number: '44M+', label: 'SME Target Market' },
                { number: 'N25K', label: 'Monthly Per Business' },
                { number: '3', label: 'Revenue Streams' },
                { number: '1', label: 'Platform. All of Africa.' },
              ].map((stat) => (
                <div key={stat.label} className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center hover:border-green-400/30 transition">
                  <p className="text-4xl font-black text-green-400 mb-2">{stat.number}</p>
                  <p className="text-gray-500 text-sm">{stat.label}</p>
                </div>
              ))}
              <div className="col-span-2 bg-green-400/5 border border-green-400/20 rounded-2xl p-6 text-center">
                <p className="text-green-400 font-black text-lg mb-1">Early Stage. Real Product.</p>
                <p className="text-gray-400 text-sm">Built and live. Looking for visionary partners.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-6xl mx-auto px-6 py-28">
        <div className="text-center mb-16">
          <p className="text-green-400 text-sm font-bold uppercase tracking-widest mb-4">Pricing</p>
          <h2 className="text-4xl md:text-6xl font-black mb-6">
            Start Free. <span className="text-green-400">Scale When Ready.</span>
          </h2>
          <p className="text-gray-400 text-xl">No contracts. No hidden fees. Cancel anytime.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: 'Free',
              price: 'N0',
              period: 'forever',
              desc: 'Get found online today',
              features: ['Business profile', 'TrustScore', 'Basic listing on discover', 'Customer messaging'],
              highlight: false,
            },
            {
              name: 'Growth',
              price: 'N25,000',
              period: 'per month',
              desc: 'For businesses ready to grow',
              features: ['Everything in Free', 'Verified badge', 'Priority discovery listing', 'Bookings management', 'Customer CRM', 'Invoice generator'],
              highlight: true,
            },
            {
              name: 'Pro',
              price: 'N60,000',
              period: 'per month',
              desc: 'For businesses that dominate',
              features: ['Everything in Growth', 'Featured placement', 'Revenue analytics', 'WhatsApp notifications', 'Priority support', 'Custom agency services'],
              highlight: false,
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
              <a
                href="#waitlist"
                className={`block text-center font-black py-4 rounded-xl transition text-lg ${
                  plan.highlight
                    ? 'bg-green-400 hover:bg-green-300 text-black shadow-lg shadow-green-400/20'
                    : 'bg-gray-800 hover:bg-gray-700 text-white'
                }`}
              >
                Join Waitlist
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section className="relative overflow-hidden border-t border-gray-800" id="waitlist">
        <div className="absolute inset-0 bg-gradient-to-br from-green-400/10 via-transparent to-transparent pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-green-400/5 rounded-full blur-3xl pointer-events-none" />
        <div className="max-w-2xl mx-auto px-6 py-32 text-center relative">
          <div className="inline-flex items-center gap-2 bg-green-400/10 border border-green-400/30 rounded-full px-5 py-2 mb-8">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-bold tracking-wider uppercase">
              Launch Coming Soon
            </span>
          </div>

          <h2 className="text-5xl md:text-7xl font-black mb-6 leading-tight">
            Be First.
            <br />
            <span className="text-green-400">Join the Waitlist.</span>
          </h2>
          <p className="text-gray-300 text-xl mb-12 leading-relaxed">
            KaltrixOS is almost ready. Join the waitlist and be the first to get
            access when we launch. Early members get free verified status and
            priority listing.
          </p>

          {submitted ? (
            <div className="bg-green-400/10 border border-green-400/30 rounded-2xl p-10">
              <div className="w-16 h-16 bg-green-400/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-8 h-8 bg-green-400 rounded-full" />
              </div>
              <h3 className="text-2xl font-black text-green-400 mb-2">You are on the list!</h3>
              <p className="text-gray-400">
                We will notify you the moment KaltrixOS launches.
                Share with other business owners to move up the list.
              </p>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="space-y-4 text-left">
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-sm text-center">
                  {error}
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition text-lg"
                />
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-white focus:outline-none focus:border-green-400 transition text-lg"
                >
                  <option value="">I am a...</option>
                  <option value="business_owner">Business Owner</option>
                  <option value="investor">Investor</option>
                  <option value="customer">Customer</option>
                  <option value="developer">Developer</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <input
                type="email"
                placeholder="Your email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-gray-900 border border-gray-700 rounded-xl px-5 py-4 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition text-lg"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-400 hover:bg-green-300 text-black font-black py-5 rounded-xl transition text-xl shadow-xl shadow-green-400/20 hover:shadow-green-400/40 disabled:opacity-50"
              >
                {loading ? 'Joining...' : 'Join the Waitlist'}
              </button>
              <p className="text-gray-600 text-sm text-center">
                No spam. Just a notification when we launch. That is it.
              </p>
            </form>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <span className="text-2xl font-black">
              Kaltrix<span className="text-green-400">OS</span>
            </span>
            <p className="text-gray-600 text-xs mt-1">Africa&apos;s Business Operating System</p>
          </div>
          <div className="flex items-center gap-8 text-sm text-gray-500">
            <Link href="/discover" className="hover:text-white transition">Discover</Link>
            <Link href="/register" className="hover:text-white transition">Register</Link>
            <Link href="/login" className="hover:text-white transition">Login</Link>
            <Link href="/admin" className="hover:text-white transition">Admin</Link>
          </div>
          <p className="text-gray-700 text-sm">
            Built by <span className="text-gray-500">Kaltrix Agency</span> · Digital Systems and Solutions
          </p>
        </div>
      </footer>

    </div>
  )
}
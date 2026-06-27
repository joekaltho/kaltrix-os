'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const features = [
  {
    title: 'Verified Profile',
    desc: 'A public business page with your TrustScore, reviews, and verified badge — everything a new customer needs to trust you.',
    icon: (
      <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    title: 'Bookings',
    desc: 'Let customers book services directly. Confirm, reschedule, or cancel in one tap. No more WhatsApp chaos.',
    icon: (
      <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Customer CRM',
    desc: 'Keep a clean record of every customer — contact, history, notes. Know your regulars. Grow loyalty.',
    icon: (
      <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    title: 'Invoice Generator',
    desc: 'Create and send professional invoices in seconds. Track paid, unpaid, and overdue — automatically.',
    icon: (
      <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    title: 'Inbox',
    desc: 'One unified inbox for all customer messages. Never miss a lead. Reply fast, close more.',
    icon: (
      <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    title: 'Analytics',
    desc: 'Revenue trends, booking rates, customer growth. Real data to make real business decisions.',
    icon: (
      <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

// Fade-up with scale animation
const FadeUp = ({ children, delay = 0, className = '' }: { children: React.ReactNode; delay?: number; className?: string }) => {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
      }`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  )
}

// Glitch text effect
const GlitchText = ({ children }: { children: React.ReactNode }) => {
  return (
    <span className="relative inline-block">
      <span className="relative z-10">{children}</span>
      <span className="absolute inset-0 text-brand/20 blur-[2px] -translate-x-1 -translate-y-0.5 animate-pulse-slow">{children}</span>
    </span>
  )
}

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setIsLoggedIn(true)
    })

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="min-h-screen bg-ivory text-ink font-sans overflow-x-hidden">

      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand/5 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] rounded-full bg-brand/5 blur-3xl" style={{ animationDelay: '3s' }} />
        {/* Interactive glow */}
        <div 
          className="absolute w-[600px] h-[600px] rounded-full bg-brand/5 blur-3xl transition-all duration-300 ease-out pointer-events-none"
          style={{
            left: `${mousePosition.x - 300}px`,
            top: `${mousePosition.y - 300}px`,
          }}
        />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-border shadow-card backdrop-blur-xl bg-white/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <span className="text-base sm:text-lg font-black tracking-tight group cursor-pointer">
            Kaltrix<span className="text-brand transition-all duration-300 group-hover:scale-110 inline-block">OS</span>
          </span>
          <div className="flex items-center gap-1 sm:gap-2">
            <Link href="/discover" className="hidden md:block text-sm text-inkFaint hover:text-ink transition-all duration-300 px-3 py-1.5 font-medium hover:bg-ivoryDim rounded-lg hover:scale-105">
              Discover
            </Link>
            {isLoggedIn ? (
              <Link href="/dashboard" className="text-xs sm:text-sm font-black gradient-brand text-white px-3 sm:px-4 py-2 rounded-lg hover:shadow-brand transition-all duration-300 hover:-translate-y-0.5 hover:scale-105">
                Dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="text-sm text-inkFaint hover:text-ink transition-all duration-300 px-3 py-1.5 font-medium hover:bg-ivoryDim rounded-lg hover:scale-105">
                  Sign in
                </Link>
                <Link href="/signup" className="text-xs sm:text-sm font-black bg-ink text-ivory px-3 sm:px-4 py-2 rounded-lg hover:bg-inkMid transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:scale-105">
                  Get Started
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12 sm:pb-20">
        <div className="relative z-10 max-w-3xl">
          <FadeUp>
            <div className="inline-flex items-center gap-2 bg-brandBg border border-brand/20 rounded-full px-3 sm:px-4 py-1.5 mb-6 sm:mb-8 hover:border-brand/40 transition-all duration-300 hover:scale-105 hover:shadow-brand">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-slow" />
              <span className="text-brand text-xs font-bold tracking-wide uppercase">Built in Nigeria · Built for Africa</span>
            </div>
          </FadeUp>

          <FadeUp delay={100}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black leading-[1.05] tracking-tight mb-5 sm:mb-6">
              Get Found.<br />
              Get Trusted.<br />
              <span className="relative">
                <span className="text-brand relative z-10">Get Paid.</span>
                <span className="absolute inset-0 bg-brand/10 blur-2xl -z-0 animate-pulse-slow" />
              </span>
            </h1>
          </FadeUp>

          <FadeUp delay={200}>
            <p className="text-inkMid text-base sm:text-lg md:text-xl leading-relaxed max-w-xl mb-8 sm:mb-10">
              KaltrixOS is the complete business operating system built for African SMEs. 
              A verified profile. A TrustScore. Bookings, invoices, CRM — all in one dashboard. 
              Built in Nigeria. Built for Africa.
            </p>
          </FadeUp>

          <FadeUp delay={300}>
            <div className="flex flex-col sm:flex-row gap-3 mb-4 sm:mb-6">
              {isLoggedIn ? (
                <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 gradient-brand text-white font-black px-6 sm:px-7 py-3.5 rounded-xl transition-all duration-300 hover:shadow-brandLg hover:-translate-y-1 hover:scale-105 text-sm sm:text-base group">
                  Go to Dashboard
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              ) : (
                <>
                  <Link href="/signup" className="inline-flex items-center justify-center gap-2 gradient-brand text-white font-black px-6 sm:px-7 py-3.5 rounded-xl transition-all duration-300 hover:shadow-brandLg hover:-translate-y-1 hover:scale-105 text-sm sm:text-base group">
                    Get Started Free
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                  <Link href="/discover" className="inline-flex items-center justify-center gap-2 bg-white border border-border hover:border-inkFaint hover:shadow-lift text-ink font-semibold px-6 sm:px-7 py-3.5 rounded-xl transition-all duration-300 hover:-translate-y-1 hover:scale-105 text-sm sm:text-base shadow-card group">
                    Explore Businesses
                    <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </>
              )}
            </div>
          </FadeUp>

          <FadeUp delay={400}>
            <p className="text-inkFaint text-sm flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-slow" />
              Free forever plan · No credit card required
            </p>
          </FadeUp>
        </div>

        {/* Dashboard preview with morphing animation */}
        <FadeUp delay={500}>
          <div className="mt-14 sm:mt-20 rounded-2xl border border-border bg-white shadow-lift overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.01] group">
            <div className="bg-ivoryDim border-b border-border px-4 py-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" style={{ animationDelay: '0.4s' }} />
              <span className="text-inkFaint text-xs ml-2 font-medium">KaltrixOS — Dashboard</span>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto">
              <div className="min-w-[480px]">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'TrustScore', value: '85', sub: 'Excellent' },
                    { label: "Today's Bookings", value: '7', sub: '+2 pending' },
                    { label: 'Revenue', value: '₦420K', sub: 'This month' },
                    { label: 'Messages', value: '3', sub: 'Unread' },
                  ].map((stat, i) => (
                    <div key={stat.label} className="bg-ivory rounded-xl p-3 sm:p-4 border border-border transition-all duration-300 hover:border-brand/20 hover:shadow-card hover:-translate-y-1 group">
                      <p className="text-inkFaint text-xs mb-1.5 font-medium uppercase tracking-wider">{stat.label}</p>
                      <p className="text-xl sm:text-2xl font-black text-ink">{stat.value}</p>
                      <p className="text-brand text-xs mt-1 font-semibold transition-transform duration-300 group-hover:translate-x-0.5">{stat.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Verification', status: 'Verified' },
                    { label: 'Discovery', status: 'Priority listing' },
                    { label: 'Reviews', status: '4.8 · 42 reviews' },
                  ].map((item) => (
                    <div key={item.label} className="bg-ivory rounded-lg px-3 sm:px-4 py-3 border border-border transition-all duration-300 hover:border-brand/20 hover:-translate-y-0.5">
                      <p className="text-inkFaint text-xs font-medium uppercase tracking-wider">{item.label}</p>
                      <p className="text-ink text-sm font-black mt-0.5">{item.status}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* Stats band with scale animation */}
      <section className="relative bg-ink overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { number: '40M+', label: 'SMEs in Nigeria alone' },
              { number: '<2%', label: 'Have functional websites' },
              { number: '98%', label: 'Economically invisible' },
              { number: '$1T+', label: 'Untapped opportunity' },
            ].map((stat, i) => (
              <div key={stat.label} className="group transition-all duration-500 hover:scale-110">
                <p className="text-3xl sm:text-4xl font-black text-brand mb-1">{stat.number}</p>
                <p className="text-white/40 text-xs sm:text-sm group-hover:text-white/60 transition-colors duration-300">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <div className="grid md:grid-cols-2 gap-10 sm:gap-16 items-start">
          <FadeUp>
            <div>
              <p className="text-red-500 text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-red-500 rounded-full" />
                The Problem
              </p>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight mb-5 sm:mb-6">
                Millions of businesses.<br />Zero digital presence.
              </h2>
              <p className="text-inkMid leading-relaxed mb-6 text-sm sm:text-base">
                Nigerian SMBs run on referrals, word of mouth, and luck. No website. No reviews.
                No way to take bookings or send invoices without WhatsApp back-and-forths.
              </p>
              <div className="space-y-3">
                {[
                  "Customers can't find you online",
                  'No trust signal for new customers',
                  'Manual invoicing wastes hours',
                  'Zero data on your own business',
                ].map((item, i) => (
                  <div key={item} className="flex items-center gap-3 group transition-all duration-300 hover:translate-x-1">
                    <div className="w-5 h-5 rounded-full bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                      <svg className="w-3 h-3 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                    <p className="text-inkMid text-sm transition-colors duration-300 group-hover:text-ink">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>

          <FadeUp delay={150}>
            <div>
              <p className="text-brand text-xs font-black uppercase tracking-widest mb-4 flex items-center gap-2">
                <span className="w-1 h-4 bg-brand rounded-full" />
                The Solution
              </p>
              <h2 className="text-3xl sm:text-4xl font-black leading-tight mb-5 sm:mb-6">
                One dashboard.<br />Everything handled.
              </h2>
              <p className="text-inkMid leading-relaxed mb-6 text-sm sm:text-base">
                KaltrixOS gives every SMB a verified profile, a TrustScore customers can see,
                and a full business OS — bookings, CRM, invoices — in one place.
              </p>
              <div className="space-y-3">
                {[
                  'Verified business profile, indexed and discoverable',
                  'TrustScore that builds credibility automatically',
                  'Bookings, CRM and invoices in one dashboard',
                  'Analytics to understand your business',
                ].map((item, i) => (
                  <div key={item} className="flex items-center gap-3 group transition-all duration-300 hover:translate-x-1">
                    <div className="w-5 h-5 rounded-full bg-brandBg border border-brand/20 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                      <svg className="w-3 h-3 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-inkMid text-sm transition-colors duration-300 group-hover:text-ink">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* Features with staggered animation */}
      <section className="relative bg-ivoryDim border-y border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ivory via-transparent to-ivory opacity-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-16">
              <p className="text-brand text-xs font-black uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                <span className="w-8 h-px bg-brand/30" />
                What You Get
                <span className="w-8 h-px bg-brand/30" />
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black">Everything in one place</h2>
            </div>
          </FadeUp>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {features.map((f, i) => (
              <FadeUp key={f.title} delay={i * 100}>
                <div className="bg-white rounded-2xl p-6 border border-border shadow-card transition-all duration-500 hover:shadow-lift hover:-translate-y-2 hover:scale-[1.02] hover:border-brand/20 group">
                  <div className="w-9 h-9 bg-brandBg border border-brand/20 rounded-xl flex items-center justify-center mb-4 transition-all duration-500 group-hover:scale-110 group-hover:border-brand group-hover:shadow-brand">
                    {f.icon}
                  </div>
                  <h3 className="font-black text-base sm:text-lg mb-2">{f.title}</h3>
                  <p className="text-inkFaint text-sm leading-relaxed">{f.desc}</p>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <FadeUp>
          <div className="text-center mb-10 sm:mb-16">
            <p className="text-brand text-xs font-black uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
              <span className="w-8 h-px bg-brand/30" />
              Pricing
              <span className="w-8 h-px bg-brand/30" />
            </p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-4">Start free. Grow when ready.</h2>
            <p className="text-inkMid text-sm sm:text-base">No monthly traps. 6-month and annual plans only.</p>
          </div>
        </FadeUp>

        <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {[
            {
              name: 'Free',
              price: '₦0',
              period: 'forever',
              desc: 'Get found online today',
              features: ['Business profile', 'TrustScore', 'Basic discovery listing', 'Customer inbox'],
              highlight: false,
              cta: 'Start Free',
              ctaLink: '/signup',
            },
            {
              name: 'Growth',
              price: '₦8,250',
              period: '/mo equiv',
              desc: 'For businesses ready to grow',
              features: ['Everything in Free', 'Verified badge', 'Priority listing', 'Bookings', 'CRM', 'Invoices'],
              highlight: true,
              cta: 'Start Growth',
              ctaLink: '/signup',
            },
            {
              name: 'Pro',
              price: '₦20,800',
              period: '/mo equiv',
              desc: 'For businesses that dominate',
              features: ['Everything in Growth', 'Featured placement', 'Analytics', 'Priority support', 'Agency consultation'],
              highlight: false,
              cta: 'Start Pro',
              ctaLink: '/signup',
            },
          ].map((plan, i) => (
            <FadeUp key={plan.name} delay={i * 150}>
              <div className={`rounded-2xl p-6 sm:p-7 border relative flex flex-col transition-all duration-500 hover:-translate-y-2 hover:scale-[1.02] ${
                plan.highlight
                  ? 'border-brand/40 bg-brandBg shadow-brand hover:shadow-brandLg'
                  : 'border-border bg-white shadow-card hover:shadow-lift'
              }`}>
                {plan.highlight && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap animate-pulse-slow">
                    <span className="gradient-brand text-white text-xs font-black px-4 py-1 rounded-full uppercase tracking-wide shadow-brand">
                      Most Popular
                    </span>
                  </div>
                )}
                <p className="text-xs font-black uppercase tracking-widest text-inkFaint mb-3">{plan.name}</p>
                <div className="mb-1">
                  <span className="text-2xl sm:text-3xl font-black">{plan.price}</span>
                  <span className="text-inkFaint text-xs ml-1">{plan.period}</span>
                </div>
                <p className="text-inkFaint text-sm mb-5">{plan.desc}</p>
                <div className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map(f => (
                    <div key={f} className="flex items-center gap-2.5 group transition-all duration-300 hover:translate-x-1">
                      <div className="w-4 h-4 rounded-full bg-brandBg border border-brand/20 flex items-center justify-center flex-shrink-0 transition-transform duration-300 group-hover:scale-110">
                        <svg className="w-2.5 h-2.5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-inkMid text-sm transition-colors duration-300 group-hover:text-ink">{f}</p>
                    </div>
                  ))}
                </div>
                <Link href={plan.ctaLink} className={`block text-center text-sm font-black py-3 rounded-xl transition-all duration-300 ${
                  plan.highlight
                    ? 'gradient-brand text-white shadow-brand hover:shadow-brandLg hover:-translate-y-0.5 hover:scale-105'
                    : 'bg-ivory hover:bg-ivoryDim text-ink border border-border hover:border-inkFaint hover:-translate-y-0.5 hover:scale-105'
                }`}>
                  {plan.cta}
                </Link>
              </div>
            </FadeUp>
          ))}
        </div>
      </section>

      {/* CTA Banner with morphing background */}
      <section className="relative bg-ink overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-transparent transition-all duration-1000 group-hover:from-brand/20" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.05),transparent_70%)] animate-pulse-slow" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/20 to-transparent" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-16 sm:py-20 text-center">
          <FadeUp>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 transition-all duration-500 group-hover:scale-[1.02]">
              Ready to grow your business?
            </h2>
          </FadeUp>
          <FadeUp delay={100}>
            <p className="text-white/40 text-base sm:text-lg mb-8 max-w-2xl mx-auto transition-all duration-500 group-hover:text-white/60">
              Join thousands of African businesses using KaltrixOS to build trust, close more deals, and grow faster.
            </p>
          </FadeUp>
          <FadeUp delay={200}>
            <Link href="/signup" className="inline-flex items-center justify-center gap-2 gradient-brand text-white font-black px-8 sm:px-10 py-4 rounded-xl transition-all duration-300 hover:shadow-brandLg hover:-translate-y-1 hover:scale-105 text-base sm:text-lg group">
              Get Started Free
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </FadeUp>
          <FadeUp delay={300}>
            <p className="text-white/20 text-xs mt-4 transition-all duration-300 group-hover:text-white/30">No credit card required · Free forever plan</p>
          </FadeUp>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ivory border-t border-border relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
          <div className="text-center sm:text-left">
            <span className="text-base font-black">Kaltrix<span className="text-brand">OS</span></span>
            <p className="text-inkFaint text-xs mt-0.5">Africa's Business Operating System</p>
          </div>
          <div className="flex items-center gap-5 text-sm text-inkFaint">
            <Link href="/discover" className="hover:text-ink transition-all duration-300 hover:underline underline-offset-4 hover:scale-105">Discover</Link>
            <Link href="/signup" className="hover:text-ink transition-all duration-300 hover:underline underline-offset-4 hover:scale-105">Register</Link>
            <Link href="/login" className="hover:text-ink transition-all duration-300 hover:underline underline-offset-4 hover:scale-105">Sign in</Link>
          </div>
          <p className="text-inkFaint text-xs text-center sm:text-right">
            Built by <span className="text-inkMid font-semibold">Kaltrix Agency</span>
          </p>
        </div>
      </footer>

    </div>
  )
}
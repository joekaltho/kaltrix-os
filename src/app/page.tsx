'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import { PLAN_PRICES_NGN, monthlyEquivNgn, type BillingPeriod } from '@/lib/plans'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

const PRICING_PLANS = [
  {
    key: 'free' as const,
    name: 'Free',
    desc: 'Get found online today',
    features: ['Business profile', 'TrustScore', 'Basic discovery listing', 'Customer inbox', 'Shop (10 listings)'],
    highlight: false,
    cta: 'Start Free',
    ctaLink: '/signup',
  },
  {
    key: 'growth' as const,
    name: 'Growth',
    desc: 'For businesses ready to grow',
    features: ['Everything in Free', 'Unlimited Shop', 'Bookings', 'CRM', 'Invoices'],
    highlight: true,
    cta: 'Start Growth',
    ctaLink: '/signup',
  },
  {
    key: 'pro' as const,
    name: 'Pro',
    desc: 'For businesses that dominate',
    features: ['Everything in Growth', 'Analytics', 'Priority support', 'Agency consultation'],
    highlight: false,
    cta: 'Start Pro',
    ctaLink: '/signup',
  },
]

const productGroups = [
  {
    key: 'found',
    label: 'Get Found',
    blurb: 'Show up where customers are already looking.',
    items: [
      {
        title: 'Public Business Profile',
        desc: 'A public page for your business — logo, description, contact info — that customers can find and share.',
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
        ),
      },
      {
        title: 'Discover',
        desc: "Your business shows up in Discover — KaltrixOS's directory of listed businesses, sorted by TrustScore.",
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
        ),
      },
      {
        title: 'Shop / Listings',
        desc: 'List what you sell or offer right on your profile, so people can browse before they even reach out.',
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
          </svg>
        ),
      },
    ],
  },
  {
    key: 'trusted',
    label: 'Get Trusted',
    blurb: 'Give customers a real reason to trust you before they buy.',
    items: [
      {
        title: 'TrustScore',
        desc: "An evidence-based score built from verification and real activity — not something a business can just set itself.",
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        ),
      },
      {
        title: 'Reviews',
        desc: 'Customers leave real reviews on your profile, visible to anyone checking you out.',
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        ),
      },
      {
        title: 'Complete Business Profile',
        desc: 'The more of your profile you fill in — description, contact details, socials — the more it feeds into your TrustScore.',
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ),
      },
    ],
  },
  {
    key: 'run',
    label: 'Run Your Business',
    blurb: 'Replace the WhatsApp back-and-forth with a real system.',
    items: [
      {
        title: 'Bookings',
        desc: 'Let customers book services directly. Confirm, reschedule, or cancel in one tap.',
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
      {
        title: 'Customer CRM',
        desc: 'Keep a clean record of every customer — contact, history, notes. Know your regulars.',
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
      {
        title: 'Invoices',
        desc: 'Create and send professional invoices in seconds. Track paid, unpaid, and overdue.',
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        ),
      },
      {
        title: 'Inbox',
        desc: 'One unified inbox for every customer message that comes through your profile.',
        icon: (
          <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
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

export default function LandingPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [pricingBilling, setPricingBilling] = useState<BillingPeriod>('annual')

  useEffect(() => {
    const supabase = createClient()
    getSessionUser(supabase).then(({ data }) => {
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
        <div 
          className="absolute w-[600px] h-[600px] rounded-full bg-brand/5 blur-3xl transition-all duration-300 ease-out pointer-events-none"
          style={{
            left: `${mousePosition.x - 300}px`,
            top: `${mousePosition.y - 300}px`,
          }}
        />
      </div>

      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-border shadow-card backdrop-blur-xl bg-white/70 dark:bg-ink/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link href="/" className="text-base sm:text-lg font-black tracking-tight group">
            Kaltrix<span className="text-brand transition-all duration-300 group-hover:scale-110 inline-block">OS</span>
          </Link>
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
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-12 sm:pb-20">
        <div className="relative z-10 max-w-3xl">
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
              A public profile. A TrustScore. Bookings, invoices, CRM — all in one dashboard. 
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

        {/* Dashboard preview */}
        <FadeUp delay={500}>
          <div className="mt-14 sm:mt-20 rounded-2xl border border-border bg-white shadow-lift overflow-hidden transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 hover:scale-[1.01] group">
            <div className="bg-ivoryDim border-b border-border px-4 py-3 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400 animate-pulse" />
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 animate-pulse" style={{ animationDelay: '0.2s' }} />
              <span className="w-2.5 h-2.5 rounded-full bg-brand animate-pulse" style={{ animationDelay: '0.4s' }} />
              <span className="text-inkFaint text-xs ml-2 font-medium">KaltrixOS — Dashboard</span>
              <span className="ml-auto inline-flex items-center gap-1 text-amber-700 text-[10px] font-bold uppercase tracking-wider bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.72-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.743 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Sample data
              </span>
            </div>
            <div className="p-4 sm:p-6 overflow-x-auto">
              <div className="min-w-[480px]">
                <div className="grid grid-cols-4 gap-3 mb-4">
                  {[
                    { label: 'TrustScore', value: '85', sub: 'Excellent' },
                    { label: "Today's Bookings", value: '7', sub: '+2 pending' },
                    { label: 'Revenue', value: '₦420K', sub: 'This month' },
                    { label: 'Messages', value: '3', sub: 'Unread' },
                  ].map((stat) => (
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
                    { label: 'Discovery', status: 'Listed on Discover' },
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
          <p className="text-center text-inkFaint text-xs mt-3">
            Illustrative preview — not a real business&apos;s dashboard or real platform statistics.
          </p>
        </FadeUp>
      </section>

      {/* Stats band */}
      <section className="relative bg-inkStatic overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-transparent to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            {[
              { number: '39M+', label: 'MSMEs in Nigeria' },
              { number: '96.9%', label: 'of all Nigerian businesses' },
              { number: '46.3%', label: 'share of national GDP' },
              { number: '6.2%', label: 'share of exports' },
            ].map((stat) => (
              <div key={stat.label} className="group transition-all duration-500 hover:scale-110">
                <p className="text-3xl sm:text-4xl font-black text-brand mb-1">{stat.number}</p>
                <p className="text-white/40 text-xs sm:text-sm group-hover:text-white/60 transition-colors duration-300">{stat.label}</p>
              </div>
            ))}
          </div>
          <p className="relative text-center text-white/25 text-[11px] mt-6">
            Source:{' '}
            <a
              href="https://smedan.gov.ng/downloads/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-white/50"
            >
              SMEDAN / NBS 2021 National MSME Survey
            </a>
          </p>
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
                Millions of businesses.<br />Limited digital infrastructure.
              </h2>
              <p className="text-inkMid leading-relaxed mb-6 text-sm sm:text-base">
                Most Nigerian SMBs still run on referrals and WhatsApp — not a real website,
                not a place for reviews to build up, not a system for bookings or invoices.
                A few have pieced together a presence online. Almost none have all of it in one place.
              </p>
              <div className="space-y-3">
                {[
                  "Customers can't find you online",
                  'No trust signal for new customers',
                  'Manual invoicing wastes hours',
                  'Zero data on your own business',
                ].map((item) => (
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
                KaltrixOS gives every SMB a public profile, a TrustScore customers can see,
                and a full business OS — bookings, CRM, invoices — in one place.
              </p>
              <div className="space-y-3">
                {[
                  'Public business profile, indexed and discoverable',
                  'TrustScore that builds credibility automatically',
                  'Bookings, CRM and invoices in one dashboard',
                  'Analytics to understand your business',
                ].map((item) => (
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

      {/* Product overview */}
      <section className="relative bg-ivoryDim border-y border-border overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-ivory via-transparent to-ivory opacity-50" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
          <FadeUp>
            <div className="text-center mb-10 sm:mb-16">
              <p className="text-brand text-xs font-black uppercase tracking-widest mb-3 flex items-center justify-center gap-2">
                <span className="w-8 h-px bg-brand/30" />
                The Product
                <span className="w-8 h-px bg-brand/30" />
              </p>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black mb-3">What you can do with KaltrixOS today</h2>
              <p className="text-inkMid text-sm sm:text-base max-w-xl mx-auto">
                Everything below is live in the product right now — not a roadmap.
              </p>
            </div>
          </FadeUp>

          {productGroups.map((group, gi) => (
            <FadeUp key={group.key} delay={gi * 80}>
              <div className="mb-10 sm:mb-14">
                <div className="mb-5 flex items-baseline gap-3 flex-wrap">
                  <h3 className="text-lg sm:text-xl font-black text-ink">{group.label}</h3>
                  <p className="text-inkFaint text-xs sm:text-sm">{group.blurb}</p>
                </div>
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {group.items.map((item) => (
                    <div key={item.title} className="bg-white rounded-2xl p-5 border border-border shadow-card transition-all duration-500 hover:shadow-lift hover:-translate-y-1 hover:border-brand/20 group">
                      <div className="w-9 h-9 bg-brandBg border border-brand/20 rounded-xl flex items-center justify-center mb-3 transition-all duration-500 group-hover:scale-110 group-hover:border-brand group-hover:shadow-brand">
                        {item.icon}
                      </div>
                      <h4 className="font-black text-sm sm:text-base mb-1.5">{item.title}</h4>
                      <p className="text-inkFaint text-xs sm:text-sm leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </FadeUp>
          ))}

          {/* Understand Your Business — Business Pulse gets real emphasis here,
              not a generic grid card, because it's the one that ties revenue,
              expenses, invoices, transactions, customers, and growth together
              into a single Business Health Score. */}
          <FadeUp delay={productGroups.length * 80}>
            <div>
              <div className="mb-5 flex items-baseline gap-3 flex-wrap">
                <h3 className="text-lg sm:text-xl font-black text-ink">Understand Your Business</h3>
                <p className="text-inkFaint text-xs sm:text-sm">See what&apos;s actually happening, not just what you assume.</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="bg-white rounded-2xl p-5 border border-border shadow-card transition-all duration-500 hover:shadow-lift hover:-translate-y-1 hover:border-brand/20 group">
                  <div className="w-9 h-9 bg-brandBg border border-brand/20 rounded-xl flex items-center justify-center mb-3 transition-all duration-500 group-hover:scale-110 group-hover:border-brand group-hover:shadow-brand">
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="font-black text-sm sm:text-base mb-1.5">Dashboard</h4>
                  <p className="text-inkFaint text-xs sm:text-sm leading-relaxed">
                    Today&apos;s bookings, unread messages, unpaid invoices, and revenue at a glance the moment you log in.
                  </p>
                </div>

                <div className="sm:col-span-2 bg-gradient-to-br from-brandBg to-white rounded-2xl p-5 sm:p-6 border-2 border-brand/25 shadow-card transition-all duration-500 hover:shadow-lift hover:-translate-y-1 group relative overflow-hidden">
                  <span className="absolute top-4 right-4 text-brand text-[10px] font-black uppercase tracking-wider bg-white/70 border border-brand/20 px-2 py-0.5 rounded-full">
                    Most Powerful
                  </span>
                  <div className="w-10 h-10 bg-white border border-brand/30 rounded-xl flex items-center justify-center mb-3 transition-all duration-500 group-hover:scale-110 group-hover:shadow-brand">
                    <svg className="w-5 h-5 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 12h4l3 8 4-16 3 8h4" />
                    </svg>
                  </div>
                  <h4 className="font-black text-base sm:text-lg mb-1.5">Business Pulse</h4>
                  <p className="text-inkMid text-xs sm:text-sm leading-relaxed max-w-md">
                    More than a chart. Business Pulse pulls together revenue, expenses, invoices, transactions,
                    and customer growth from your real activity on KaltrixOS, and rolls it into one
                    Business Health Score — so you know how the business is actually doing, not just how it feels.
                  </p>
                </div>
              </div>
            </div>
          </FadeUp>
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
            <p className="text-inkMid text-sm sm:text-base">Monthly, 6-month, or annual — longer plans cost less per month.</p>
          </div>
        </FadeUp>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8 sm:mb-10">
          <div className="max-w-full overflow-x-auto">
          <div className="bg-white border border-border rounded-2xl p-1.5 flex items-center gap-1 shadow-card w-max">
            <button
              onClick={() => setPricingBilling('monthly')}
              className={`px-3 sm:px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                pricingBilling === 'monthly' ? 'bg-ink text-ivory shadow' : 'text-inkFaint hover:text-ink'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPricingBilling('6month')}
              className={`px-3 sm:px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                pricingBilling === '6month' ? 'bg-ink text-ivory shadow' : 'text-inkFaint hover:text-ink'
              }`}
            >
              6 Months
            </button>
            <button
              onClick={() => setPricingBilling('annual')}
              className={`px-3 sm:px-6 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                pricingBilling === 'annual' ? 'bg-ink text-ivory shadow' : 'text-inkFaint hover:text-ink'
              }`}
            >
              Annual
              <span className="bg-brand text-white text-xs font-black px-2 py-0.5 rounded-full">Best deal</span>
            </button>
          </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-5 max-w-4xl mx-auto">
          {PRICING_PLANS.map((plan, i) => {
            const monthlyNgn = monthlyEquivNgn(plan.key, pricingBilling)
            const isFree = PLAN_PRICES_NGN[plan.key][pricingBilling] === 0
            return (
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
                  {isFree ? (
                    <>
                      <span className="text-2xl sm:text-3xl font-black">₦0</span>
                      <span className="text-inkFaint text-xs ml-1">forever</span>
                    </>
                  ) : (
                    <>
                      <span className="text-2xl sm:text-3xl font-black">₦{monthlyNgn.toLocaleString()}</span>
                      <span className="text-inkFaint text-xs ml-1">{pricingBilling === 'monthly' ? '/mo' : '/mo equiv'}</span>
                    </>
                  )}
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
            )
          })}
        </div>
      </section>

      {/* CTA Banner */}
      <section className="relative bg-inkStatic overflow-hidden group">
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
              Build trust, close more deals, and grow faster — free to start, no credit card required.
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
            <p className="text-inkFaint text-xs mt-0.5">Africa&apos;s Business Operating System</p>
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
'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

interface Business {
  id: string
  business_name: string
  industry: string
  city: string
  phone: string
  website_url: string
  trust_score: number
  is_verified: boolean
  slug: string
  logo_url: string
  description: string
}

const industries = [
  'All', 'Restaurant & Food', 'Fashion & Clothing', 'Health & Wellness',
  'Technology', 'Education', 'Real Estate', 'Beauty & Salon',
  'Logistics & Delivery', 'Finance & Accounting', 'Retail & Shopping',
  'Entertainment', 'Agriculture', 'Construction', 'Other',
]

// Fade-up animation component
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

function TrustBadge({ score }: { score: number }) {
  const style = score >= 70
    ? 'text-brand border-brand/30 bg-brandBg'
    : score >= 40
    ? 'text-amber-600 border-amber-200 bg-amber-50'
    : 'text-red-500 border-red-200 bg-red-50'
  return (
    <span className={`text-xs font-black px-2 py-0.5 rounded-full border transition-all duration-300 hover:scale-110 ${style}`}>
      {score}
    </span>
  )
}

export default function DiscoverPage() {
  const supabase = createClient()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('All')
  const [selectedCity, setSelectedCity] = useState('')
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const fetchBusinesses = async () => {
      const { data } = await supabase
        .from('businesses')
        .select('*')
        .order('trust_score', { ascending: false })
      setBusinesses(data || [])
      setLoading(false)
    }
    fetchBusinesses()

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  const filtered = businesses.filter(b => {
    const matchSearch =
      b.business_name.toLowerCase().includes(search.toLowerCase()) ||
      b.city.toLowerCase().includes(search.toLowerCase()) ||
      b.industry.toLowerCase().includes(search.toLowerCase())
    const matchIndustry = selectedIndustry === 'All' || b.industry === selectedIndustry
    const matchCity = !selectedCity || b.city.toLowerCase().includes(selectedCity.toLowerCase())
    return matchSearch && matchIndustry && matchCity
  })

  return (
    <div className="min-h-screen bg-ivory font-sans overflow-x-hidden">

      {/* Animated background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand/5 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand/10 blur-3xl animate-pulse-slow" style={{ animationDelay: '1.5s' }} />
        <div 
          className="absolute w-[500px] h-[500px] rounded-full bg-brand/5 blur-3xl transition-all duration-300 ease-out pointer-events-none"
          style={{
            left: `${mousePosition.x - 250}px`,
            top: `${mousePosition.y - 250}px`,
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
            <Link href="/login" className="text-sm text-inkFaint hover:text-ink transition-all duration-300 px-3 py-1.5 font-medium hover:bg-ivoryDim rounded-lg hover:scale-105">
              Sign in
            </Link>
            <Link href="/signup" className="text-xs sm:text-sm font-bold bg-ink hover:bg-inkMid text-white px-3 sm:px-4 py-2 rounded-lg transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 hover:scale-105">
              List Your Business
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-border bg-white dark:bg-ivoryDim relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-brand/5 via-transparent to-transparent opacity-50" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-14 sm:py-20 text-center">
          <FadeUp>
            <div className="inline-flex items-center gap-2 bg-brandBg border border-brand/20 rounded-full px-3 sm:px-4 py-1.5 mb-6 hover:border-brand/40 transition-all duration-300 hover:scale-105">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse-slow" />
              <span className="text-brand text-xs font-bold tracking-wide uppercase">
                {businesses.length} verified businesses
              </span>
            </div>
          </FadeUp>

          <FadeUp delay={100}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black text-ink mb-4 leading-tight tracking-tight">
              Find trusted businesses<br />
              <span className="text-brand">across Africa</span>
            </h1>
          </FadeUp>

          <FadeUp delay={200}>
            <p className="text-inkFaint text-base sm:text-lg mb-8 sm:mb-10 max-w-xl mx-auto leading-relaxed">
              Every business is scored and verified. Know who to trust before you show up.
            </p>
          </FadeUp>

          {/* Search */}
          <FadeUp delay={300}>
            <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mx-auto">
              <div className="flex-1 relative group">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-inkFaint transition-all duration-300 group-focus-within:text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search businesses, services..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-ivory border border-border rounded-xl pl-11 pr-4 py-3.5 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 focus:shadow-brand transition-all duration-300 text-sm shadow-inner"
                />
              </div>
              <div className="relative group flex-1 sm:flex-none">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkFaint transition-all duration-300 group-focus-within:text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="City"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  className="w-full sm:w-36 bg-ivory border border-border rounded-xl pl-9 pr-4 py-3.5 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 focus:shadow-brand transition-all duration-300 text-sm shadow-inner"
                />
              </div>
            </div>
          </FadeUp>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Industry Pills */}
        <FadeUp>
          <div className="flex gap-2 overflow-x-auto pb-4 mb-6 scrollbar-thin scrollbar-thumb-ivoryDim">
            {industries.map((industry) => (
              <button
                key={industry}
                onClick={() => setSelectedIndustry(industry)}
                className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all duration-300 border ${
                  selectedIndustry === industry
                    ? 'bg-ink text-white border-ink shadow-lg scale-105'
                    : 'bg-white dark:bg-ivoryDim text-inkFaint border-border hover:border-inkFaint hover:text-ink hover:scale-105 hover:shadow-card'
                }`}
              >
                {industry}
              </button>
            ))}
          </div>
        </FadeUp>

        {/* Results header */}
        <FadeUp delay={100}>
          <div className="flex items-center justify-between mb-6">
            <p className="text-inkFaint text-sm">
              {loading ? 'Loading...' : (
                <>Showing <span className="text-ink font-semibold">{filtered.length}</span> businesses
                  {selectedIndustry !== 'All' && <> in <span className="text-brand font-semibold">{selectedIndustry}</span></>}
                </>
              )}
            </p>
            <p className="text-inkFaint text-xs">Sorted by TrustScore</p>
          </div>
        </FadeUp>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1,2,3,4,5,6].map((i) => (
              <div key={i} className="bg-white dark:bg-ivoryDim rounded-2xl p-6 border border-border shadow-card animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 bg-ivoryDim rounded-xl" />
                  <div className="w-10 h-5 bg-ivoryDim rounded-full" />
                </div>
                <div className="h-4 bg-ivoryDim rounded mb-2 w-3/4" />
                <div className="h-3 bg-ivoryDim rounded mb-4 w-1/2" />
                <div className="h-3 bg-ivoryDim rounded w-full" />
                <div className="h-3 bg-ivoryDim rounded w-2/3 mt-2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <FadeUp>
            <div className="text-center py-24">
              <div className="w-14 h-14 bg-white dark:bg-ivoryDim rounded-2xl border border-border shadow-card flex items-center justify-center mx-auto mb-4 transition-all duration-500 hover:scale-110 hover:shadow-lift">
                <svg className="w-6 h-6 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <p className="text-ink font-bold">No businesses found</p>
              <p className="text-inkFaint text-sm mt-1">Try a different search or industry</p>
            </div>
          </FadeUp>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((business, index) => (
              <FadeUp key={business.id} delay={index * 50}>
                <Link
                  href={'/business/' + business.slug}
                  className="group bg-white dark:bg-ivoryDim rounded-2xl p-6 border border-border shadow-card hover:shadow-lift hover:border-brand/30 hover:-translate-y-2 hover:scale-[1.01] transition-all duration-500 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-ivoryDim border border-border flex items-center justify-center text-base font-black text-inkFaint overflow-hidden flex-shrink-0 transition-all duration-500 group-hover:scale-110 group-hover:border-brand/30">
                      {business.logo_url ? (
                        <img src={business.logo_url} alt={business.business_name} className="w-full h-full object-cover" />
                      ) : (
                        business.business_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <TrustBadge score={business.trust_score} />
                      {business.is_verified && (
                        <span className="bg-brandBg text-brand text-xs px-2 py-0.5 rounded-full border border-brand/20 font-semibold transition-all duration-300 hover:scale-105">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex-1">
                    <h3 className="font-black text-base text-ink group-hover:text-brand transition-colors duration-300 mb-1 leading-tight">
                      {business.business_name}
                    </h3>
                    <p className="text-inkFaint text-xs mb-3">
                      {business.industry} <span className="text-ivoryDeep">•</span> {business.city}
                    </p>
                    {business.description ? (
                      <p className="text-inkFaint text-xs leading-relaxed line-clamp-2">{business.description}</p>
                    ) : (
                      <p className="text-ivoryDeep text-xs italic">No description yet</p>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-border transition-all duration-300 group-hover:border-brand/10">
                    <span className={`text-xs flex items-center gap-1.5 font-medium transition-all duration-300 ${business.website_url ? 'text-brand' : 'text-inkFaint'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${business.website_url ? 'bg-brand animate-pulse-slow' : 'bg-ivoryDeep'}`} />
                      {business.website_url ? 'Online' : 'No website'}
                    </span>
                    <span className="text-brand text-xs font-bold transition-all duration-300 group-hover:underline group-hover:translate-x-1 inline-flex items-center gap-1">
                      View Profile
                      <svg className="w-3 h-3 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </div>
                </Link>
              </FadeUp>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {!loading && filtered.length > 0 && (
          <FadeUp>
            <div className="mt-14 bg-ink rounded-2xl p-8 sm:p-10 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-brand/10 via-transparent to-transparent transition-all duration-1000 group-hover:from-brand/20" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(34,197,94,0.05),transparent_70%)] animate-pulse-slow" />
              <div className="absolute top-[-30%] left-[20%] w-[60%] h-[150%] bg-brand/6 blur-3xl rounded-full pointer-events-none" />
              <div className="relative z-10">
                <h3 className="text-xl sm:text-2xl font-black text-white mb-2 transition-all duration-500 group-hover:scale-[1.02]">
                  Is your business listed?
                </h3>
                <p className="text-white/40 text-sm mb-6 transition-all duration-500 group-hover:text-white/60">
                  Join thousands of businesses getting discovered on KaltrixOS
                </p>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 gradient-brand text-white font-black px-6 sm:px-8 py-3 rounded-xl transition-all duration-300 shadow-brand hover:shadow-brandLg hover:-translate-y-1 hover:scale-105 text-sm group"
                >
                  List Your Business Free
                  <svg className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
              </div>
            </div>
          </FadeUp>
        )}

      </div>
    </div>
  )
}
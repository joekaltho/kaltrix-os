'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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
  'All',
  'Restaurant & Food',
  'Fashion & Clothing',
  'Health & Wellness',
  'Technology',
  'Education',
  'Real Estate',
  'Beauty & Salon',
  'Logistics & Delivery',
  'Finance & Accounting',
  'Retail & Shopping',
  'Entertainment',
  'Agriculture',
  'Construction',
  'Other',
]

function TrustBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-400 border-green-400/30 bg-green-400/10' :
    score >= 40 ? 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10' :
    'text-red-400 border-red-400/30 bg-red-400/10'
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-full border ${color}`}>
      TS {score}
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
    <div className="min-h-screen bg-black text-white">

      {/* Navbar */}
      <nav className="border-b border-gray-800/50 px-6 py-4 flex items-center justify-between backdrop-blur-sm sticky top-0 bg-black/80 z-10">
        <Link href="/" className="text-xl font-bold tracking-tight">
          Kaltrix<span className="text-green-400">OS</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-gray-400 hover:text-white transition px-3 py-1.5">
            Login
          </Link>
          <Link
            href="/register"
            className="bg-green-400 hover:bg-green-300 text-black text-sm font-semibold px-4 py-2 rounded-lg transition"
          >
            List Your Business
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-400/5 to-transparent pointer-events-none" />
        <div className="max-w-4xl mx-auto px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 bg-green-400/10 border border-green-400/20 rounded-full px-4 py-1.5 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-green-400 text-xs font-medium">
              {businesses.length} businesses and counting
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 leading-tight">
            Find Trusted Businesses
            <span className="text-green-400"> Across Africa</span>
          </h1>
          <p className="text-gray-400 text-lg mb-10 max-w-xl mx-auto">
            Every business is verified and scored. Know who to trust before you show up.
          </p>

          {/* Search Bar */}
          <div className="flex gap-3 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search businesses, services..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-gray-900 border border-gray-700 rounded-xl pl-11 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
              />
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              <input
                type="text"
                placeholder="City"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-36 bg-gray-900 border border-gray-700 rounded-xl pl-9 pr-4 py-3.5 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 pb-16">

        {/* Industry Pills */}
        <div className="flex gap-2 overflow-x-auto pb-4 mb-8 scrollbar-hide">
          {industries.map((industry) => (
            <button
              key={industry}
              onClick={() => setSelectedIndustry(industry)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition border ${
                selectedIndustry === industry
                  ? 'bg-green-400 text-black border-green-400 font-semibold'
                  : 'bg-gray-900 text-gray-400 border-gray-800 hover:border-gray-600 hover:text-white'
              }`}
            >
              {industry}
            </button>
          ))}
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-gray-400 text-sm">
            {loading ? 'Loading businesses...' : (
              <span>
                Showing <span className="text-white font-medium">{filtered.length}</span> businesses
                {selectedIndustry !== 'All' && (
                  <span> in <span className="text-green-400">{selectedIndustry}</span></span>
                )}
              </span>
            )}
          </p>
          <p className="text-gray-600 text-xs">Sorted by TrustScore</p>
        </div>

        {/* Business Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-gray-900 rounded-2xl p-6 border border-gray-800 animate-pulse">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 bg-gray-800 rounded-xl" />
                  <div className="w-16 h-6 bg-gray-800 rounded-full" />
                </div>
                <div className="h-5 bg-gray-800 rounded mb-2 w-3/4" />
                <div className="h-3 bg-gray-800 rounded mb-4 w-1/2" />
                <div className="h-3 bg-gray-800 rounded w-full" />
                <div className="h-3 bg-gray-800 rounded w-2/3 mt-2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-16 h-16 bg-gray-900 rounded-2xl border border-gray-800 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <p className="text-gray-400 text-lg font-medium">No businesses found</p>
            <p className="text-gray-600 text-sm mt-2">Try a different search term or industry</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((business) => (
              <Link
                key={business.id}
                href={"/business/" + business.slug}
                className="group bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-green-400/40 transition-all duration-200 hover:shadow-lg hover:shadow-green-400/5 flex flex-col"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="w-14 h-14 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center text-xl font-bold text-gray-400 overflow-hidden flex-shrink-0">
                    {business.logo_url ? (
                      <img
                        src={business.logo_url}
                        alt={business.business_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      business.business_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <TrustBadge score={business.trust_score} />
                    {business.is_verified && (
                      <span className="bg-green-400/10 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-400/20">
                        Verified
                      </span>
                    )}
                  </div>
                </div>

                {/* Business Info */}
                <div className="flex-1">
                  <h3 className="font-bold text-lg group-hover:text-green-400 transition-colors mb-1 leading-tight">
                    {business.business_name}
                  </h3>
                  <p className="text-gray-500 text-sm mb-3">
                    {business.industry} &bull; {business.city}
                  </p>
                  {business.description ? (
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">
                      {business.description}
                    </p>
                  ) : (
                    <p className="text-gray-700 text-xs italic">No description yet</p>
                  )}
                </div>

                {/* Card Footer */}
                <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
                  <div className="flex items-center gap-1.5">
                    {business.website_url ? (
                      <span className="text-green-400 text-xs flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                        Online
                      </span>
                    ) : (
                      <span className="text-gray-600 text-xs flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                        No website
                      </span>
                    )}
                  </div>
                  <span className="text-green-400 text-xs font-medium group-hover:underline">
                    View Profile →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Bottom CTA */}
        {!loading && filtered.length > 0 && (
          <div className="mt-16 bg-gray-900 border border-gray-800 rounded-2xl p-8 text-center">
            <h3 className="text-xl font-bold mb-2">Is your business listed?</h3>
            <p className="text-gray-400 text-sm mb-6">
              Join thousands of businesses getting found on KaltrixOS
            </p>
            <Link
              href="/register"
              className="bg-green-400 hover:bg-green-300 text-black font-semibold px-8 py-3 rounded-xl transition inline-block"
            >
              List Your Business Free
            </Link>
          </div>
        )}

      </div>
    </div>
  )
}
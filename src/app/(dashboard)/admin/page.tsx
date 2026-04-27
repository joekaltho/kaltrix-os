'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  created_at: string
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('role').eq('id', user.id).single()

      if (!profile || profile.role !== 'admin') {
        router.push('/dashboard')
        return
      }

      const [businessesRes, profilesRes] = await Promise.all([
        supabase.from('businesses').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      ])

      setBusinesses(businessesRes.data || [])
      setProfiles(profilesRes.data || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleVerify = async (businessId: string) => {
    await supabase.from('businesses').update({ is_verified: true }).eq('id', businessId)
    setBusinesses(businesses.map(b => b.id === businessId ? { ...b, is_verified: true } : b))
  }

  const handleDelete = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business?')) return
    await supabase.from('businesses').delete().eq('id', businessId)
    setBusinesses(businesses.filter(b => b.id !== businessId))
  }

  const handleCall = (phone: string) => {
    window.location.href = 'tel:' + phone
  }

  const handleWhatsApp = (phone: string) => {
    const number = phone.replace(/^0/, '234')
    window.open('https://wa.me/' + number, '_blank')
  }

  const noWebsite = businesses.filter(b => !b.website_url)
  const unverified = businesses.filter(b => !b.is_verified)
  const lowTrust = businesses.filter(b => b.trust_score < 50)
  const flagged = businesses.filter(b => !b.website_url || b.trust_score < 50 || !b.is_verified)
  const businessUsers = profiles.filter(p => p.role === 'business')

  const filteredBusinesses = businesses.filter(b =>
    b.business_name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase()) ||
    b.industry.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 text-xl animate-pulse">Loading Admin...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">

      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-black z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold">Kaltrix<span className="text-green-400">OS</span></h1>
          <span className="bg-green-400/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-400/20">
            Admin
          </span>
        </div>
        <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white transition">
          Sign out
        </button>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">

        <div className="mb-8">
          <h2 className="text-2xl font-bold">Admin Command Center</h2>
          <p className="text-gray-400 text-sm mt-1">Manage KaltrixOS and convert leads into paying clients</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs mb-1">Total Users</p>
            <p className="text-3xl font-bold text-green-400">{profiles.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs mb-1">Total Businesses</p>
            <p className="text-3xl font-bold text-green-400">{businesses.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs mb-1">No Website</p>
            <p className="text-3xl font-bold text-yellow-400">{noWebsite.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs mb-1">Flagged Leads</p>
            <p className="text-3xl font-bold text-red-400">{flagged.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs mb-1">Business Users</p>
            <p className="text-3xl font-bold text-green-400">{businessUsers.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs mb-1">Unverified</p>
            <p className="text-3xl font-bold text-yellow-400">{unverified.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs mb-1">Low TrustScore</p>
            <p className="text-3xl font-bold text-red-400">{lowTrust.length}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-8 border-b border-gray-800 overflow-x-auto">
          {['overview', 'businesses', 'users', 'flagged'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium capitalize whitespace-nowrap transition border-b-2 ${
                activeTab === tab
                  ? 'border-green-400 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab}
              {tab === 'flagged' && flagged.length > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {flagged.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-green-400/5 border border-green-400/20 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-green-400 mb-4">Agency Opportunities</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-black/30 rounded-xl p-4">
                  <p className="text-yellow-400 font-bold text-2xl">{noWebsite.length}</p>
                  <p className="text-gray-400 text-sm">Need a website</p>
                  <p className="text-green-400 text-xs mt-1">Potential: N{(noWebsite.length * 150000).toLocaleString()}</p>
                </div>
                <div className="bg-black/30 rounded-xl p-4">
                  <p className="text-yellow-400 font-bold text-2xl">{unverified.length}</p>
                  <p className="text-gray-400 text-sm">Need verification</p>
                  <p className="text-green-400 text-xs mt-1">Potential: N{(unverified.length * 25000).toLocaleString()}</p>
                </div>
                <div className="bg-black/30 rounded-xl p-4">
                  <p className="text-yellow-400 font-bold text-2xl">{lowTrust.length}</p>
                  <p className="text-gray-400 text-sm">Need trust boost</p>
                  <p className="text-green-400 text-xs mt-1">Potential: N{(lowTrust.length * 75000).toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold mb-4">Recent Businesses</h3>
              <div className="space-y-3">
                {businesses.slice(0, 5).map((business) => (
                  <div key={business.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{business.business_name}</p>
                      <p className="text-gray-400 text-sm">{business.industry} - {business.city}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-green-400 font-bold text-sm">TS: {business.trust_score}</span>
                      {!business.website_url && (
                        <span className="bg-yellow-500/10 text-yellow-500 text-xs px-2 py-1 rounded-full border border-yellow-500/20">
                          No Website
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'businesses' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">All Businesses ({businesses.length})</h3>
            <input
              type="text"
              placeholder="Search by name, city or industry..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
            />
            {filteredBusinesses.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                <p className="text-gray-400">No businesses found</p>
              </div>
            ) : (
              filteredBusinesses.map((business) => (
                <div key={business.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{business.business_name}</p>
                      <p className="text-gray-400 text-sm">{business.industry} - {business.city}</p>
                      <p className="text-gray-500 text-xs">{business.phone}</p>
                      <p className="text-gray-600 text-xs mt-1">Joined {new Date(business.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="text-green-400 font-bold">TS: {business.trust_score}</span>
                      <div className="flex gap-2 flex-wrap justify-end">
                        {!business.website_url && (
                          <span className="bg-yellow-500/10 text-yellow-500 text-xs px-2 py-1 rounded-full border border-yellow-500/20">No Website</span>
                        )}
                        {!business.is_verified && (
                          <span className="bg-red-500/10 text-red-400 text-xs px-2 py-1 rounded-full border border-red-500/20">Unverified</span>
                        )}
                        {business.is_verified && (
                          <span className="bg-green-500/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-500/20">Verified</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-800 flex gap-2 flex-wrap">
                    {!business.is_verified && (
                      <button
                        onClick={() => handleVerify(business.id)}
                        className="bg-green-400 hover:bg-green-300 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                      >
                        Verify
                      </button>
                    )}
                    <button
                      onClick={() => handleCall(business.phone)}
                      className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                    >
                      Call
                    </button>
                    <button
                      onClick={() => handleDelete(business.id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-3 py-1.5 rounded-lg transition"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold">All Users ({profiles.length})</h3>
            {profiles.map((profile) => (
              <div key={profile.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                <div>
                  <p className="font-medium">{profile.name}</p>
                  <p className="text-gray-400 text-sm">{profile.email}</p>
                  <p className="text-gray-600 text-xs mt-1">Joined {new Date(profile.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border ${
                  profile.role === 'admin'
                    ? 'bg-green-400/10 text-green-400 border-green-400/20'
                    : 'bg-gray-800 text-gray-400 border-gray-700'
                }`}>
                  {profile.role}
                </span>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'flagged' && (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-bold">Flagged Businesses</h3>
              <p className="text-gray-400 text-sm mt-1">These businesses need your agency services</p>
            </div>
            {flagged.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                <p className="text-gray-400">No flagged businesses</p>
              </div>
            ) : (
              flagged.map((business) => (
                <div key={business.id} className="bg-gray-900 rounded-xl p-4 border border-yellow-500/20">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{business.business_name}</p>
                      <p className="text-gray-400 text-sm">{business.industry} - {business.city}</p>
                      <p className="text-gray-500 text-xs">{business.phone}</p>
                    </div>
                    <span className="text-green-400 font-bold">TS: {business.trust_score}</span>
                  </div>

                  <div className="mt-3 space-y-1">
                    {!business.website_url && (
                      <div className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2">
                        <p className="text-yellow-500 text-xs">No website — offer website build</p>
                        <span className="text-green-400 text-xs font-bold">N150,000</span>
                      </div>
                    )}
                    {!business.is_verified && (
                      <div className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2">
                        <p className="text-yellow-500 text-xs">Unverified — offer verification</p>
                        <span className="text-green-400 text-xs font-bold">N25,000</span>
                      </div>
                    )}
                    {business.trust_score < 50 && (
                      <div className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2">
                        <p className="text-yellow-500 text-xs">Low TrustScore — offer boost package</p>
                        <span className="text-green-400 text-xs font-bold">N75,000/mo</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-800 flex gap-2">
                    <button
                      onClick={() => handleCall(business.phone)}
                      className="bg-green-400 hover:bg-green-300 text-black text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                    >
                      Call Now
                    </button>
                    <button
                      onClick={() => handleWhatsApp(business.phone)}
                      className="bg-green-600 hover:bg-green-500 text-white text-xs px-3 py-1.5 rounded-lg transition"
                    >
                      WhatsApp
                    </button>
                    {!business.is_verified && (
                      <button
                        onClick={() => handleVerify(business.id)}
                        className="bg-gray-800 hover:bg-gray-700 text-white text-xs px-3 py-1.5 rounded-lg transition"
                      >
                        Mark Verified
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>
    </div>
  )
}
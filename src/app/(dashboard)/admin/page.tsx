'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
  created_at: string
}

interface Profile {
  id: string
  name: string
  email: string
  role: string
  created_at: string
}

interface WaitlistEntry {
  id: string
  name: string
  email: string
  business_type: string
  created_at: string
}

interface Subscription {
  business_id: string
  plan: string
  status: string
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [search, setSearch] = useState('')
  const [updatingTrust, setUpdatingTrust] = useState<string | null>(null)
  const [trustInput, setTrustInput] = useState<Record<string, number>>({})

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

      const [businessesRes, profilesRes, waitlistRes, subsRes] = await Promise.all([
        supabase.from('businesses').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('waitlist').select('*').order('created_at', { ascending: false }),
        supabase.from('subscriptions').select('business_id, plan, status').eq('status', 'active'),
      ])

      setBusinesses(businessesRes.data || [])
      setProfiles(profilesRes.data || [])
      setWaitlist(waitlistRes.data || [])
      setSubscriptions(subsRes.data || [])
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

  const handleUnverify = async (businessId: string) => {
    await supabase.from('businesses').update({ is_verified: false }).eq('id', businessId)
    setBusinesses(businesses.map(b => b.id === businessId ? { ...b, is_verified: false } : b))
  }

  const handleDelete = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business? This cannot be undone.')) return
    await supabase.from('businesses').delete().eq('id', businessId)
    setBusinesses(businesses.filter(b => b.id !== businessId))
  }

  const handleUpdateTrustScore = async (businessId: string) => {
    const score = trustInput[businessId]
    if (!score || score < 1 || score > 100) return
    setUpdatingTrust(businessId)
    await supabase.from('businesses').update({ trust_score: score }).eq('id', businessId)
    setBusinesses(businesses.map(b => b.id === businessId ? { ...b, trust_score: score } : b))
    setUpdatingTrust(null)
    setTrustInput(prev => { const n = { ...prev }; delete n[businessId]; return n })
  }

  // eslint-disable-next-line react-hooks/immutability -- click handler, not render; standard navigation
  const handleCall = (phone: string) => { window.location.href = 'tel:' + phone }
  const handleWhatsApp = (phone: string) => {
    const number = phone.replace(/^0/, '234')
    window.open('https://wa.me/' + number, '_blank')
  }

  const exportWaitlistCSV = () => {
    const headers = ['Name', 'Email', 'Business Type', 'Signed Up']
    const rows = waitlist.map(e => [
      e.name || 'Anonymous',
      e.email,
      e.business_type?.replace('_', ' ') || 'Not specified',
      new Date(e.created_at).toLocaleDateString(),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `kaltrix-waitlist-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const noWebsite = businesses.filter(b => !b.website_url)
  const unverified = businesses.filter(b => !b.is_verified)
  const lowTrust = businesses.filter(b => b.trust_score < 50)
  const flagged = businesses.filter(b => !b.website_url || b.trust_score < 50 || !b.is_verified)
  const businessUsers = profiles.filter(p => p.role === 'business')
  const paidSubs = subscriptions.filter(s => s.plan !== 'free')
  const filteredBusinesses = businesses.filter(b =>
    b.business_name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase()) ||
    b.industry.toLowerCase().includes(search.toLowerCase())
  )

  const getSubPlan = (businessId: string) =>
    subscriptions.find(s => s.business_id === businessId)?.plan || 'free'

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-green-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-green-400 text-sm">Loading Admin...</p>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'businesses', label: `Businesses (${businesses.length})` },
    { id: 'users', label: `Users (${profiles.length})` },
    { id: 'flagged', label: `Leads (${flagged.length})` },
    { id: 'waitlist', label: `Waitlist (${waitlist.length})` },
  ]

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-lg font-black">
            Kaltrix<span className="text-green-400">OS</span>
          </Link>
          <span className="bg-green-400/10 text-green-400 text-xs px-2.5 py-1 rounded-full border border-green-400/20 font-bold">
            Admin
          </span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <span>{new Date().toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <button onClick={handleSignOut} className="hover:text-white transition">Sign out</button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h2 className="text-2xl font-black">Command Center</h2>
          <p className="text-gray-400 text-sm mt-1">Manage KaltrixOS and convert leads</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          {[
            { label: 'Total Users', value: profiles.length, color: 'text-green-400' },
            { label: 'Businesses', value: businesses.length, color: 'text-green-400' },
            { label: 'Paid Plans', value: paidSubs.length, color: 'text-green-400' },
            { label: 'Flagged Leads', value: flagged.length, color: 'text-red-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'No Website', value: noWebsite.length, color: 'text-yellow-400' },
            { label: 'Unverified', value: unverified.length, color: 'text-orange-400' },
            { label: 'Waitlist', value: waitlist.length, color: 'text-blue-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
              <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">{stat.label}</p>
              <p className={`text-3xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0.5 border-b border-gray-800 mb-6 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'border-green-400 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab === 'overview' && (
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h3 className="font-black text-sm uppercase tracking-wider text-gray-400 mb-4">Recent Businesses</h3>
              <div className="space-y-3">
                {businesses.slice(0, 5).map(b => (
                  <div key={b.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{b.business_name}</p>
                      <p className="text-xs text-gray-500">{b.city} · {b.industry}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-400 text-xs font-black">{b.trust_score}</span>
                      {b.is_verified
                        ? <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full">Verified</span>
                        : <span className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 px-2 py-0.5 rounded-full">Unverified</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
              <h3 className="font-black text-sm uppercase tracking-wider text-gray-400 mb-4">Recent Waitlist</h3>
              <div className="space-y-3">
                {waitlist.slice(0, 5).map(e => (
                  <div key={e.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold">{e.name || 'Anonymous'}</p>
                      <p className="text-xs text-gray-500">{e.email}</p>
                    </div>
                    <span className="text-xs text-blue-400">{e.business_type?.replace('_', ' ') || '—'}</span>
                  </div>
                ))}
              </div>
              {waitlist.length > 0 && (
                <button
                  onClick={exportWaitlistCSV}
                  className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-2 rounded-lg transition border border-gray-700"
                >
                  Export All to CSV
                </button>
              )}
            </div>
          </div>
        )}

        {/* BUSINESSES */}
        {activeTab === 'businesses' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search by name, city or industry..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition text-sm"
              />
              <span className="text-gray-500 text-xs whitespace-nowrap">{filteredBusinesses.length} results</span>
            </div>

            {filteredBusinesses.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                <p className="text-gray-400">No businesses found</p>
              </div>
            ) : filteredBusinesses.map((business) => {
              const plan = getSubPlan(business.id)
              return (
                <div key={business.id} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-black">{business.business_name}</p>
                        {plan !== 'free' && (
                          <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-0.5 rounded-full font-bold capitalize">{plan}</span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm">{business.industry} · {business.city}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{business.phone}</p>
                      <p className="text-gray-600 text-xs">Joined {new Date(business.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="text-green-400 font-black text-lg">{business.trust_score}</span>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {!business.website_url && (
                          <span className="bg-yellow-500/10 text-yellow-500 text-xs px-2 py-0.5 rounded-full border border-yellow-500/20">No Website</span>
                        )}
                        {business.is_verified
                          ? <span className="bg-green-500/10 text-green-400 text-xs px-2 py-0.5 rounded-full border border-green-500/20">Verified</span>
                          : <span className="bg-red-500/10 text-red-400 text-xs px-2 py-0.5 rounded-full border border-red-500/20">Unverified</span>
                        }
                      </div>
                    </div>
                  </div>

                  {/* TrustScore manual override */}
                  <div className="flex items-center gap-2 mb-3 pb-3 border-b border-gray-800">
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="Override TrustScore"
                      value={trustInput[business.id] || ''}
                      onChange={(e) => setTrustInput(prev => ({ ...prev, [business.id]: Number(e.target.value) }))}
                      className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-xs placeholder-gray-600 focus:outline-none focus:border-green-400 transition"
                    />
                    <button
                      onClick={() => handleUpdateTrustScore(business.id)}
                      disabled={updatingTrust === business.id || !trustInput[business.id]}
                      className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition border border-gray-700 disabled:opacity-40"
                    >
                      {updatingTrust === business.id ? 'Saving...' : 'Set Score'}
                    </button>
                    {business.slug && (
                      <Link href={`/business/${business.slug}`} target="_blank" className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition border border-gray-700">
                        View
                      </Link>
                    )}
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {!business.is_verified ? (
                      <button onClick={() => handleVerify(business.id)} className="bg-green-400 hover:bg-green-300 text-black text-xs font-black px-3 py-1.5 rounded-lg transition">
                        Verify
                      </button>
                    ) : (
                      <button onClick={() => handleUnverify(business.id)} className="bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-gray-700">
                        Unverify
                      </button>
                    )}
                    <button onClick={() => handleCall(business.phone)} className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition border border-gray-700">
                      Call
                    </button>
                    <button onClick={() => handleWhatsApp(business.phone)} className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                      WhatsApp
                    </button>
                    <button onClick={() => handleDelete(business.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-500/20 ml-auto">
                      Delete
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* USERS */}
        {activeTab === 'users' && (
          <div className="space-y-3">
            {profiles.map((profile) => (
              <div key={profile.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                <div>
                  <p className="font-black text-sm">{profile.name}</p>
                  <p className="text-gray-400 text-xs">{profile.email}</p>
                  <p className="text-gray-600 text-xs mt-0.5">Joined {new Date(profile.created_at).toLocaleDateString()}</p>
                </div>
                <span className={`text-xs px-3 py-1 rounded-full border font-bold ${
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

        {/* FLAGGED LEADS */}
        {activeTab === 'flagged' && (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">These businesses need your agency services — reach out directly.</p>
            {flagged.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                <p className="text-gray-400">No flagged businesses</p>
              </div>
            ) : flagged.map((business) => (
              <div key={business.id} className="bg-gray-900 rounded-xl p-5 border border-yellow-500/20">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-black">{business.business_name}</p>
                    <p className="text-gray-400 text-sm">{business.industry} · {business.city}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{business.phone}</p>
                  </div>
                  <span className="text-green-400 font-black text-lg">{business.trust_score}</span>
                </div>

                <div className="space-y-1 mb-3">
                  {!business.website_url && (
                    <div className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2 border border-yellow-500/10">
                      <p className="text-yellow-500 text-xs">No website — offer website build</p>
                      <span className="text-green-400 text-xs font-black">₦150,000</span>
                    </div>
                  )}
                  {!business.is_verified && (
                    <div className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2 border border-yellow-500/10">
                      <p className="text-yellow-500 text-xs">Unverified — offer verification service</p>
                      <span className="text-green-400 text-xs font-black">₦25,000</span>
                    </div>
                  )}
                  {business.trust_score < 50 && (
                    <div className="flex items-center justify-between bg-yellow-500/5 rounded-lg px-3 py-2 border border-yellow-500/10">
                      <p className="text-yellow-500 text-xs">Low TrustScore — offer boost package</p>
                      <span className="text-green-400 text-xs font-black">₦75,000/mo</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-gray-800">
                  <button onClick={() => handleCall(business.phone)} className="bg-green-400 hover:bg-green-300 text-black text-xs font-black px-3 py-1.5 rounded-lg transition">
                    Call Now
                  </button>
                  <button onClick={() => handleWhatsApp(business.phone)} className="bg-green-600 hover:bg-green-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition">
                    WhatsApp
                  </button>
                  {!business.is_verified && (
                    <button onClick={() => handleVerify(business.id)} className="bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition border border-gray-700">
                      Mark Verified
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* WAITLIST */}
        {activeTab === 'waitlist' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-400 text-sm">{waitlist.length} signups total</p>
              {waitlist.length > 0 && (
                <button
                  onClick={exportWaitlistCSV}
                  className="bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition border border-gray-700 flex items-center gap-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export CSV
                </button>
              )}
            </div>
            {waitlist.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                <p className="text-gray-400">No waitlist signups yet</p>
                <p className="text-gray-600 text-sm mt-1">Share the landing page to get signups</p>
              </div>
            ) : waitlist.map((entry) => (
              <div key={entry.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                <div>
                  <p className="font-black text-sm">{entry.name || 'Anonymous'}</p>
                  <p className="text-gray-400 text-xs">{entry.email}</p>
                  <p className="text-gray-600 text-xs mt-0.5">
                    {entry.business_type?.replace('_', ' ') || 'Not specified'} · {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleWhatsApp(entry.email)}
                  className="text-xs text-gray-400 hover:text-green-400 transition"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

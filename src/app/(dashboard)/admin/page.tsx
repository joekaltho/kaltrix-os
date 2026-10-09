'use client'

import Logo from '@/components/Logo'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import { resolveEffectivePlan } from '@/lib/check-plan'
import Link from 'next/link'

interface Business {
  id: string
  business_name: string
  industry: string
  city: string
  phone: string
  website_url: string
  trust_score: number
  trust_signals?: import('@/lib/trust-score').TrustSignal[]
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

interface FeedbackEntry {
  id: string
  source: 'business' | 'customer'
  kind: 'bug' | 'idea' | 'other'
  message: string
  contact: string | null
  business_id: string | null
  status: 'new' | 'reviewed' | 'done'
  created_at: string
}

const FEEDBACK_KIND_LABEL: Record<FeedbackEntry['kind'], string> = {
  bug: 'Something broken',
  idea: 'Idea',
  other: 'Other',
}

interface Subscription {
  business_id: string
  plan: string
  status: string
  expires_at: string | null
}

interface ReviewReport {
  id: string
  review_id: string
  business_id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reviews: { reviewer_name: string; rating: number; comment: string; moderation_status: string } | null
  businesses: { business_name: string } | null
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [feedback, setFeedback] = useState<FeedbackEntry[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [reviewReports, setReviewReports] = useState<ReviewReport[]>([])
  const [activeTab, setActiveTab] = useState('overview')
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      setLoadError('')
      try {
        const { data: { user } } = await getSessionUser(supabase)
        if (!user) { router.push('/login'); return }

        const { data: profile } = await supabase
          .from('profiles').select('role').eq('id', user.id).single()

        if (!profile || profile.role !== 'admin') {
          router.push('/dashboard')
          return
        }

        const [businessesRes, profilesRes, feedbackRes, subsRes, reportsRes] = await Promise.all([
          supabase.from('businesses').select('*').order('created_at', { ascending: false }),
          supabase.from('profiles').select('*').order('created_at', { ascending: false }),
          supabase.from('feedback').select('*').order('created_at', { ascending: false }),
          supabase.from('subscriptions').select('business_id, plan, status, expires_at'),
          supabase.from('review_reports')
            .select('*, reviews(reviewer_name, rating, comment, moderation_status), businesses(business_name)')
            .order('created_at', { ascending: false }),
        ])

        setBusinesses(businessesRes.data || [])
        setProfiles(profilesRes.data || [])
        setFeedback((feedbackRes.data as FeedbackEntry[]) || [])
        setSubscriptions(subsRes.data || [])
        setReviewReports((reportsRes.data as unknown as ReviewReport[]) || [])
      } catch {
        setLoadError('Could not load admin data. Check your connection and try again.')
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleVerify = async (businessId: string) => {
    const { data } = await supabase
      .from('businesses')
      .update({ is_verified: true })
      .eq('id', businessId)
      .select('trust_score, trust_signals')
      .single()
    setBusinesses(businesses.map(b => b.id === businessId
      ? { ...b, is_verified: true, trust_score: data?.trust_score ?? b.trust_score, trust_signals: data?.trust_signals ?? b.trust_signals }
      : b))
  }

  const handleUnverify = async (businessId: string) => {
    const { data } = await supabase
      .from('businesses')
      .update({ is_verified: false })
      .eq('id', businessId)
      .select('trust_score, trust_signals')
      .single()
    setBusinesses(businesses.map(b => b.id === businessId
      ? { ...b, is_verified: false, trust_score: data?.trust_score ?? b.trust_score, trust_signals: data?.trust_signals ?? b.trust_signals }
      : b))
  }

  const handleDelete = async (businessId: string) => {
    if (!confirm('Are you sure you want to delete this business? This cannot be undone.')) return
    await supabase.from('businesses').delete().eq('id', businessId)
    setBusinesses(businesses.filter(b => b.id !== businessId))
  }

  // Dismiss: the report was unfounded, leave the review alone.
  const handleDismissReport = async (reportId: string) => {
    const { data: { user } } = await getSessionUser(supabase)
    await supabase.from('review_reports')
      .update({ status: 'dismissed', reviewed_by: user?.id, reviewed_at: new Date().toISOString() })
      .eq('id', reportId)
    setReviewReports(reviewReports.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r))
  }

  // Uphold: the report was right — remove the review. This is the one
  // place a review actually gets taken down, and only an admin can do it
  // (enforced by RLS, not just the UI).
  const handleUpholdReport = async (reportId: string, reviewId: string) => {
    if (!confirm('Remove this review? This will hide it from the public business page.')) return
    const { data: { user } } = await getSessionUser(supabase)
    const now = new Date().toISOString()
    await Promise.all([
      supabase.from('review_reports')
        .update({ status: 'upheld', reviewed_by: user?.id, reviewed_at: now })
        .eq('id', reportId),
      supabase.from('reviews')
        .update({ moderation_status: 'removed', moderated_by: user?.id, moderated_at: now })
        .eq('id', reviewId),
    ])
    setReviewReports(reviewReports.map(r => r.id === reportId ? { ...r, status: 'upheld', reviews: r.reviews ? { ...r.reviews, moderation_status: 'removed' } : r.reviews } : r))
  }

  // eslint-disable-next-line react-hooks/immutability -- click handler, not render; standard navigation
  const handleCall = (phone: string) => { window.location.href = 'tel:' + phone }
  const handleWhatsApp = (phone: string) => {
    const number = phone.replace(/^0/, '234')
    window.open('https://wa.me/' + number, '_blank')
  }

  const setFeedbackStatus = async (id: string, status: FeedbackEntry['status']) => {
    const { error } = await supabase.from('feedback').update({ status }).eq('id', id)
    if (!error) setFeedback(prev => prev.map(f => (f.id === id ? { ...f, status } : f)))
  }

  const noWebsite = businesses.filter(b => !b.website_url)
  const unverified = businesses.filter(b => !b.is_verified)
  const lowTrust = businesses.filter(b => b.trust_score < 50)
  const flagged = businesses.filter(b => !b.website_url || b.trust_score < 50 || !b.is_verified)
  const businessUsers = profiles.filter(p => p.role === 'business')
  const paidSubs = subscriptions.filter(s => resolveEffectivePlan(s) !== 'free')
  const filteredBusinesses = businesses.filter(b =>
    b.business_name.toLowerCase().includes(search.toLowerCase()) ||
    b.city.toLowerCase().includes(search.toLowerCase()) ||
    b.industry.toLowerCase().includes(search.toLowerCase())
  )

  const getSubPlan = (businessId: string) =>
    resolveEffectivePlan(subscriptions.find(s => s.business_id === businessId) ?? null)

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

  if (loadError) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <p className="text-red-400 font-bold mb-1">Something went wrong</p>
          <p className="text-gray-400 text-sm mb-6">{loadError}</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-green-400 text-black font-black px-6 py-3 rounded-xl transition text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  const openReports = reviewReports.filter(r => r.status === 'open')
  const newFeedback = feedback.filter(f => f.status === 'new')
  const businessName = (id: string | null) => businesses.find(b => b.id === id)?.business_name

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'businesses', label: `Businesses (${businesses.length})` },
    { id: 'users', label: `Users (${profiles.length})` },
    { id: 'reviews', label: `Reported Reviews (${openReports.length})` },
    { id: 'flagged', label: `Leads (${flagged.length})` },
    { id: 'feedback', label: `Feedback (${newFeedback.length})` },
  ]

  return (
    <div className="min-h-screen bg-black text-white font-sans">

      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-black/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="text-lg font-black">
            <Logo size="sm" tone="onDark" />
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
            { label: 'New feedback', value: newFeedback.length, color: 'text-blue-400' },
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
              <h3 className="font-black text-sm uppercase tracking-wider text-gray-400 mb-4">Recent Feedback</h3>
              <div className="space-y-3">
                {feedback.length === 0 && <p className="text-sm text-gray-500">No feedback yet</p>}
                {feedback.slice(0, 5).map(f => (
                  <div key={f.id} className="flex items-start justify-between gap-3">
                    <p className="text-sm text-gray-300 line-clamp-2">{f.message}</p>
                    <span className="shrink-0 text-xs text-blue-400">{f.source === 'business' ? 'Business' : 'Customer'}</span>
                  </div>
                ))}
              </div>
              {feedback.length > 0 && (
                <button
                  onClick={() => setActiveTab('feedback')}
                  className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white text-xs font-bold py-2 rounded-lg transition border border-gray-700"
                >
                  View all feedback
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

                  {/* TrustScore is computed by the DB from verification + reviews +
                      activity + profile completeness — no manual override anymore.
                      Verifying the business below is the one input admin controls. */}
                  <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-gray-800">
                    <p className="text-gray-500 text-xs">TrustScore is computed automatically — verify the business to raise it</p>
                    {business.slug && (
                      <Link href={`/business/${business.slug}`} target="_blank" className="bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white text-xs px-3 py-1.5 rounded-lg transition border border-gray-700 shrink-0">
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

        {/* REPORTED REVIEWS */}
        {activeTab === 'reviews' && (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm">
              A report flags a review for your attention — it doesn&apos;t remove it. Reviews with 3+ open
              reports are auto-flagged as &quot;under review&quot; on the public page. Dismiss if the report is
              unfounded, or uphold to remove the review.
            </p>
            {reviewReports.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                <p className="text-gray-400">No reviews have been reported</p>
              </div>
            ) : reviewReports.map((report) => (
              <div key={report.id} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-black text-sm">{report.reviews?.reviewer_name || 'Unknown reviewer'}</p>
                    <p className="text-gray-500 text-xs">{report.businesses?.business_name || 'Unknown business'}</p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border font-bold shrink-0 ${
                    report.status === 'open' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                    : report.status === 'upheld' ? 'bg-red-500/10 text-red-400 border-red-500/20'
                    : 'bg-gray-800 text-gray-500 border-gray-700'
                  }`}>
                    {report.status}
                  </span>
                </div>
                {report.reviews && (
                  <div className="bg-black/40 rounded-lg p-3 mb-3 border border-gray-800">
                    <div className="flex gap-0.5 mb-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <span key={star} className={star <= report.reviews!.rating ? 'text-yellow-500 text-xs' : 'text-gray-700 text-xs'}>★</span>
                      ))}
                    </div>
                    <p className="text-gray-300 text-sm">{report.reviews.comment}</p>
                    {report.reviews.moderation_status !== 'published' && (
                      <p className="text-xs text-gray-500 mt-1">Current status: {report.reviews.moderation_status}</p>
                    )}
                  </div>
                )}
                <p className="text-gray-400 text-xs mb-1">
                  Reported for <span className="text-white font-bold">{report.reason.replace('_', ' ')}</span>
                  {' · '}{new Date(report.created_at).toLocaleDateString()}
                </p>
                {report.details && <p className="text-gray-500 text-xs mb-3 italic">&quot;{report.details}&quot;</p>}
                {report.status === 'open' && (
                  <div className="flex gap-2 pt-3 border-t border-gray-800">
                    <button
                      onClick={() => handleDismissReport(report.id)}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-gray-700"
                    >
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleUpholdReport(report.id, report.review_id)}
                      className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-500/20"
                    >
                      Uphold &amp; remove review
                    </button>
                  </div>
                )}
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

        {/* FEEDBACK */}
        {activeTab === 'feedback' && (
          <div className="space-y-3">
            <p className="text-gray-400 text-sm mb-4">{feedback.length} total · {newFeedback.length} new</p>
            {feedback.length === 0 ? (
              <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                <p className="text-gray-400">No feedback yet</p>
                <p className="text-gray-600 text-sm mt-1">Businesses send it from the dashboard; customers from /feedback</p>
              </div>
            ) : feedback.map(f => (
              <div key={f.id} className={`bg-gray-900 rounded-xl p-4 border ${f.status === 'new' ? 'border-blue-400/30' : 'border-gray-800'}`}>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-800 text-gray-300">
                    {f.source === 'business' ? (businessName(f.business_id) || 'Business') : 'Customer'}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${f.kind === 'bug' ? 'bg-red-400/10 text-red-400' : f.kind === 'idea' ? 'bg-green-400/10 text-green-400' : 'bg-gray-800 text-gray-400'}`}>
                    {FEEDBACK_KIND_LABEL[f.kind]}
                  </span>
                  <span className="text-xs text-gray-600">{new Date(f.created_at).toLocaleString()}</span>
                </div>
                <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{f.message}</p>
                {f.contact && <p className="text-xs text-gray-500 mt-2">Reply to: {f.contact}</p>}
                <div className="flex gap-2 mt-3">
                  {f.status === 'new' && (
                    <button onClick={() => setFeedbackStatus(f.id, 'reviewed')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 transition">
                      Mark reviewed
                    </button>
                  )}
                  {f.status !== 'done' && (
                    <button onClick={() => setFeedbackStatus(f.id, 'done')} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-400/10 text-green-400 hover:bg-green-400/20 border border-green-400/20 transition">
                      Done
                    </button>
                  )}
                  {f.status === 'done' && <span className="text-xs text-gray-600 py-1.5">Done</span>}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}

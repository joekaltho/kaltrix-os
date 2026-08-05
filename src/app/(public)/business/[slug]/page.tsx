'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  address?: string
  hours?: string
  email?: string
  specialties?: string[]
  awards?: string[]
  years_in_business?: number
  team_size?: number
  social_media?: {
    instagram?: string
    twitter?: string
    facebook?: string
    linkedin?: string
  }
}

interface Review {
  id: string
  reviewer_name: string
  rating: number
  comment: string
  created_at: string
}

export default function BusinessProfilePage() {
  const params = useParams()
  const supabase = createClient()
  const [business, setBusiness] = useState<Business | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [messageSent, setMessageSent] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)
  const [activeTab, setActiveTab] = useState('about')
  const [showSharePopup, setShowSharePopup] = useState(false)
  const [shareCopied, setShareCopied] = useState(false)
  const [messageForm, setMessageForm] = useState({
    sender_name: '',
    sender_phone: '',
    content: '',
  })
  const [reviewForm, setReviewForm] = useState({
    reviewer_name: '',
    rating: 5,
    comment: '',
  })
  const [sendingMessage, setSendingMessage] = useState(false)
  const [sendingReview, setSendingReview] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: businessData } = await supabase
        .from('businesses')
        .select('*')
        .eq('slug', params.slug)
        .single()

      if (businessData) {
        setBusiness(businessData)
        const { data: reviewsData } = await supabase
          .from('reviews')
          .select('*')
          .eq('business_id', businessData.id)
          .order('created_at', { ascending: false })
        setReviews(reviewsData || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [params.slug])

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!business) return
    setSendingMessage(true)
    await supabase.from('messages').insert({
      business_id: business.id,
      sender_name: messageForm.sender_name,
      sender_phone: messageForm.sender_phone,
      content: messageForm.content,
      is_read: false,
    })
    setMessageSent(true)
    setSendingMessage(false)
    setMessageForm({ sender_name: '', sender_phone: '', content: '' })
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!business) return
    setSendingReview(true)
    await supabase.from('reviews').insert({
      business_id: business.id,
      reviewer_name: reviewForm.reviewer_name,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
    })
    setReviewSubmitted(true)
    setSendingReview(false)
    setReviews([{
      id: Date.now().toString(),
      reviewer_name: reviewForm.reviewer_name,
      rating: reviewForm.rating,
      comment: reviewForm.comment,
      created_at: new Date().toISOString(),
    }, ...reviews])
    setReviewForm({ reviewer_name: '', rating: 5, comment: '' })
  }

  const handleShare = () => {
    setShowSharePopup(true)
  }

  const handleShareCopy = async () => {
    const url = window.location.href
    try {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 3000)
    } catch (err) {
      const textarea = document.createElement('textarea')
      textarea.value = url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 3000)
    }
  }

  const handleShareSocial = (platform: string) => {
    const url = encodeURIComponent(window.location.href)
    const text = encodeURIComponent(`Check out ${business?.business_name} on KaltrixOS!`)
    let shareUrl = ''
    
    switch(platform) {
      case 'whatsapp':
        shareUrl = `https://wa.me/?text=${text}%20${url}`
        break
      case 'twitter':
        shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`
        break
      case 'linkedin':
        shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`
        break
      case 'facebook':
        shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`
        break
      case 'email':
        shareUrl = `mailto:?subject=${text}&body=${url}`
        break
      default:
        return
    }
    
    window.open(shareUrl, '_blank', 'width=600,height=600')
    setShowSharePopup(false)
  }

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-inkFaint text-sm">Loading business profile...</p>
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center text-center px-6 font-sans">
        <div>
          <div className="w-16 h-16 bg-brandBg border border-brand/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-ink mb-2">Business not found</h2>
          <p className="text-inkFaint mb-6">This business may have been removed or moved.</p>
          <Link href="/discover" className="inline-flex items-center gap-2 bg-brand hover:bg-brand/90 text-white font-black px-6 py-3 rounded-xl transition shadow-brand">
            Back to Discover
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory text-ink font-sans">

      {/* Share Popup */}
      {showSharePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={() => setShowSharePopup(false)}>
          <div className="absolute inset-0 bg-inkStatic/60 backdrop-blur-sm" />
          <div className="relative bg-surface rounded-2xl p-6 max-w-md w-full border border-border shadow-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-black text-lg">Share this business</h3>
              <button onClick={() => setShowSharePopup(false)} className="text-inkFaint hover:text-ink transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <p className="text-inkFaint text-sm mb-4">Share {business.business_name} with your network</p>
            
            <div className="grid grid-cols-5 gap-2 mb-4">
              {[
                { icon: '📱', label: 'WhatsApp', action: 'whatsapp' },
                { icon: '🐦', label: 'Twitter', action: 'twitter' },
                { icon: '🔗', label: 'LinkedIn', action: 'linkedin' },
                { icon: '📘', label: 'Facebook', action: 'facebook' },
                { icon: '✉️', label: 'Email', action: 'email' },
              ].map((platform) => (
                <button
                  key={platform.action}
                  onClick={() => handleShareSocial(platform.action)}
                  className="flex flex-col items-center gap-1 p-2 rounded-xl hover:bg-ivoryDim transition group"
                >
                  <span className="text-2xl group-hover:scale-110 transition">{platform.icon}</span>
                  <span className="text-xs text-inkFaint">{platform.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={window.location.href}
                readOnly
                className="flex-1 bg-ivory border border-border rounded-lg px-3 py-2 text-sm text-inkFaint focus:outline-none"
              />
              <button
                onClick={handleShareCopy}
                className="shrink-0 bg-brand hover:bg-brand/90 text-white font-black px-4 py-2 rounded-lg transition text-sm"
              >
                {shareCopied ? '✅ Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="border-b border-border bg-white/80 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/discover" className="text-xl font-black tracking-tight">
          Kaltrix<span className="text-brand">OS</span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            onClick={handleShare}
            className="flex items-center gap-2 bg-brandBg text-brand border border-brand/20 hover:border-brand/40 px-4 py-2 rounded-xl text-sm font-semibold transition hover:scale-105"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
          <Link href="/signup" className="bg-ink hover:bg-inkMid text-ivory text-sm font-bold px-4 py-2 rounded-xl transition hover:shadow-lg hover:-translate-y-0.5">
            List Your Business
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="bg-gradient-to-b from-brandBg/30 via-surface to-ivory border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-white border-2 border-border shadow-card flex items-center justify-center text-3xl font-black text-inkMid overflow-hidden flex-shrink-0 transition hover:scale-105 hover:shadow-lift">
              {business.logo_url ? (
                <img src={business.logo_url} alt={business.business_name} className="w-full h-full object-cover" />
              ) : (
                business.business_name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight">{business.business_name}</h1>
                {business.is_verified && (
                  <span className="inline-flex items-center gap-1 bg-brandBg text-brand text-xs px-2.5 py-1 rounded-full border border-brand/20 font-bold">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Verified
                  </span>
                )}
              </div>
              <p className="text-inkFaint mb-3 text-sm">{business.industry} <span className="text-border">•</span> {business.city}</p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-bold ${
                  business.trust_score >= 70 ? 'bg-brandBg text-brand border-brand/20' :
                  business.trust_score >= 40 ? 'bg-amber-50 text-amber-600 border-amber-200' :
                  'bg-red-50 text-red-600 border-red-200'
                }`}>
                  <span className="text-xs">⚡</span>
                  TrustScore: {business.trust_score}
                </div>
                {avgRating && (
                  <div className="flex items-center gap-1 text-sm">
                    <span className="text-yellow-500">★</span>
                    <span className="font-bold">{avgRating}</span>
                    <span className="text-inkFaint">({reviews.length} reviews)</span>
                  </div>
                )}
                {business.website_url && (
                  <a href={business.website_url} target="_blank" rel="noreferrer" className="text-brand hover:underline text-sm font-medium">
                    Visit Website →
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 border-b border-border bg-surface rounded-t-2xl px-4">
              {['about', 'reviews', 'contact'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-bold capitalize transition border-b-2 ${
                    activeTab === tab
                      ? 'border-brand text-brand'
                      : 'border-transparent text-inkFaint hover:text-ink hover:border-inkFaint/30'
                  }`}
                >
                  {tab === 'about' && 'About'}
                  {tab === 'reviews' && `Reviews (${reviews.length})`}
                  {tab === 'contact' && 'Contact'}
                </button>
              ))}
            </div>

            {/* About Tab */}
            {activeTab === 'about' && (
              <div className="space-y-6">
                <div className="bg-surface rounded-2xl p-6 border border-border shadow-card">
                  <h3 className="font-black mb-3">About</h3>
                  {business.description ? (
                    <p className="text-inkMid leading-relaxed">{business.description}</p>
                  ) : (
                    <p className="text-inkFaint italic">No description provided yet.</p>
                  )}
                </div>

                {/* Custom Business Info Section */}
                <div className="bg-surface rounded-2xl p-6 border border-border shadow-card">
                  <h3 className="font-black mb-4">Business Highlights</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {business.years_in_business && (
                      <div className="bg-ivory rounded-xl p-4 border border-border">
                        <p className="text-xs text-inkFaint font-medium uppercase tracking-wider">Years in Business</p>
                        <p className="text-xl font-black mt-1">{business.years_in_business} years</p>
                      </div>
                    )}
                    {business.team_size && (
                      <div className="bg-ivory rounded-xl p-4 border border-border">
                        <p className="text-xs text-inkFaint font-medium uppercase tracking-wider">Team Size</p>
                        <p className="text-xl font-black mt-1">{business.team_size} people</p>
                      </div>
                    )}
                  </div>

                  {business.specialties && business.specialties.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-inkFaint font-medium uppercase tracking-wider mb-2">Specialties</p>
                      <div className="flex flex-wrap gap-2">
                        {business.specialties.map((specialty, index) => (
                          <span key={index} className="bg-brandBg text-brand px-3 py-1 rounded-full text-sm font-medium border border-brand/20">
                            {specialty}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {business.awards && business.awards.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs text-inkFaint font-medium uppercase tracking-wider mb-2">Awards & Recognition</p>
                      <div className="space-y-2">
                        {business.awards.map((award, index) => (
                          <div key={index} className="flex items-center gap-2 text-sm text-inkMid">
                            <span className="text-yellow-500">🏆</span>
                            <span>{award}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!business.years_in_business && !business.team_size && !business.specialties?.length && !business.awards?.length && (
                    <p className="text-inkFaint text-sm text-center py-4">
                      No additional details provided yet.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Reviews Tab */}
            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <div className="bg-surface rounded-2xl p-12 border border-border shadow-card text-center">
                    <div className="w-12 h-12 bg-ivoryDim rounded-xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-6 h-6 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                      </svg>
                    </div>
                    <p className="text-inkFaint font-medium">No reviews yet</p>
                    <p className="text-inkFaint text-sm mt-1">Be the first to review this business</p>
                  </div>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-surface rounded-xl p-5 border border-border shadow-card hover:shadow-lift transition">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-black">{review.reviewer_name}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className={star <= review.rating ? 'text-yellow-500' : 'text-ivoryDim'}>
                              ★
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-inkMid text-sm">{review.comment}</p>
                      <p className="text-inkFaint text-xs mt-2">{new Date(review.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    </div>
                  ))
                )}

                <div className="bg-surface rounded-2xl p-6 border border-border shadow-card">
                  <h3 className="font-black mb-4">Leave a Review</h3>
                  {reviewSubmitted ? (
                    <div className="text-center py-6">
                      <div className="w-12 h-12 bg-brandBg rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-6 h-6 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <p className="text-brand font-bold">Thank you for your review!</p>
                      <p className="text-inkFaint text-sm mt-1">Your feedback helps others trust this business</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-4">
                      <input
                        type="text"
                        placeholder="Your name"
                        value={reviewForm.reviewer_name}
                        onChange={(e) => setReviewForm({ ...reviewForm, reviewer_name: e.target.value })}
                        required
                        className="w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition"
                      />
                      <div>
                        <p className="text-sm text-inkFaint mb-2 font-medium">Rating</p>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                              className={`text-3xl transition hover:scale-110 ${star <= reviewForm.rating ? 'text-yellow-500' : 'text-ivoryDim hover:text-yellow-500'}`}
                            >
                              ★
                            </button>
                          ))}
                        </div>
                      </div>
                      <textarea
                        placeholder="Share your experience..."
                        value={reviewForm.comment}
                        onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                        rows={3}
                        required
                        className="w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition resize-none"
                      />
                      <button
                        type="submit"
                        disabled={sendingReview}
                        className="w-full bg-brand hover:bg-brand/90 text-white font-black py-3 rounded-xl transition shadow-brand disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sendingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Contact Tab */}
            {activeTab === 'contact' && (
              <div className="bg-surface rounded-2xl p-6 border border-border shadow-card">
                <h3 className="font-black mb-4">Contact Information</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 bg-ivory rounded-xl border border-border">
                    <div className="w-10 h-10 bg-brandBg rounded-lg flex items-center justify-center text-brand font-black text-sm">📞</div>
                    <div>
                      <p className="text-xs text-inkFaint font-medium">Phone</p>
                      <p className="font-bold">{business.phone}</p>
                    </div>
                  </div>
                  {business.email && (
                    <div className="flex items-center gap-3 p-3 bg-ivory rounded-xl border border-border">
                      <div className="w-10 h-10 bg-brandBg rounded-lg flex items-center justify-center text-brand font-black text-sm">✉️</div>
                      <div>
                        <p className="text-xs text-inkFaint font-medium">Email</p>
                        <p className="font-bold">{business.email}</p>
                      </div>
                    </div>
                  )}
                  {business.address && (
                    <div className="flex items-center gap-3 p-3 bg-ivory rounded-xl border border-border">
                      <div className="w-10 h-10 bg-brandBg rounded-lg flex items-center justify-center text-brand font-black text-sm">📍</div>
                      <div>
                        <p className="text-xs text-inkFaint font-medium">Address</p>
                        <p className="font-bold">{business.address}</p>
                      </div>
                    </div>
                  )}
                  {business.hours && (
                    <div className="flex items-center gap-3 p-3 bg-ivory rounded-xl border border-border">
                      <div className="w-10 h-10 bg-brandBg rounded-lg flex items-center justify-center text-brand font-black text-sm">🕐</div>
                      <div>
                        <p className="text-xs text-inkFaint font-medium">Business Hours</p>
                        <p className="font-bold">{business.hours}</p>
                      </div>
                    </div>
                  )}
                  {business.social_media && Object.keys(business.social_media).length > 0 && (
                    <div className="p-3 bg-ivory rounded-xl border border-border">
                      <p className="text-xs text-inkFaint font-medium mb-2">Social Media</p>
                      <div className="flex gap-3">
                        {business.social_media.instagram && (
                          <a href={business.social_media.instagram} target="_blank" rel="noreferrer" className="text-2xl hover:scale-110 transition">📸</a>
                        )}
                        {business.social_media.twitter && (
                          <a href={business.social_media.twitter} target="_blank" rel="noreferrer" className="text-2xl hover:scale-110 transition">🐦</a>
                        )}
                        {business.social_media.facebook && (
                          <a href={business.social_media.facebook} target="_blank" rel="noreferrer" className="text-2xl hover:scale-110 transition">📘</a>
                        )}
                        {business.social_media.linkedin && (
                          <a href={business.social_media.linkedin} target="_blank" rel="noreferrer" className="text-2xl hover:scale-110 transition">🔗</a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-surface rounded-2xl p-6 border border-border shadow-card sticky top-24">
              <h3 className="font-black mb-4">Contact Business</h3>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 p-2 bg-ivory rounded-xl border border-border">
                  <div className="w-8 h-8 bg-brandBg rounded-lg flex items-center justify-center text-brand text-xs font-black">📞</div>
                  <span className="text-sm font-medium">{business.phone}</span>
                </div>
                {business.website_url && (
                  <a href={business.website_url} target="_blank" rel="noreferrer" 
                    className="flex items-center gap-3 p-2 bg-ivory rounded-xl border border-border hover:border-brand transition group">
                    <div className="w-8 h-8 bg-brandBg rounded-lg flex items-center justify-center text-brand text-xs font-black">🌐</div>
                    <span className="text-sm text-brand group-hover:underline font-medium">Visit Website</span>
                  </a>
                )}
              </div>

              {messageSent ? (
                <div className="text-center py-6 bg-brandBg rounded-xl border border-brand/20">
                  <div className="w-10 h-10 bg-brand rounded-full flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-brand font-bold text-sm">Message sent!</p>
                  <p className="text-inkFaint text-xs mt-1">The business will get back to you</p>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={messageForm.sender_name}
                    onChange={(e) => setMessageForm({ ...messageForm, sender_name: e.target.value })}
                    required
                    className="w-full bg-ivory border border-border rounded-xl px-4 py-2.5 text-sm placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition"
                  />
                  <input
                    type="tel"
                    placeholder="Your phone (optional)"
                    value={messageForm.sender_phone}
                    onChange={(e) => setMessageForm({ ...messageForm, sender_phone: e.target.value })}
                    className="w-full bg-ivory border border-border rounded-xl px-4 py-2.5 text-sm placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition"
                  />
                  <textarea
                    placeholder="Your message..."
                    value={messageForm.content}
                    onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                    rows={3}
                    required
                    className="w-full bg-ivory border border-border rounded-xl px-4 py-2.5 text-sm placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage}
                    className="w-full bg-brand hover:bg-brand/90 text-white font-black py-2.5 rounded-xl transition shadow-brand text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sendingMessage ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Link href="/discover" className="text-center text-inkFaint text-sm hover:text-ink transition font-medium">
                ← Back to Discover
              </Link>
              <button
                onClick={handleShare}
                className="text-center text-brand text-sm hover:underline font-medium flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share this page
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
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

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : null

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 text-xl animate-pulse">Loading...</div>
      </div>
    )
  }

  if (!business) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-center px-6">
        <div>
          <h2 className="text-2xl font-bold mb-2">Business not found</h2>
          <p className="text-gray-400 mb-6">This business may have been removed.</p>
          <Link href="/discover" className="bg-green-400 text-black font-semibold px-6 py-3 rounded-xl">
            Back to Discover
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">

      <nav className="border-b border-gray-800/50 px-6 py-4 flex items-center justify-between sticky top-0 bg-black/80 backdrop-blur-sm z-10">
        <Link href="/discover" className="text-xl font-bold">
          Kaltrix<span className="text-green-400">OS</span>
        </Link>
        <Link href="/register" className="bg-green-400 hover:bg-green-300 text-black text-sm font-semibold px-4 py-2 rounded-lg transition">
          List Your Business
        </Link>
      </nav>

      <div className="bg-gradient-to-b from-gray-900 to-black border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-6 py-10">
          <div className="flex items-start gap-6">
            <div className="w-20 h-20 rounded-2xl bg-gray-800 border border-gray-700 flex items-center justify-center text-3xl font-bold text-gray-400 overflow-hidden flex-shrink-0">
              {business.logo_url ? (
                <img src={business.logo_url} alt={business.business_name} className="w-full h-full object-cover" />
              ) : (
                business.business_name.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="text-2xl md:text-3xl font-bold">{business.business_name}</h1>
                {business.is_verified && (
                  <span className="bg-green-400/10 text-green-400 text-xs px-2 py-1 rounded-full border border-green-400/20">
                    Verified
                  </span>
                )}
              </div>
              <p className="text-gray-400 mb-3">{business.industry} - {business.city}</p>
              <div className="flex items-center gap-4 flex-wrap">
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium ${
                  business.trust_score >= 70 ? 'bg-green-400/10 text-green-400 border-green-400/20' :
                  business.trust_score >= 40 ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' :
                  'bg-red-400/10 text-red-400 border-red-400/20'
                }`}>
                  TrustScore: {business.trust_score}/100
                </div>
                {avgRating && (
                  <div className="flex items-center gap-1 text-yellow-400 text-sm">
                    <span>&#9733;</span>
                    <span className="font-medium">{avgRating}</span>
                    <span className="text-gray-500">({reviews.length} reviews)</span>
                  </div>
                )}
                {business.website_url && (
                  <a href={business.website_url} target="_blank" rel="noreferrer" className="text-green-400 text-sm hover:underline">
                    Visit Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          <div className="md:col-span-2 space-y-6">
            <div className="flex gap-2 border-b border-gray-800">
              {['about', 'reviews'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-3 text-sm font-medium capitalize transition border-b-2 ${
                    activeTab === tab
                      ? 'border-green-400 text-green-400'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  {tab}
                  {tab === 'reviews' && reviews.length > 0 && (
                    <span className="ml-2 text-xs text-gray-500">({reviews.length})</span>
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'about' && (
              <div className="space-y-6">
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <h3 className="font-semibold mb-3">About</h3>
                  {business.description ? (
                    <p className="text-gray-400 leading-relaxed">{business.description}</p>
                  ) : (
                    <p className="text-gray-600 italic">No description provided yet.</p>
                  )}
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <h3 className="font-semibold mb-4">TrustScore Breakdown</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Business Verified', done: business.is_verified, points: 20 },
                      { label: 'Has Website', done: !!business.website_url, points: 20 },
                      { label: 'Has Logo', done: !!business.logo_url, points: 20 },
                      { label: 'Has Description', done: !!business.description, points: 15 },
                      { label: 'Has Reviews', done: reviews.length > 0, points: 15 },
                      { label: 'Contact Info', done: !!business.phone, points: 10 },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${
                            item.done ? 'bg-green-400 text-black' : 'bg-gray-800 text-gray-600'
                          }`}>
                            {item.done ? 'v' : 'x'}
                          </div>
                          <span className="text-sm text-gray-400">{item.label}</span>
                        </div>
                        <span className={`text-xs font-medium ${item.done ? 'text-green-400' : 'text-gray-600'}`}>
                          +{item.points}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 bg-gray-800 rounded-full h-2">
                    <div className="bg-green-400 h-2 rounded-full" style={{ width: business.trust_score + '%' }} />
                  </div>
                  <p className="text-right text-xs text-gray-500 mt-1">{business.trust_score}/100</p>
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-4">
                {reviews.length === 0 ? (
                  <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800 text-center">
                    <p className="text-gray-400">No reviews yet — be the first</p>
                  </div>
                ) : (
                  reviews.map((review) => (
                    <div key={review.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium">{review.reviewer_name}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span key={star} className={star <= review.rating ? 'text-yellow-400' : 'text-gray-700'}>
                              &#9733;
                            </span>
                          ))}
                        </div>
                      </div>
                      <p className="text-gray-400 text-sm">{review.comment}</p>
                      <p className="text-gray-600 text-xs mt-2">{new Date(review.created_at).toLocaleDateString()}</p>
                    </div>
                  ))
                )}

                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <h3 className="font-semibold mb-4">Leave a Review</h3>
                  {reviewSubmitted ? (
                    <div className="text-center py-4">
                      <p className="text-green-400 font-medium">Thank you for your review!</p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmitReview} className="space-y-4">
                      <input
                        type="text"
                        placeholder="Your name"
                        value={reviewForm.reviewer_name}
                        onChange={(e) => setReviewForm({ ...reviewForm, reviewer_name: e.target.value })}
                        required
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
                      />
                      <div>
                        <p className="text-sm text-gray-400 mb-2">Rating</p>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewForm({ ...reviewForm, rating: star })}
                              className={`text-2xl transition ${star <= reviewForm.rating ? 'text-yellow-400' : 'text-gray-700 hover:text-yellow-400'}`}
                            >
                              &#9733;
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
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition resize-none"
                      />
                      <button
                        type="submit"
                        disabled={sendingReview}
                        className="w-full bg-green-400 hover:bg-green-300 text-black font-semibold py-3 rounded-lg transition disabled:opacity-50"
                      >
                        {sendingReview ? 'Submitting...' : 'Submit Review'}
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 sticky top-24">
              <h3 className="font-semibold mb-4">Contact Business</h3>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 text-xs font-bold">
                    Ph
                  </div>
                  <span className="text-gray-400">{business.phone}</span>
                </div>
                {business.website_url && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400 text-xs font-bold">
                      W
                    </div>
                    <a href={business.website_url} target="_blank" rel="noreferrer" className="text-green-400 hover:underline">
                      Visit Website
                    </a>
                  </div>
                )}
              </div>

              {messageSent ? (
                <div className="text-center py-4 bg-green-400/10 rounded-xl border border-green-400/20">
                  <p className="text-green-400 font-medium text-sm">Message sent!</p>
                  <p className="text-gray-500 text-xs mt-1">The business will get back to you</p>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} className="space-y-3">
                  <input
                    type="text"
                    placeholder="Your name"
                    value={messageForm.sender_name}
                    onChange={(e) => setMessageForm({ ...messageForm, sender_name: e.target.value })}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
                  />
                  <input
                    type="tel"
                    placeholder="Your phone (optional)"
                    value={messageForm.sender_phone}
                    onChange={(e) => setMessageForm({ ...messageForm, sender_phone: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
                  />
                  <textarea
                    placeholder="Your message..."
                    value={messageForm.content}
                    onChange={(e) => setMessageForm({ ...messageForm, content: e.target.value })}
                    rows={3}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-400 transition resize-none"
                  />
                  <button
                    type="submit"
                    disabled={sendingMessage}
                    className="w-full bg-green-400 hover:bg-green-300 text-black font-semibold py-2.5 rounded-lg transition text-sm disabled:opacity-50"
                  >
                    {sendingMessage ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>

            <Link href="/discover" className="block text-center text-gray-500 text-sm hover:text-white transition">
              Back to Discover
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
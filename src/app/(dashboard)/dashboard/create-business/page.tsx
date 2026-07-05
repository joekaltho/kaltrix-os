'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { calculateTrustScore } from '@/lib/trust-score'

const industries = [
  'Restaurant & Food', 'Fashion & Clothing', 'Health & Wellness',
  'Technology', 'Education', 'Real Estate', 'Beauty & Salon',
  'Logistics & Delivery', 'Finance & Accounting', 'Retail & Shopping',
  'Entertainment', 'Agriculture', 'Construction', 'Other',
]

const inputClass = 'w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm'
const labelClass = 'text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block'

export default function CreateBusinessPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState('')
  const [form, setForm] = useState({
    business_name: '',
    industry: '',
    city: '',
    phone: '',
    website_url: '',
    description: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Logo must be under 5MB'); return }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const generateSlug = (name: string) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    return `${base}-${Date.now().toString(36)}`
  }

  const getTrustScore = () => calculateTrustScore({
    business_name: form.business_name,
    industry: form.industry,
    city: form.city,
    phone: form.phone,
    website_url: form.website_url,
    description: form.description,
    has_logo: !!logoFile,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Your session has expired. Please sign in again.')
      setLoading(false)
      setTimeout(() => router.push('/login'), 2000)
      return
    }

    const { data: existing } = await supabase
      .from('businesses').select('id').eq('user_id', user.id).single()
    if (existing) { router.push('/dashboard'); return }

    let logo_url = ''

    if (logoFile) {
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('logos').upload(fileName, logoFile, { upsert: true })

      if (uploadError) {
        setError(`Logo upload failed — profile will be saved without a logo. You can add one later.`)
      } else {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
        logo_url = urlData.publicUrl
      }
    }

    const trust_score = getTrustScore()
    const slug = generateSlug(form.business_name)

    const { error: insertError } = await supabase.from('businesses').insert({
      user_id: user.id,
      ...form,
      logo_url,
      trust_score,
      slug,
      is_verified: false,
    })

    if (insertError) {
      setError(`Could not save profile: ${insertError.message} (code: ${insertError.code})`)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-ivory font-sans flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-surface rounded-2xl border border-border shadow-lift p-12">
            <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-brand">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-black text-ink mb-2">Profile Created!</h1>
            <p className="text-inkFaint text-sm mb-1">Your business is now live on KaltrixOS.</p>
            <p className="text-inkFaint text-sm">Taking you to your dashboard...</p>
            <div className="mt-6 flex justify-center">
              <span className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory font-sans">

      {/* Nav */}
      <nav className="glass border-b border-border shadow-card sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-base font-black tracking-tight">Kaltrix<span className="text-brand">OS</span></span>
          <Link href="/dashboard" className="text-xs text-inkFaint hover:text-ink transition font-medium">
            ← Back to Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-black text-ink">Create your business profile</h1>
          <p className="text-inkFaint text-sm mt-1.5">Fill in your details to get your TrustScore and go live on KaltrixOS</p>
        </div>

        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-xl p-4 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Logo */}
          <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border shadow-card">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider mb-4">Business Logo</h2>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-ivoryDim border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
                ) : (
                  <svg className="w-6 h-6 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                )}
              </div>
              <div>
                <label className="cursor-pointer inline-flex items-center gap-2 bg-ivory hover:bg-ivoryDim border border-border text-ink text-xs font-bold px-4 py-2.5 rounded-xl transition">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Upload Logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                </label>
                <p className="text-inkFaint text-xs mt-2">PNG or JPG, max 5MB</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border shadow-card space-y-4">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">Basic Information</h2>

            <div>
              <label className={labelClass}>Business Name *</label>
              <input type="text" name="business_name" value={form.business_name} onChange={handleChange} required placeholder="e.g. Mama's Kitchen" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Industry *</label>
              <select name="industry" value={form.industry} onChange={handleChange} required className={inputClass}>
                <option value="">Select your industry</option>
                {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>City *</label>
                <input type="text" name="city" value={form.city} onChange={handleChange} required placeholder="e.g. Abuja" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone Number *</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} required placeholder="08012345678" className={inputClass} />
              </div>
            </div>
          </div>

          {/* Online Presence */}
          <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border shadow-card space-y-4">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">Online Presence</h2>

            <div>
              <label className={labelClass}>Website URL</label>
              <input type="url" name="website_url" value={form.website_url} onChange={handleChange} placeholder="https://yourbusiness.com" className={inputClass} />
            </div>

            <div>
              <label className={labelClass}>Business Description</label>
              <textarea
                name="description" value={form.description} onChange={handleChange} rows={4}
                placeholder="Tell customers what your business does, what makes you unique..."
                className={inputClass + ' resize-none'}
              />
              <p className="text-inkFaint text-xs mt-1.5">{form.description.length} characters</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-brand text-white font-black py-4 rounded-xl transition shadow-brand disabled:opacity-50 text-sm sm:text-base flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Creating your profile...
              </>
            ) : 'Create Business Profile'}
          </button>

          <div className="flex items-center justify-center gap-2 py-2">
            <svg className="w-3.5 h-3.5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-inkFaint text-xs">
              Your <span className="text-ink font-semibold">TrustScore</span> is calculated automatically by our AI engine
            </p>
          </div>

        </form>
      </div>
    </div>
  )
}

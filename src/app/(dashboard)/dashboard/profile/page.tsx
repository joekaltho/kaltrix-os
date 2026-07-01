'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { calculateTrustScore } from '@/lib/trust-score'

const industries = [
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

export default function EditProfilePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    business_name: '',
    industry: '',
    city: '',
    phone: '',
    website_url: '',
    description: '',
    logo_url: '',
  })

  useEffect(() => {
    const fetchBusiness = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: business } = await supabase
        .from('businesses')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (business) {
        setBusinessId(business.id)
        setForm({
          business_name: business.business_name || '',
          industry: business.industry || '',
          city: business.city || '',
          phone: business.phone || '',
          website_url: business.website_url || '',
          description: business.description || '',
          logo_url: business.logo_url || '',
        })
      }
      setLoading(false)
    }
    fetchBusiness()
  }, [])

  const getTrustScore = () => calculateTrustScore({
    business_name: form.business_name,
    industry: form.industry,
    city: form.city,
    phone: form.phone,
    website_url: form.website_url,
    description: form.description,
    has_logo: !!(form.logo_url || logoFile),
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    let logo_url = form.logo_url

    if (logoFile) {
      const { data: { user } } = await supabase.auth.getUser()
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, logoFile)

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('logos')
          .getPublicUrl(fileName)
        logo_url = urlData.publicUrl
      }
    }

    const trust_score = getTrustScore()

    const { error: updateError } = await supabase
      .from('businesses')
      .update({ ...form, logo_url, trust_score })
      .eq('id', businessId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSaved(true)
    setSaving(false)
    setTimeout(() => setSaved(false), 3000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory font-sans flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const inputClass = 'w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm'
  const labelClass = 'text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block'

  return (
    <div className="min-h-screen bg-ivory font-sans">
      <nav className="glass border-b border-border shadow-card sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <span className="text-base font-black tracking-tight">Kaltrix<span className="text-brand">OS</span></span>
          <Link href="/dashboard" className="text-xs text-inkFaint hover:text-ink transition font-medium">← Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-black text-ink">Edit Business Profile</h1>
          <p className="text-inkFaint text-sm mt-1">Keep your profile complete for a higher TrustScore</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6 text-sm">{error}</div>
        )}

        {saved && (
          <div className="bg-brandBg border border-brand/20 text-brand rounded-xl p-4 mb-6 text-sm font-semibold flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Profile saved successfully
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Logo */}
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-card">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider mb-4">Business Logo</h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-ivoryDim border border-border flex items-center justify-center overflow-hidden flex-shrink-0">
                {logoFile ? (
                  <img src={URL.createObjectURL(logoFile)} alt="Logo" className="w-full h-full object-cover" />
                ) : form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
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
                  {form.logo_url ? 'Change Logo' : 'Upload Logo'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
                </label>
                <p className="text-inkFaint text-xs mt-2">PNG or JPG, max 5MB</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-card space-y-4">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">Basic Information</h2>
            <div>
              <label className={labelClass}>Business Name *</label>
              <input type="text" name="business_name" value={form.business_name} onChange={handleChange} required className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Industry *</label>
              <select name="industry" value={form.industry} onChange={handleChange} required className={inputClass}>
                <option value="">Select industry</option>
                {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>City *</label>
                <input type="text" name="city" value={form.city} onChange={handleChange} required className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Phone Number *</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} required className={inputClass} />
              </div>
            </div>
          </div>

          {/* Online Presence */}
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-card space-y-4">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">Online Presence</h2>
            <div>
              <label className={labelClass}>Website URL</label>
              <input type="url" name="website_url" value={form.website_url} onChange={handleChange} placeholder="https://yourbusiness.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Business Description</label>
              <textarea name="description" value={form.description} onChange={handleChange} rows={4} placeholder="Tell customers what your business does..." className={inputClass + ' resize-none'} />
              <p className="text-inkFaint text-xs mt-1.5">{form.description.length} characters</p>
            </div>
          </div>

          <button type="submit" disabled={saving} className="w-full gradient-brand text-white font-black py-4 rounded-xl transition shadow-brand disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {saving ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : 'Save Changes'}
          </button>

          <div className="flex items-center justify-center gap-2 py-1">
            <svg className="w-3.5 h-3.5 text-brand" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <p className="text-inkFaint text-xs">
              Your <span className="text-ink font-semibold">TrustScore</span> is recalculated automatically by our AI engine on save
            </p>
          </div>

        </form>
      </div>
    </div>
  )
}
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

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

  const calculateTrustScore = () => {
    let score = 0
    if (form.business_name) score += 10
    if (form.industry) score += 10
    if (form.city) score += 10
    if (form.phone) score += 15
    if (form.website_url) score += 20
    if (form.description && form.description.length > 100) score += 15
    if (form.logo_url || logoFile) score += 20
    return score
  }

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

    const trust_score = calculateTrustScore()

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
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 text-xl animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center justify-between mb-8">
          <div>
            <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold mt-2">Edit Business Profile</h1>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs mb-1">TrustScore Preview</p>
            <p className="text-3xl font-black text-green-400">{calculateTrustScore()}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {saved && (
          <div className="bg-green-500/10 border border-green-500/20 text-green-400 rounded-lg p-3 mb-6 text-sm">
            Profile saved successfully!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Logo */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="font-semibold mb-4">Business Logo</h2>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-gray-800 border border-gray-700 flex items-center justify-center overflow-hidden">
                {logoFile ? (
                  <img src={URL.createObjectURL(logoFile)} alt="Logo" className="w-full h-full object-cover" />
                ) : form.logo_url ? (
                  <img src={form.logo_url} alt="Logo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-gray-500 text-sm">No logo</span>
                )}
              </div>
              <div>
                <label className="cursor-pointer bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white text-sm px-4 py-2 rounded-lg transition inline-block">
                  Upload New Logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="text-gray-500 text-xs mt-2">PNG, JPG up to 5MB</p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold">Basic Information</h2>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Business Name *</label>
              <input
                type="text"
                name="business_name"
                value={form.business_name}
                onChange={handleChange}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Industry *</label>
              <select
                name="industry"
                value={form.industry}
                onChange={handleChange}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
              >
                <option value="">Select industry</option>
                {industries.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">City *</label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Phone Number *</label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
              />
            </div>
          </div>

          {/* Online Presence */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold">Online Presence</h2>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Website URL
                <span className="text-green-400 ml-2 text-xs">+20 TrustScore</span>
              </label>
              <input
                type="url"
                name="website_url"
                value={form.website_url}
                onChange={handleChange}
                placeholder="https://yourbusiness.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
              />
              {!form.website_url && (
                <p className="text-yellow-500 text-xs mt-1">No website — this lowers your TrustScore</p>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Business Description
                <span className="text-green-400 ml-2 text-xs">+15 TrustScore</span>
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                placeholder="Tell customers what your business does..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition resize-none"
              />
              <p className="text-gray-500 text-xs mt-1">
                {form.description.length}/100 characters minimum for TrustScore boost
              </p>
            </div>
          </div>

          {/* TrustScore Preview */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="font-semibold mb-3">TrustScore Preview</h2>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-black text-green-400">{calculateTrustScore()}</div>
              <div>
                <p className="text-gray-400 text-sm">out of 100</p>
                <p className="text-gray-500 text-xs mt-1">Complete your profile to increase your score</p>
              </div>
            </div>
            <div className="mt-4 bg-gray-800 rounded-full h-2">
              <div
                className="bg-green-400 h-2 rounded-full transition-all duration-500"
                style={{ width: calculateTrustScore() + '%' }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-green-400 hover:bg-green-300 text-black font-semibold rounded-lg px-4 py-4 transition disabled:opacity-50 text-lg"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

        </form>
      </div>
    </div>
  )
}
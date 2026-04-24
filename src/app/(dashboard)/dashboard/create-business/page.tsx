'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

export default function CreateBusinessPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    business_name: '',
    industry: '',
    city: '',
    phone: '',
    website_url: '',
    description: '',
  })

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
  }

  const calculateTrustScore = (data: typeof form, hasLogo: boolean) => {
    let score = 0
    if (data.business_name) score += 10
    if (data.industry) score += 10
    if (data.city) score += 10
    if (data.phone) score += 15
    if (data.website_url) score += 20
    if (data.description && data.description.length > 100) score += 15
    if (hasLogo) score += 20
    return score
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    let logo_url = ''

    // Upload logo if selected
    if (logoFile) {
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from('logos')
        .upload(fileName, logoFile)

      if (uploadError) {
        setError(uploadError.message)
        setLoading(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('logos')
        .getPublicUrl(fileName)

      logo_url = urlData.publicUrl
    }

    const trust_score = calculateTrustScore(form, !!logoFile)
    const slug = generateSlug(form.business_name)

    const { error: insertError } = await supabase
      .from('businesses')
      .insert({
        user_id: user.id,
        ...form,
        logo_url,
        trust_score,
        slug,
      })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Create Your <span className="text-green-400">Business Profile</span>
          </h1>
          <p className="text-gray-400 mt-2">
            Fill in your details to get your TrustScore and go live on KaltrixOS
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400
          rounded-lg p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Logo Upload */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-4">Business Logo</h2>
            <div className="flex items-center gap-4">
              {logoFile ? (
                <img
                  src={URL.createObjectURL(logoFile)}
                  alt="Logo preview"
                  className="w-20 h-20 rounded-xl object-cover border border-gray-700"
                />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-gray-800 border border-gray-700
                flex items-center justify-center text-gray-500 text-sm">
                  No logo
                </div>
              )}
              <div>
                <label className="cursor-pointer bg-gray-800 hover:bg-gray-700
                border border-gray-700 text-white text-sm px-4 py-2 rounded-lg
                transition inline-block">
                  Upload Logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  />
                </label>
                <p className="text-gray-500 text-xs mt-2">
                  PNG, JPG up to 5MB. Adds +20 to TrustScore
                </p>
              </div>
            </div>
          </div>

          {/* Basic Info */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-lg font-semibold">Basic Information</h2>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Business Name *
              </label>
              <input
                type="text"
                name="business_name"
                value={form.business_name}
                onChange={handleChange}
                required
                placeholder="e.g. Mama's Kitchen"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg
                px-4 py-3 text-white placeholder-gray-500 focus:outline-none
                focus:border-green-400 transition"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Industry *
              </label>
              <select
                name="industry"
                value={form.industry}
                onChange={handleChange}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg
                px-4 py-3 text-white focus:outline-none focus:border-green-400
                transition"
              >
                <option value="">Select your industry</option>
                {industries.map((ind) => (
                  <option key={ind} value={ind}>{ind}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                City *
              </label>
              <input
                type="text"
                name="city"
                value={form.city}
                onChange={handleChange}
                required
                placeholder="e.g. Abuja"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg
                px-4 py-3 text-white placeholder-gray-500 focus:outline-none
                focus:border-green-400 transition"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Phone Number *
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                required
                placeholder="e.g. 08012345678"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg
                px-4 py-3 text-white placeholder-gray-500 focus:outline-none
                focus:border-green-400 transition"
              />
            </div>
          </div>

          {/* Online Presence */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="text-lg font-semibold">Online Presence</h2>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Website URL
                <span className="text-green-400 ml-2">+20 TrustScore</span>
              </label>
              <input
                type="url"
                name="website_url"
                value={form.website_url}
                onChange={handleChange}
                placeholder="https://yourbusiness.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg
                px-4 py-3 text-white placeholder-gray-500 focus:outline-none
                focus:border-green-400 transition"
              />
              {!form.website_url && (
                <p className="text-yellow-500 text-xs mt-1">
                  ⚠ No website detected — this hurts your TrustScore
                </p>
              )}
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">
                Business Description
                <span className="text-green-400 ml-2">+15 TrustScore</span>
              </label>
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                rows={4}
                placeholder="Tell customers what your business does, what makes you unique..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg
                px-4 py-3 text-white placeholder-gray-500 focus:outline-none
                focus:border-green-400 transition resize-none"
              />
              <p className="text-gray-500 text-xs mt-1">
                {form.description.length}/100 characters minimum for TrustScore boost
              </p>
            </div>
          </div>

          {/* Trust Score Preview */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
            <h2 className="text-lg font-semibold mb-3">Your TrustScore Preview</h2>
            <div className="flex items-center gap-4">
              <div className="text-5xl font-bold text-green-400">
                {calculateTrustScore(form, !!logoFile)}
              </div>
              <div>
                <p className="text-gray-400 text-sm">out of 100</p>
                <p className="text-gray-500 text-xs mt-1">
                  Complete your profile to increase your score
                </p>
              </div>
            </div>
            <div className="mt-4 bg-gray-800 rounded-full h-2">
              <div
                className="bg-green-400 h-2 rounded-full transition-all duration-500"
                style={{ width: `${calculateTrustScore(form, !!logoFile)}%` }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-400 hover:bg-green-300 text-black
            font-semibold rounded-lg px-4 py-4 transition disabled:opacity-50
            disabled:cursor-not-allowed text-lg"
          >
            {loading ? 'Creating your profile...' : 'Create Business Profile →'}
          </button>

        </form>
      </div>
    </div>
  )
}
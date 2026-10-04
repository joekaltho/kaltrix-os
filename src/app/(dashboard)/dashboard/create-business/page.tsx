'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Upload } from 'lucide-react'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import FormPage, { FormActions, FormSection } from '@/components/ui/FormPage'
import { Button } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import Notice from '@/components/ui/Notice'
import { industries } from '@/lib/industries'

// Onboarding stays short on purpose: the four required fields first, the
// optional extras second. Contact email/address and payment details are
// prompted afterwards by the dashboard's setup checklist, not asked up front.
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

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : ''), [logoFile])
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview) }, [logoPreview])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { setError('Logo must be under 5MB'); return }
    setError('')
    setLogoFile(file)
  }

  const generateSlug = (name: string) => {
    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    return `${base}-${Date.now().toString(36)}`
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await getSessionUser(supabase)
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
    let logoFailed = false

    if (logoFile) {
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${user.id}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage
        .from('logos').upload(fileName, logoFile, { upsert: true })

      if (uploadError) {
        logoFailed = true
      } else {
        const { data: urlData } = supabase.storage.from('logos').getPublicUrl(fileName)
        logo_url = urlData.publicUrl
      }
    }

    const slug = generateSlug(form.business_name)

    const { error: insertError } = await supabase.from('businesses').insert({
      user_id: user.id,
      ...form,
      logo_url,
      slug,
      is_verified: false,
    })

    if (insertError) {
      setError(`Could not save profile: ${insertError.message} (code: ${insertError.code})`)
      setLoading(false)
      return
    }

    // Straight to the dashboard (its checklist takes it from here) rather than
    // a "Profile created!" screen followed by a 2s wait.
    router.push(`/dashboard?created=business${logoFailed ? '&logo=failed' : ''}`)
  }

  return (
    <FormPage
      title="Create your business profile"
      description="Four details to go live and get your TrustScore. You can add the rest later."
    >
      <form id="create-business-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Notice kind="warn" onDismiss={() => setError('')}>{error}</Notice>}

        <FormSection title="Your business">
          <TextField label="Business name" name="business_name" value={form.business_name} onChange={handleChange} required placeholder="e.g. Mama's Kitchen" />
          <SelectField label="Industry" name="industry" value={form.industry} onChange={handleChange} required>
            <option value="">Select your industry</option>
            {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
          </SelectField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="City" name="city" value={form.city} onChange={handleChange} required placeholder="e.g. Abuja" />
            <TextField label="Phone number" name="phone" type="tel" value={form.phone} onChange={handleChange} required placeholder="08012345678" />
          </div>
        </FormSection>

        <FormSection title="More detail" description="Optional. A fuller profile builds trust with customers.">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-ivoryDim text-inkFaint">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-6 w-6" aria-hidden />
              )}
            </div>
            <div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink transition hover:bg-ivoryDim focus-within:outline focus-within:outline-2 focus-within:outline-brandDim">
                <Upload className="h-4 w-4" aria-hidden />
                {logoFile ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/*" className="sr-only" onChange={handleLogoChange} />
              </label>
              <p className="mt-1.5 text-xs text-inkFaint">PNG or JPG, up to 5MB.</p>
            </div>
          </div>
          <TextField label="Website" optional name="website_url" type="url" value={form.website_url} onChange={handleChange} placeholder="https://yourbusiness.com" />
          <TextAreaField
            label="Description"
            optional
            name="description"
            value={form.description}
            onChange={handleChange}
            rows={4}
            placeholder="Tell customers what your business does and what makes you different."
          />
        </FormSection>

        <p className="px-1 text-xs text-inkFaint">
          Your <span className="font-medium text-inkMid">TrustScore</span> starts low and builds as you get verified, collect reviews and stay active.
        </p>
      </form>

      <FormActions>
        <Button type="submit" form="create-business-form" variant="primary" size="lg" loading={loading} className="w-full sm:w-auto">
          {loading ? 'Creating your profile…' : 'Create business profile'}
        </Button>
      </FormActions>
    </FormPage>
  )
}

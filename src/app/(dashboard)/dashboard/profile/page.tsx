'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Upload } from 'lucide-react'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import TrustScoreCard from '@/components/TrustScoreCard'
import PaymentInformation from '@/components/PaymentInformation'
import FormPage, { FormActions, FormSection } from '@/components/ui/FormPage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field'
import Notice from '@/components/ui/Notice'
import { industries } from '@/lib/industries'
import { validateBankFields } from '@/lib/payment'
import type { TrustSignal } from '@/lib/trust-score'

const MAX_LOGO_BYTES = 5 * 1024 * 1024

type FormState = {
  business_name: string
  industry: string
  city: string
  description: string
  logo_url: string
  phone: string
  email: string
  website_url: string
  address: string
  bank_name: string
  account_name: string
  account_number: string
  payment_instructions: string
}

const emptyForm: FormState = {
  business_name: '', industry: '', city: '', description: '', logo_url: '',
  phone: '', email: '', website_url: '', address: '',
  bank_name: '', account_name: '', account_number: '', payment_instructions: '',
}

export default function BusinessSettingsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [bankError, setBankError] = useState('')
  const [businessId, setBusinessId] = useState('')
  const [trustScore, setTrustScore] = useState(0)
  const [trustSignals, setTrustSignals] = useState<TrustSignal[]>([])
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [initial, setInitial] = useState<FormState>(emptyForm)

  const logoPreview = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : ''), [logoFile])
  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview) }, [logoPreview])

  useEffect(() => {
    const fetchBusiness = async () => {
      setLoadError('')
      try {
        const { data: { user } } = await getSessionUser(supabase)
        if (!user) { router.push('/login'); return }

        const { data: business } = await supabase
          .from('businesses')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (business) {
          setBusinessId(business.id)
          setTrustScore(business.trust_score || 0)
          setTrustSignals(business.trust_signals || [])

          // Owner-only table. Tolerant: a failed lookup just means "not set yet".
          const { data: bank } = await supabase
            .from('business_payment_details')
            .select('bank_name, account_name, account_number, payment_instructions')
            .eq('business_id', business.id)
            .maybeSingle()

          const loaded: FormState = {
            business_name: business.business_name || '',
            industry: business.industry || '',
            city: business.city || '',
            description: business.description || '',
            logo_url: business.logo_url || '',
            phone: business.phone || '',
            email: business.email || '',
            website_url: business.website_url || '',
            address: business.address || '',
            bank_name: bank?.bank_name || '',
            account_name: bank?.account_name || '',
            account_number: bank?.account_number || '',
            payment_instructions: bank?.payment_instructions || '',
          }
          setForm(loaded)
          setInitial(loaded)
        }
      } catch {
        setLoadError('Could not load your settings. Check your connection and try again.')
      }
      setLoading(false)
    }
    fetchBusiness()
  }, [])

  // Deep links like /dashboard/profile#payment (from the setup checklist):
  // the target only exists after the data has loaded, so scroll once it does.
  useEffect(() => {
    if (!loading && window.location.hash) {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' })
    }
  }, [loading])

  const set = (name: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setSaved(false)
    setForm((f) => ({ ...f, [name]: e.target.value }))
  }

  const dirty = logoFile !== null || JSON.stringify(form) !== JSON.stringify(initial)

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > MAX_LOGO_BYTES) { setError('Logo must be under 5MB.'); return }
    setError('')
    setSaved(false)
    setLogoFile(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBankError('')

    const bankMessage = validateBankFields(form)
    if (bankMessage) {
      setBankError(bankMessage)
      document.getElementById('payment')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
      return
    }

    setSaving(true)
    let logo_url = form.logo_url
    let logoFailed = false

    if (logoFile) {
      const { data: { user } } = await getSessionUser(supabase)
      const fileExt = logoFile.name.split('.').pop()
      const fileName = `${user?.id}-${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('logos').upload(fileName, logoFile)
      if (uploadError) {
        logoFailed = true
      } else {
        logo_url = supabase.storage.from('logos').getPublicUrl(fileName).data.publicUrl
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from('businesses')
      .update({
        business_name: form.business_name,
        industry: form.industry,
        city: form.city,
        phone: form.phone,
        website_url: form.website_url,
        description: form.description,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        logo_url,
      })
      .eq('id', businessId)
      .select('trust_score, trust_signals')
      .single()

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    // Payment details (owner-only table): bank details are all-or-nothing, the
    // instructions text is independent. Anything set -> upsert one row; both
    // cleared -> remove the row.
    const accountNumber = form.account_number.replace(/\s+/g, '')
    const hasBank = !!(form.bank_name.trim() && form.account_name.trim() && accountNumber)
    const instructions = form.payment_instructions.trim()
    const { error: bankWriteError } = hasBank || instructions
      ? await supabase.from('business_payment_details').upsert({
          business_id: businessId,
          bank_name: hasBank ? form.bank_name.trim() : null,
          account_name: hasBank ? form.account_name.trim() : null,
          account_number: hasBank ? accountNumber : null,
          payment_instructions: instructions || null,
          updated_at: new Date().toISOString(),
        })
      : await supabase.from('business_payment_details').delete().eq('business_id', businessId)

    if (updated) {
      setTrustScore(updated.trust_score || 0)
      setTrustSignals(updated.trust_signals || [])
    }

    const next = { ...form, logo_url, account_number: hasBank ? accountNumber : '' }
    setForm(next)
    setInitial(next)
    setLogoFile(null)
    setSaving(false)

    if (bankWriteError) {
      setError(`Your profile was saved, but the payment details were not: ${bankWriteError.message}`)
    } else if (logoFailed) {
      setError('Your changes were saved, but the logo could not be uploaded. Try a smaller image.')
    } else {
      setSaved(true)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory font-sans flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-ivory font-sans flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <p className="mb-1 font-semibold text-ink">Something went wrong</p>
          <p className="mb-6 text-sm text-inkFaint">{loadError}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    )
  }

  const logoSrc = logoPreview || form.logo_url
  const showPreview = !!(form.payment_instructions.trim() || (form.bank_name.trim() && form.account_name.trim() && form.account_number.trim()))

  return (
    <FormPage
      title="Business settings"
      description="Keep these details up to date. They appear on your public page and on every invoice."
    >
      <form id="settings-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Notice kind="error" onDismiss={() => setError('')}>{error}</Notice>}
        {saved && <Notice kind="success" onDismiss={() => setSaved(false)}>Settings saved.</Notice>}

        <FormSection title="Business">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-ivoryDim text-inkFaint">
              {logoSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoSrc} alt="Business logo" className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-6 w-6" aria-hidden />
              )}
            </div>
            <div>
              <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink transition hover:bg-ivoryDim focus-within:outline focus-within:outline-2 focus-within:outline-brandDim">
                <Upload className="h-4 w-4" aria-hidden />
                {form.logo_url || logoFile ? 'Change logo' : 'Upload logo'}
                <input type="file" accept="image/*" className="sr-only" onChange={handleLogoChange} />
              </label>
              <p className="mt-1.5 text-xs text-inkFaint">PNG or JPG, up to 5MB.</p>
            </div>
          </div>

          <TextField label="Business name" name="business_name" value={form.business_name} onChange={set('business_name')} required />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <SelectField label="Industry" name="industry" value={form.industry} onChange={set('industry')} required>
              <option value="">Select industry</option>
              {industries.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
            </SelectField>
            <TextField label="City" name="city" value={form.city} onChange={set('city')} required />
          </div>
          <TextAreaField
            label="Description"
            optional
            name="description"
            value={form.description}
            onChange={set('description')}
            rows={4}
            maxLength={1000}
            placeholder="Tell customers what your business does…"
          />
        </FormSection>

        <FormSection id="contact" title="Contact details" description="Customers see these on your public page and on invoices. Only phone is required.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Phone number" name="phone" type="tel" value={form.phone} onChange={set('phone')} required placeholder="08012345678" />
            <TextField label="Email" optional name="email" type="email" value={form.email} onChange={set('email')} maxLength={254} placeholder="hello@yourbusiness.com" />
          </div>
          <TextField label="Website" optional name="website_url" type="url" value={form.website_url} onChange={set('website_url')} placeholder="https://yourbusiness.com" />
          <TextField label="Business address" optional name="address" value={form.address} onChange={set('address')} maxLength={300} placeholder="12 Adeola Odeku St, Victoria Island, Lagos" />
        </FormSection>

        <FormSection
          id="payment"
          title="Payment details"
          description="Set this once. It appears as “Payment information” on every invoice you share."
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Bank name" optional name="bank_name" value={form.bank_name} onChange={set('bank_name')} maxLength={100} placeholder="e.g. GTBank" />
            <TextField label="Account name" optional name="account_name" value={form.account_name} onChange={set('account_name')} maxLength={150} placeholder="Name on the account" />
          </div>
          <TextField
            label="Account number"
            optional
            name="account_number"
            value={form.account_number}
            onChange={set('account_number')}
            inputMode="numeric"
            autoComplete="off"
            maxLength={24}
            placeholder="0123456789"
            error={bankError || null}
            hint="Digits only."
          />
          <TextAreaField
            label="Payment instructions"
            optional
            name="payment_instructions"
            value={form.payment_instructions}
            onChange={set('payment_instructions')}
            rows={3}
            maxLength={1000}
            placeholder="e.g. Use your name as the transfer reference. Mobile money: Opay 08012345678."
            hint="Anything else customers should know when paying."
          />

          {showPreview && (
            <div>
              <p className="mb-2 text-xs font-medium text-inkFaint">How it will look on invoices</p>
              <PaymentInformation bank={form} instructions={form.payment_instructions} />
            </div>
          )}
        </FormSection>

        {trustSignals.length > 0 && <TrustScoreCard score={trustScore} signals={trustSignals} />}
      </form>

      <FormActions>
        <span className="mr-auto text-xs text-inkFaint" aria-live="polite">
          {saving ? 'Saving…' : dirty ? 'Unsaved changes' : ''}
        </span>
        <ButtonLink href="/dashboard" variant="ghost">Cancel</ButtonLink>
        <Button
          type="submit"
          form="settings-form"
          variant="primary"
          loading={saving}
          disabled={!dirty}
        >
          Save changes
        </Button>
      </FormActions>
    </FormPage>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import PremiumGuard from '@/components/PremiumGuard'
import { useBusinessId } from '@/lib/business-context'
import FormPage, { FormActions, FormSection } from '@/components/ui/FormPage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TextAreaField, TextField } from '@/components/ui/Field'
import Notice from '@/components/ui/Notice'

function NewCustomerForm() {
  const router = useRouter()
  const supabase = createClient()
  const businessId = useBusinessId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!businessId) {
      setError('No business profile found.')
      setLoading(false)
      return
    }

    // Free now (cached session read, not a network call) -- kept as the
    // same defensive "session vanished mid-form" guard the original had.
    const { data: { user } } = await getSessionUser(supabase)
    if (!user) { router.push('/login'); return }

    const { error: insertError } = await supabase
      .from('customers').insert({ business_id: businessId, ...form })

    if (insertError) {
      setError(`Could not save customer: ${insertError.message}`)
      setLoading(false)
      return
    }

    router.push('/dashboard?tab=customers&created=customer')
  }

  return (
    <FormPage
      title="Add customer"
      description="Save a customer so you can find their details later."
      backHref="/dashboard?tab=customers"
      backLabel="Customers"
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Notice kind="error" onDismiss={() => setError('')}>{error}</Notice>}
        <FormSection title="Customer details">
          <TextField label="Full name" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Amina Bello" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Phone" optional type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="08012345678" />
            <TextField label="Email" optional type="email" name="email" value={form.email} onChange={handleChange} placeholder="amina@email.com" />
          </div>
          <TextAreaField label="Notes" optional name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Anything worth remembering about this customer" />
        </FormSection>
      </form>

      <FormActions>
        <ButtonLink href="/dashboard?tab=customers" variant="ghost">Cancel</ButtonLink>
        <Button type="submit" form="customer-form" variant="primary" loading={loading}>
          {loading ? 'Saving…' : 'Save customer'}
        </Button>
      </FormActions>
    </FormPage>
  )
}

export default function NewCustomerPage() {
  return (
    <PremiumGuard feature="crm">
      <NewCustomerForm />
    </PremiumGuard>
  )
}

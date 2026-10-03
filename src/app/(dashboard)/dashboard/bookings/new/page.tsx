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

function NewBookingForm() {
  const router = useRouter()
  const supabase = createClient()
  const businessId = useBusinessId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    service_description: '',
    booking_date: '',
    booking_time: '',
    notes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!businessId) {
      setError('No business profile found. Please create one first.')
      setLoading(false)
      return
    }

    // PremiumGuard already resolved the session to grant access to this
    // page -- still need the user id itself (not just businessId) for the
    // bookings row, so this one getSessionUser() stays (it's a cached
    // local read, not a network call; see lib/supabase/client.ts).
    const { data: { user } } = await getSessionUser(supabase)
    if (!user) { router.push('/login'); return }

    // Combine date + time into single timestamp
    const booking_date_time = form.booking_date && form.booking_time
      ? new Date(`${form.booking_date}T${form.booking_time}`).toISOString()
      : null

    const { error: insertError } = await supabase.from('bookings').insert({
      business_id: businessId,
      user_id: user.id,
      customer_name: form.customer_name,
      customer_phone: form.customer_phone,
      service_description: form.service_description,
      booking_date_time,
      notes: form.notes,
      status: 'pending',
    })

    if (insertError) {
      setError(`Could not save booking: ${insertError.message}`)
      setLoading(false)
      return
    }

    router.push('/dashboard?tab=bookings&created=booking')
  }

  return (
    <FormPage
      title="New booking"
      description="Add an appointment or booking."
      backHref="/dashboard?tab=bookings"
      backLabel="Bookings"
    >
      <form id="booking-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Notice kind="error" onDismiss={() => setError('')}>{error}</Notice>}

        <FormSection title="Customer">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Customer name" name="customer_name" value={form.customer_name} onChange={handleChange} required placeholder="e.g. Amina Bello" />
            <TextField label="Phone" optional type="tel" name="customer_phone" value={form.customer_phone} onChange={handleChange} placeholder="08012345678" />
          </div>
        </FormSection>

        <FormSection title="Booking">
          <TextField label="Service" name="service_description" value={form.service_description} onChange={handleChange} required placeholder="e.g. Haircut, Consultation, Delivery" />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Date" type="date" name="booking_date" value={form.booking_date} onChange={handleChange} required />
            <TextField label="Time" type="time" name="booking_time" value={form.booking_time} onChange={handleChange} required />
          </div>
          <TextAreaField label="Notes" optional name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Any special requests" />
        </FormSection>
      </form>

      <FormActions>
        <ButtonLink href="/dashboard?tab=bookings" variant="ghost">Cancel</ButtonLink>
        <Button type="submit" form="booking-form" variant="primary" loading={loading}>
          {loading ? 'Creating…' : 'Create booking'}
        </Button>
      </FormActions>
    </FormPage>
  )
}

export default function NewBookingPage() {
  return (
    <PremiumGuard feature="bookings">
      <NewBookingForm />
    </PremiumGuard>
  )
}

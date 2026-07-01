'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import PremiumGuard from '@/components/PremiumGuard'

const inputClass = 'w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm'
const labelClass = 'text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block'

function NewCustomerForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: business } = await supabase
      .from('businesses').select('id').eq('user_id', user.id).single()

    if (!business) {
      setError('No business profile found.')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('customers').insert({ business_id: business.id, ...form })

    if (insertError) {
      setError(`Could not save customer: ${insertError.message}`)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/dashboard'), 1500)
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
            <h1 className="text-xl font-black text-ink mb-2">Customer Saved</h1>
            <p className="text-inkFaint text-sm">Taking you back to your dashboard...</p>
            <div className="mt-4 flex justify-center">
              <span className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        </div>
      </div>
    )
  }

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
          <h1 className="text-2xl font-black text-ink">Add Customer</h1>
          <p className="text-inkFaint text-sm mt-1">Save a customer to your CRM</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-card space-y-4">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">Customer Information</h2>
            <div>
              <label className={labelClass}>Full Name *</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="e.g. Amina Bello" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Phone Number</label>
              <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="08012345678" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Email Address</label>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="amina@email.com" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea name="notes" value={form.notes} onChange={handleChange} rows={3} placeholder="Any notes about this customer..." className={inputClass + ' resize-none'} />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full gradient-brand text-white font-black py-4 rounded-xl transition shadow-brand disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : 'Save Customer'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewCustomerPage() {
  return (
    <PremiumGuard feature="crm">
      <NewCustomerForm />
    </PremiumGuard>
  )
}

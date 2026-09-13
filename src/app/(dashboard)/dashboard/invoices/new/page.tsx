'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import Link from 'next/link'
import { InvoiceItem } from '@/types'
import PremiumGuard from '@/components/PremiumGuard'
import { useBusinessId } from '@/lib/business-context'

const inputClass = 'w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm'
const labelClass = 'text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block'

function NewInvoiceForm() {
  const router = useRouter()
  const supabase = createClient()
  const businessId = useBusinessId()
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([
    { name: '', quantity: 1, price: 0 }
  ])
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    due_date: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    const updated = [...items]
    updated[index] = { ...updated[index], [field]: value }
    setItems(updated)
  }

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0 }])
  }

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index))
  }

  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (!businessId) {
      setError('No business found')
      setLoading(false)
      return
    }

    // Free now (cached session read, not a network call) -- kept as the
    // same defensive "session vanished mid-form" guard the original had.
    const { data: { user } } = await getSessionUser(supabase)
    if (!user) { router.push('/login'); return }

    const { error: insertError } = await supabase
      .from('invoices')
      .insert({
        business_id: businessId,
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        due_date: form.due_date || null,
        items: items,
        total: total,
        status: 'unpaid',
      })

    if (insertError) {
      setError(insertError.message)
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
            <h1 className="text-xl font-black text-ink mb-2">Invoice Created</h1>
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
          <h1 className="text-2xl font-black text-ink">New Invoice</h1>
          <p className="text-inkFaint text-sm mt-1">Create an invoice for your customer</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 mb-6 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Customer Details */}
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-card space-y-4">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">Customer Details</h2>
            <div>
              <label className={labelClass}>Customer Name *</label>
              <input
                type="text"
                name="customer_name"
                value={form.customer_name}
                onChange={handleChange}
                required
                placeholder="e.g. Amina Bello"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Customer Phone</label>
              <input
                type="tel"
                name="customer_phone"
                value={form.customer_phone}
                onChange={handleChange}
                placeholder="e.g. 08012345678"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Due Date</label>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleChange}
                className={inputClass}
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-surface rounded-2xl p-6 border border-border shadow-card space-y-4">
            <h2 className="text-sm font-black text-ink uppercase tracking-wider">Invoice Items</h2>

            {items.map((item, index) => (
              <div key={index} className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
                <div>
                  <label className={labelClass}>Item Name *</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    required
                    placeholder="e.g. Haircut, Web Design, Delivery"
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Quantity</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                      min="1"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Price (₦)</label>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))}
                      min="0"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-brand text-sm font-bold">
                    Subtotal: ₦{(item.quantity * item.price).toLocaleString()}
                  </p>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-600 text-sm hover:text-red-700 transition font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="w-full border border-dashed border-border rounded-xl py-3 text-inkFaint hover:text-ink hover:border-inkFaint transition text-sm font-medium"
            >
              + Add Another Item
            </button>
          </div>

          {/* Total */}
          <div className="bg-surface rounded-2xl p-6 border border-brand/20 shadow-card">
            <div className="flex items-center justify-between">
              <p className="text-inkFaint font-bold text-sm uppercase tracking-wider">Total Amount</p>
              <p className="text-3xl font-black text-brand">₦{total.toLocaleString()}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full gradient-brand text-white font-black py-4 rounded-xl transition shadow-brand disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Creating invoice...</>
            ) : 'Create Invoice'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function NewInvoicePage() {
  return (
    <PremiumGuard feature="invoices">
      <NewInvoiceForm />
    </PremiumGuard>
  )
}

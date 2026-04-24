'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { InvoiceItem } from '@/types'

export default function NewInvoicePage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
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

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: business } = await supabase
      .from('businesses')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (!business) {
      setError('No business found')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase
      .from('invoices')
      .insert({
        business_id: business.id,
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

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-black text-white px-4 py-10">
      <div className="max-w-xl mx-auto">

        <div className="mb-8">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">
            Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-2">New Invoice</h1>
        <p className="text-gray-400 mb-8">Create an invoice for your customer</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Customer */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold">Customer Details</h2>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Customer Name *</label>
              <input
                type="text"
                name="customer_name"
                value={form.customer_name}
                onChange={handleChange}
                required
                placeholder="e.g. Amina Bello"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Customer Phone</label>
              <input
                type="tel"
                name="customer_phone"
                value={form.customer_phone}
                onChange={handleChange}
                placeholder="e.g. 08012345678"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Due Date</label>
              <input
                type="date"
                name="due_date"
                value={form.due_date}
                onChange={handleChange}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
              />
            </div>
          </div>

          {/* Items */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold">Invoice Items</h2>

            {items.map((item, index) => (
              <div key={index} className="space-y-3 pb-4 border-b border-gray-800 last:border-0 last:pb-0">
                <div>
                  <label className="text-sm text-gray-400 mb-1 block">Item Name *</label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                    required
                    placeholder="e.g. Haircut, Web Design, Delivery"
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Quantity</label>
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value))}
                      min="1"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
                    />
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-1 block">Price (N)</label>
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => handleItemChange(index, 'price', Number(e.target.value))}
                      min="0"
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-green-400 text-sm font-medium">
                    Subtotal: N{(item.quantity * item.price).toLocaleString()}
                  </p>
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-400 text-sm hover:text-red-300 transition"
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
              className="w-full border border-dashed border-gray-700 rounded-lg py-3 text-gray-400 hover:text-white hover:border-gray-500 transition text-sm"
            >
              + Add Another Item
            </button>
          </div>

          {/* Total */}
          <div className="bg-gray-900 rounded-2xl p-6 border border-green-400/20">
            <div className="flex items-center justify-between">
              <p className="text-gray-400 font-medium">Total Amount</p>
              <p className="text-3xl font-bold text-green-400">N{total.toLocaleString()}</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-400 hover:bg-green-300 text-black font-semibold rounded-lg px-4 py-4 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {loading ? 'Creating invoice...' : 'Create Invoice'}
          </button>

        </form>
      </div>
    </div>
  )
}
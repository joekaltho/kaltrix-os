'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function NewBookingPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    customer_name: '',
    customer_phone: '',
    service: '',
    date: '',
    time: '',
    notes: '',
  })

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
      .from('bookings')
      .insert({
        business_id: business.id,
        ...form,
        status: 'pending',
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

        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard" className="text-gray-400 hover:text-white transition text-sm">
            Back to Dashboard
          </Link>
        </div>

        <h1 className="text-2xl font-bold mb-2">New Booking</h1>
        <p className="text-gray-400 mb-8">Add a new appointment or booking</p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-6 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">

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
          </div>

          <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800 space-y-4">
            <h2 className="font-semibold">Booking Details</h2>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Service *</label>
              <input
                type="text"
                name="service"
                value={form.service}
                onChange={handleChange}
                required
                placeholder="e.g. Haircut, Consultation, Delivery"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Date *</label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">Time *</label>
                <input
                  type="time"
                  name="time"
                  value={form.time}
                  onChange={handleChange}
                  required
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-400 transition"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-1 block">Notes</label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleChange}
                rows={3}
                placeholder="Any special requests or notes..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-green-400 transition resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-400 hover:bg-green-300 text-black font-semibold rounded-lg px-4 py-4 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
          >
            {loading ? 'Creating booking...' : 'Create Booking'}
          </button>

        </form>
      </div>
    </div>
  )
}
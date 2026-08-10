'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getListingLimit, type Plan } from '@/lib/check-plan'
import type { Listing } from '@/types'

const inputClass = 'w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm'
const labelClass = 'text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block'

interface ListingsPanelProps {
  businessId: string
  plan: Plan
}

export default function ListingsPanel({ businessId, plan }: ListingsPanelProps) {
  const supabase = createClient()
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Listing | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const limit = getListingLimit(plan)
  const atCap = limit !== null && listings.length >= limit

  useEffect(() => {
    const fetchListings = async () => {
      const { data } = await supabase
        .from('listings')
        .select('*')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
      setListings(data || [])
      setLoading(false)
    }
    fetchListings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, refreshTrigger])

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this listing? This cannot be undone.')) return
    await supabase.from('listings').delete().eq('id', id)
    setListings(listings.filter((l) => l.id !== id))
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <span className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2 gap-3">
        <p className="text-xs text-inkFaint font-medium">
          {limit !== null
            ? `${listings.length}/${limit} used on Free`
            : `${listings.length} listing${listings.length !== 1 ? 's' : ''}`}
        </p>
        {atCap ? (
          <Link href="/dashboard/upgrade" className="gradient-brand text-white text-sm font-black px-4 py-2 rounded-xl transition shadow-brand">
            Upgrade for more
          </Link>
        ) : (
          <Link href="/dashboard/listings/new" className="gradient-brand text-white text-sm font-black px-4 py-2 rounded-xl transition shadow-brand">
            Add Listing
          </Link>
        )}
      </div>

      {editing && (
        <EditListingModal
          listing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setRefreshTrigger((n) => n + 1) }}
        />
      )}

      {listings.length === 0 ? (
        <div className="bg-surface rounded-2xl p-16 border border-border text-center shadow-card">
          <div className="w-12 h-12 bg-ivoryDim rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-5 h-5 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <p className="text-inkFaint font-medium text-sm">No listings yet</p>
          <Link href="/dashboard/listings/new" className="text-brand text-sm mt-2 block hover:underline font-semibold">Add your first listing</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {listings.map((listing) => (
            <div key={listing.id} className="bg-surface rounded-xl border border-border shadow-card overflow-hidden">
              <div className="aspect-video bg-ivoryDim flex items-center justify-center overflow-hidden">
                {listing.image_url ? (
                  <img src={listing.image_url} alt={listing.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-inkFaint text-xs">No image</span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-black text-sm">{listing.name}</p>
                  {!listing.is_active && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-ivory border border-border text-inkFaint shrink-0">Hidden</span>
                  )}
                </div>
                {!!listing.price && <p className="text-brand font-black text-sm mt-1">₦{listing.price.toLocaleString()}</p>}
                {listing.description && <p className="text-inkFaint text-xs mt-1 line-clamp-2">{listing.description}</p>}
                <div className="flex gap-2 pt-3 mt-3 border-t border-border">
                  <button onClick={() => setEditing(listing)} className="flex-1 bg-ivory hover:bg-ivoryDim text-ink text-xs font-bold px-3 py-1.5 rounded-lg transition border border-border">Edit</button>
                  <button onClick={() => handleDelete(listing.id)} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-200">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EditListingModal({ listing, onClose, onSaved }: { listing: Listing; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: listing.name,
    price: listing.price != null ? String(listing.price) : '',
    image_url: listing.image_url ?? '',
    description: listing.description ?? '',
    is_active: listing.is_active,
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const target = e.target
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value
    setForm((prev) => ({ ...prev, [target.name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: updateError } = await supabase.from('listings').update({
      name: form.name,
      price: form.price ? parseInt(form.price, 10) : 0,
      image_url: form.image_url || null,
      description: form.description || null,
      is_active: form.is_active,
    }).eq('id', listing.id)

    if (updateError) {
      setError(`Could not save changes: ${updateError.message}`)
      setLoading(false)
      return
    }

    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-inkStatic/60 backdrop-blur-sm" />
      <div className="relative bg-surface rounded-2xl p-6 max-w-md w-full border border-border shadow-modal max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-lg">Edit Listing</h3>
          <button onClick={onClose} className="text-inkFaint hover:text-ink transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-4 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Name *</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Price (₦)</label>
            <input type="number" name="price" value={form.price} onChange={handleChange} min="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Image URL</label>
            <input type="url" name="image_url" value={form.image_url} onChange={handleChange} placeholder="https://..." className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={3} className={inputClass + ' resize-none'} />
          </div>
          <label className="flex items-center gap-2 text-sm text-inkMid font-medium">
            <input type="checkbox" name="is_active" checked={form.is_active} onChange={handleChange} className="w-4 h-4 rounded border-border accent-brand" />
            Visible on your public Shop
          </label>

          <button type="submit" disabled={loading} className="w-full gradient-brand text-white font-black py-3 rounded-xl transition shadow-brand disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : 'Save Changes'}
          </button>
        </form>
      </div>
    </div>
  )
}

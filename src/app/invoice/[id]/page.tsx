import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import CopyLinkButton from '@/components/CopyLinkButton'
import type { InvoiceItem } from '@/types'
import type { Metadata } from 'next'

export const dynamic = 'force-dynamic'

// Reachable only by whoever holds the direct link (see the note below on
// why this is a Server Component) -- never meant to be crawled or show
// up in search results.
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}

// This page is intentionally a Server Component using the service-role
// client rather than a 'use client' page reading through the anon key.
// Invoices contain customer names/phone numbers/amounts -- data that
// should never be listable by an anonymous request. RLS can restrict
// *which rows* match a filter, but it can't distinguish "I already know
// this one specific id" from "let me browse all of them" -- both are the
// same query shape to Postgres. Fetching server-side with a fixed id and
// only ever serializing the fields this page actually renders keeps that
// decision in code we control, instead of depending on an RLS policy to
// get it right for every possible query shape.
export default async function InvoiceViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, business_id, customer_name, customer_phone, items, total, status, due_date, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!invoice) notFound()

  const { data: business } = await supabase
    .from('businesses')
    .select('business_name, phone, logo_url, slug, payment_instructions')
    .eq('id', invoice.business_id)
    .maybeSingle()

  if (!business) notFound()

  const items = (invoice.items || []) as InvoiceItem[]
  const shareUrl = `https://kaltrixos.com/invoice/${invoice.id}`

  const statusStyles: Record<string, string> = {
    paid: 'bg-brandBg text-brand border-brand/20',
    overdue: 'bg-red-50 text-red-600 border-red-200',
    unpaid: 'bg-amber-50 text-amber-600 border-amber-200',
  }

  return (
    <div className="min-h-screen bg-ivory font-sans">
      <nav className="border-b border-border bg-white/80 backdrop-blur-sm px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <Link href="/" className="text-lg sm:text-xl font-black tracking-tight">
          Kaltrix<span className="text-brand">OS</span>
        </Link>
        <CopyLinkButton url={shareUrl} label="Copy Link" copiedLabel="Copied!" />
      </nav>

      <div className="max-w-lg mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="bg-surface rounded-2xl border border-border shadow-lift p-5 sm:p-8">

          {/* Business + status */}
          <div className="flex items-start justify-between gap-3 mb-6 pb-6 border-b border-border">
            <div className="flex items-center gap-3 min-w-0">
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logo_url} alt={business.business_name} className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-border flex-shrink-0" />
              ) : (
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-brandBg flex items-center justify-center text-brand font-black flex-shrink-0">
                  {business.business_name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-black text-ink truncate">{business.business_name}</p>
                {business.slug && (
                  <Link href={`/business/${business.slug}`} className="text-brand text-xs hover:underline font-medium">
                    View business profile
                  </Link>
                )}
              </div>
            </div>
            <span className={`text-xs font-black px-3 py-1 rounded-full border flex-shrink-0 uppercase ${statusStyles[invoice.status] || statusStyles.unpaid}`}>
              {invoice.status}
            </span>
          </div>

          {/* Billed to */}
          <div className="mb-6">
            <p className="text-xs font-bold text-inkFaint uppercase tracking-wider mb-1.5">Billed To</p>
            <p className="font-bold text-ink">{invoice.customer_name}</p>
            {invoice.customer_phone && <p className="text-inkFaint text-sm">{invoice.customer_phone}</p>}
          </div>

          {/* Items */}
          <div className="bg-ivory rounded-xl p-4 border border-border mb-6">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm py-1.5 gap-3">
                <span className="text-inkMid">{item.name} × {item.quantity}</span>
                <span className="text-inkMid font-semibold flex-shrink-0">₦{(item.quantity * item.price).toLocaleString()}</span>
              </div>
            ))}
            <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
              <span className="font-black text-ink">Total</span>
              <span className="font-black text-brand text-lg">₦{invoice.total.toLocaleString()}</span>
            </div>
          </div>

          {/* Dates */}
          <div className="flex flex-wrap justify-between gap-2 text-xs text-inkFaint mb-6">
            <span>Issued {new Date(invoice.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            {invoice.due_date && (
              <span>Due {new Date(invoice.due_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            )}
          </div>

          {/* Payment instructions */}
          {invoice.status !== 'paid' && (
            <div className="bg-brandBg/40 border border-brand/20 rounded-xl p-4">
              <p className="text-xs font-black text-brand uppercase tracking-wider mb-2">How to Pay</p>
              {business.payment_instructions ? (
                <p className="text-sm text-ink whitespace-pre-line">{business.payment_instructions}</p>
              ) : (
                <p className="text-sm text-inkMid">
                  Contact {business.business_name}{business.phone ? ` at ${business.phone}` : ''} to arrange payment.
                </p>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-inkFaint text-xs mt-6">
          Powered by <Link href="/" className="text-brand font-semibold hover:underline">KaltrixOS</Link>
        </p>
      </div>
    </div>
  )
}

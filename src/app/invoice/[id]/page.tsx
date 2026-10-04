import Logo from '@/components/Logo'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckCircle2, Globe, Mail, MapPin, Phone } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/service'
import CopyLinkButton from '@/components/CopyLinkButton'
import PaymentInformation from '@/components/PaymentInformation'
import { StatusBadge, invoiceTone } from '@/components/ui/StatusBadge'
import { daysUntil, formatDate, formatNaira } from '@/lib/format'
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
//
// The same reasoning applies to the business's bank details: they live in an
// owner-only table (business_payment_details) and are only ever read here,
// server-side, for the one invoice being viewed.
export default async function InvoiceViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createServiceClient()

  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, business_id, customer_name, customer_phone, items, total, status, due_date, created_at')
    .eq('id', id)
    .maybeSingle()

  if (!invoice) notFound()

  const [{ data: business }, { data: bank }] = await Promise.all([
    supabase
      .from('businesses')
      .select('business_name, phone, email, website_url, address, logo_url, slug, payment_instructions')
      .eq('id', invoice.business_id)
      .maybeSingle(),
    // Tolerant on purpose: if this lookup fails the invoice still renders,
    // falling back to the free-text instructions / contact line.
    supabase
      .from('business_payment_details')
      .select('bank_name, account_name, account_number')
      .eq('business_id', invoice.business_id)
      .maybeSingle(),
  ])

  if (!business) notFound()

  const items = (invoice.items || []) as InvoiceItem[]
  const shareUrl = `https://kaltrixos.com/invoice/${invoice.id}`
  const isPaid = invoice.status === 'paid'
  const pastDue = !isPaid && !!invoice.due_date && daysUntil(invoice.due_date) < 0
  const website = business.website_url?.replace(/^https?:\/\//, '').replace(/\/$/, '')

  return (
    <div className="min-h-screen bg-ivory font-sans text-ink">
      <nav className="glass sticky top-0 z-10 flex items-center justify-between border-b border-border px-4 py-3 sm:px-6 print:hidden">
        <Link href="/" className="text-lg font-black tracking-tight">
          <Logo size="md" />
        </Link>
        <CopyLinkButton
          url={shareUrl}
          label="Copy link"
          copiedLabel="Copied"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-inkMid transition hover:bg-ivoryDim"
        />
      </nav>

      <main className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-10">
        <article className="rounded-xl border border-border bg-surface p-5 shadow-card sm:p-8 print:border-0 print:p-0 print:shadow-none">

          {/* Who is billing + status */}
          <header className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              {business.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={business.logo_url} alt="" className="h-11 w-11 shrink-0 rounded-lg border border-border object-cover sm:h-12 sm:w-12" />
              ) : (
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ivoryDim font-bold text-inkMid sm:h-12 sm:w-12">
                  {business.business_name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate font-semibold">{business.business_name}</p>
                {business.slug && (
                  <Link href={`/business/${business.slug}`} className="text-xs font-medium text-brandText hover:underline print:hidden">
                    View business profile
                  </Link>
                )}
              </div>
            </div>
            <StatusBadge tone={invoiceTone(invoice.status)}>{invoice.status}</StatusBadge>
          </header>

          {/* Business contact details: only what the business has provided */}
          <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 border-b border-border pb-5 text-xs text-inkMid">
            {business.phone && (
              <li className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 text-inkFaint" aria-hidden />
                <a href={`tel:${business.phone}`} className="hover:underline">{business.phone}</a>
              </li>
            )}
            {business.email && (
              <li className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 text-inkFaint" aria-hidden />
                <a href={`mailto:${business.email}`} className="hover:underline">{business.email}</a>
              </li>
            )}
            {website && (
              <li className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-inkFaint" aria-hidden />
                <a href={business.website_url} target="_blank" rel="noreferrer" className="hover:underline">{website}</a>
              </li>
            )}
            {business.address && (
              <li className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-inkFaint" aria-hidden />
                <span>{business.address}</span>
              </li>
            )}
          </ul>

          {/* Billed to + dates */}
          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-inkFaint">Billed to</p>
              <p className="mt-1 font-semibold">{invoice.customer_name}</p>
              {invoice.customer_phone && <p className="text-sm text-inkMid">{invoice.customer_phone}</p>}
            </div>
            <dl className="text-sm sm:text-right [&_dt]:text-xs">
              <div className="flex gap-2 sm:justify-end">
                <dt className="text-inkFaint">Issued</dt>
                <dd className="font-medium">{formatDate(invoice.created_at)}</dd>
              </div>
              {invoice.due_date && (
                <div className="mt-1 flex gap-2 sm:justify-end">
                  <dt className="text-inkFaint">Due</dt>
                  <dd className={`font-medium ${pastDue ? 'text-danger' : ''}`}>
                    {formatDate(invoice.due_date)}{pastDue && ' · past due'}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Items */}
          <table className="mt-6 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-inkFaint">
                <th scope="col" className="pb-2 text-left font-medium">Item</th>
                <th scope="col" className="pb-2 text-right font-medium">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  <td className="py-3 pr-3 align-top">
                    <p className="text-ink">{item.name}</p>
                    <p className="text-xs text-inkFaint">{item.quantity} × {formatNaira(item.price)}</p>
                  </td>
                  <td className="py-3 text-right align-top font-medium tabular-nums">
                    {formatNaira(item.quantity * item.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Total: the one big number on the page */}
          <div className="mt-2 flex items-baseline justify-between border-t border-ink/10 pt-4">
            <span className="text-sm font-medium text-inkMid">{isPaid ? 'Total paid' : 'Amount due'}</span>
            <span className="text-2xl font-semibold tabular-nums tracking-tight">{formatNaira(invoice.total)}</span>
          </div>

          {/* Payment: dedicated section, only while there is something to pay */}
          <div className="mt-6">
            {isPaid ? (
              <div className="flex items-center gap-2 rounded-xl border border-brand/25 bg-brandBg px-4 py-3 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4 text-brandText" aria-hidden />
                This invoice has been paid. Thank you!
              </div>
            ) : (
              <PaymentInformation
                bank={bank}
                instructions={business.payment_instructions}
                fallback={
                  <>Contact {business.business_name}{business.phone ? ` at ${business.phone}` : ''} to arrange payment.</>
                }
              />
            )}
          </div>
        </article>

        <p className="mt-6 text-center text-xs text-inkFaint print:hidden">
          Powered by <Link href="/" className="font-medium text-brandText hover:underline">KaltrixOS</Link>
        </p>
      </main>
    </div>
  )
}

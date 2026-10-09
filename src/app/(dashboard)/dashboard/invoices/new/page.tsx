'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import { InvoiceItem } from '@/types'
import PremiumGuard from '@/components/PremiumGuard'
import { useBusinessId } from '@/lib/business-context'
import FormPage, { FormActions, FormSection } from '@/components/ui/FormPage'
import { Button, ButtonLink } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import Notice from '@/components/ui/Notice'
import { formatNaira } from '@/lib/format'
import { hasBankDetails, hasPaymentInfo, type PaymentDetails } from '@/lib/payment'

type PaymentState = { loaded: boolean; bank: PaymentDetails | null }

function NewInvoiceForm() {
  const router = useRouter()
  const supabase = createClient()
  const businessId = useBusinessId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState<InvoiceItem[]>([{ name: '', quantity: 1, price: 0 }])
  const [form, setForm] = useState({ customer_name: '', customer_phone: '', due_date: '' })
  const [payment, setPayment] = useState<PaymentState>({ loaded: false, bank: null })

  // Is the business's payment info set up? Drives the one-line summary / nudge
  // above the submit bar. Never blocks creating the invoice.
  useEffect(() => {
    if (!businessId) return
    const load = async () => {
      const { data: bank } = await supabase
        .from('business_payment_details')
        .select('bank_name, account_name, account_number, payment_instructions')
        .eq('business_id', businessId)
        .maybeSingle()
      setPayment({ loaded: true, bank: bank ?? null })
    }
    load()
  }, [businessId])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleItemChange = (index: number, field: keyof InvoiceItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)))
  }

  const addItem = () => setItems((prev) => [...prev, { name: '', quantity: 1, price: 0 }])
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index))

  const total = items.reduce((sum, item) => sum + item.quantity * item.price, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!businessId) {
      setError('No business found')
      return
    }
    if (total <= 0) {
      setError('Add at least one item with a price greater than ₦0.')
      return
    }

    setLoading(true)

    // Free now (cached session read, not a network call) -- kept as the
    // same defensive "session vanished mid-form" guard the original had.
    const { data: { user } } = await getSessionUser(supabase)
    if (!user) { router.push('/login'); return }

    const { data: created, error: insertError } = await supabase
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
      .select('id')
      .single()

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
      return
    }

    // Straight back to the list with a "Copy link" prompt: the next thing
    // anyone does with a new invoice is send it.
    router.push(`/dashboard?tab=invoices&created=invoice&id=${created?.id ?? ''}`)
  }

  const bank = payment.bank
  const paymentReady = hasPaymentInfo(bank)

  return (
    <FormPage
      title="New invoice"
      description="Add the customer and what you're charging. You'll get a link to send them."
      backHref="/dashboard?tab=invoices"
      backLabel="Invoices"
    >
      <form id="invoice-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <Notice kind="error" onDismiss={() => setError('')}>{error}</Notice>}

        <FormSection title="Customer">
          <TextField label="Customer name" name="customer_name" value={form.customer_name} onChange={handleChange} required placeholder="e.g. Amina Bello" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField label="Phone" optional type="tel" name="customer_phone" value={form.customer_phone} onChange={handleChange} placeholder="08012345678" />
            <TextField label="Due date" optional type="date" name="due_date" value={form.due_date} onChange={handleChange} />
          </div>
        </FormSection>

        <FormSection title="Items">
          {items.map((item, index) => (
            <div key={index} className="space-y-3 border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-inkFaint">Item {index + 1}</p>
                {items.length > 1 && (
                  <Button size="sm" variant="danger" onClick={() => removeItem(index)} aria-label={`Remove item ${index + 1}`}>
                    Remove
                  </Button>
                )}
              </div>
              <TextField
                label="Description"
                value={item.name}
                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                required
                placeholder="e.g. Haircut, Web design, Delivery"
              />
              <div className="grid grid-cols-3 gap-3">
                <TextField
                  label="Qty"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={item.quantity || ''}
                  onChange={(e) => handleItemChange(index, 'quantity', Number(e.target.value) || 0)}
                  required
                />
                <TextField
                  label="Price (₦)"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  value={item.price || ''}
                  onChange={(e) => handleItemChange(index, 'price', Number(e.target.value) || 0)}
                  placeholder="0"
                  required
                />
                <div>
                  <p className="mb-1.5 text-sm font-medium text-ink">Amount</p>
                  <p className="flex h-11 items-center text-sm font-semibold tabular-nums text-ink">
                    {formatNaira(item.quantity * item.price)}
                  </p>
                </div>
              </div>
            </div>
          ))}

          <Button variant="secondary" full onClick={addItem}>
            <Plus className="h-4 w-4" aria-hidden />
            Add another item
          </Button>
        </FormSection>

        {/* What the customer will be told about paying: one quiet line, or a nudge. */}
        {payment.loaded && (
          paymentReady ? (
            <p className="px-1 text-xs text-inkFaint">
              Payment information shown on this invoice:{' '}
              <span className="font-medium text-inkMid">
                {hasBankDetails(bank) ? `${bank.bank_name} · ${bank.account_number}` : 'your payment instructions'}
              </span>
              .{' '}
              <Link href="/dashboard/profile#payment" className="font-medium text-brandText hover:underline">Edit</Link>
            </p>
          ) : (
            <Notice
              kind="warn"
              action={<ButtonLink href="/dashboard/profile#payment" size="sm" variant="secondary">Add details</ButtonLink>}
            >
              Customers won&apos;t see how to pay you yet. Add your bank details once and they appear on every invoice.
            </Notice>
          )
        )}
      </form>

      <FormActions>
        <div className="mr-auto">
          <p className="text-xs text-inkFaint">Total</p>
          <p className="text-lg font-semibold leading-tight tabular-nums">{formatNaira(total)}</p>
        </div>
        <ButtonLink href="/dashboard?tab=invoices" variant="ghost">Cancel</ButtonLink>
        <Button type="submit" form="invoice-form" variant="primary" loading={loading}>
          {loading ? 'Creating…' : 'Create invoice'}
        </Button>
      </FormActions>
    </FormPage>
  )
}

export default function NewInvoicePage() {
  return (
    <PremiumGuard feature="invoices">
      <NewInvoiceForm />
    </PremiumGuard>
  )
}

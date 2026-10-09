'use client'

import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { CalendarDays, CheckCircle2, ChevronRight, Circle, FileText, Inbox } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Booking, Business, Customer, Invoice, Message } from '@/types'
import { hasFeature, type Plan } from '@/lib/check-plan'
import { monthlyEquivNgn } from '@/lib/plans'
import { trustScoreTone } from '@/lib/trust-score'
import { daysUntil, formatDate, formatNaira, isSameLocalDay } from '@/lib/format'
import { hasPaymentInfo, type PaymentDetails } from '@/lib/payment'
import { IMPROVE_ACTIONS } from '@/components/TrustScoreCard'
import { StatusBadge, bookingTone, type Tone } from '@/components/ui/StatusBadge'
import { ButtonLink } from '@/components/ui/Button'
import type { Tab } from './nav'

const card = 'rounded-xl border border-border bg-surface'

interface Props {
  business: Business
  plan: Plan
  bank: PaymentDetails | null
  bookings: Booking[]
  messages: Message[]
  invoices: Invoice[]
  customers: Customer[]
  onNavigate: (tab: Tab) => void
}

type Step = { key: string; label: string; done: boolean; href?: string }
type Attention = { key: string; icon: LucideIcon; text: string; tab: Tab; tone: Tone }

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
const sum = (list: Invoice[]) => list.reduce((s, i) => s + i.total, 0)

export default function OverviewPanel({ business, plan, bank, bookings, messages, invoices, customers, onNavigate }: Props) {
  const bookingsOn = hasFeature(plan, 'bookings')
  const crmOn = hasFeature(plan, 'crm')
  const invoicesOn = hasFeature(plan, 'invoices')

  // ── Setup checklist: real, computable steps only (Zeigarnik + goal gradient)
  const steps: Step[] = [
    { key: 'profile', label: 'Create your business profile', done: true },
    { key: 'branding', label: 'Add a logo and description', done: !!business.logo_url && !!business.description?.trim(), href: '/dashboard/profile' },
    { key: 'contact', label: 'Add a business email', done: !!business.email?.trim(), href: '/dashboard/profile#contact' },
    ...(invoicesOn
      ? [
          { key: 'payment', label: 'Add payment details for invoices', done: hasPaymentInfo(bank), href: '/dashboard/profile#payment' },
          { key: 'invoice', label: 'Create your first invoice', done: invoices.length > 0, href: '/dashboard/invoices/new' },
        ]
      : []),
    ...(crmOn ? [{ key: 'customer', label: 'Add your first customer', done: customers.length > 0, href: '/dashboard/customers/new' }] : []),
  ]
  const doneCount = steps.filter((s) => s.done).length
  const setupComplete = doneCount === steps.length

  // ── Needs attention
  const unread = messages.filter((m) => !m.is_read)
  const pendingBookings = bookings.filter((b) => b.status === 'pending')
  const isPastDue = (i: Invoice) =>
    i.status === 'overdue' || (i.status === 'unpaid' && !!i.due_date && daysUntil(i.due_date) < 0)
  const pastDue = invoices.filter(isPastDue)
  const awaiting = invoices.filter((i) => i.status === 'unpaid' && !isPastDue(i))

  const attention: Attention[] = []
  if (unread.length) attention.push({ key: 'unread', icon: Inbox, text: `${plural(unread.length, 'unread message')}`, tab: 'inbox', tone: 'warn' })
  if (pendingBookings.length) attention.push({ key: 'pending', icon: CalendarDays, text: `${plural(pendingBookings.length, 'booking')} waiting for your confirmation`, tab: 'bookings', tone: 'warn' })
  if (pastDue.length) attention.push({ key: 'pastdue', icon: FileText, text: `${plural(pastDue.length, 'invoice')} past due · ${formatNaira(sum(pastDue))}`, tab: 'invoices', tone: 'danger' })
  if (awaiting.length) attention.push({ key: 'awaiting', icon: FileText, text: `${plural(awaiting.length, 'invoice')} awaiting payment · ${formatNaira(sum(awaiting))}`, tab: 'invoices', tone: 'neutral' })

  // ── Numbers
  const paid = invoices.filter((i) => i.status === 'paid')
  const todayBookings = bookings.filter((b) => b.booking_date_time && isSameLocalDay(b.booking_date_time))
  const kpis = [
    ...(invoicesOn ? [
      { label: 'Collected', value: formatNaira(sum(paid)), sub: `${plural(paid.length, 'paid invoice')}`, tab: 'invoices' as Tab },
      { label: 'Outstanding', value: formatNaira(sum(pastDue) + sum(awaiting)), sub: `${plural(pastDue.length + awaiting.length, 'unpaid invoice')}`, tab: 'invoices' as Tab },
    ] : []),
    ...(bookingsOn ? [{ label: "Today's bookings", value: String(todayBookings.length), sub: 'appointments', tab: 'bookings' as Tab }] : []),
  ]

  const incompleteSignals = (business.trust_signals ?? []).filter((s) => s.status !== 'complete' && IMPROVE_ACTIONS[s.key])
  const tone = trustScoreTone(business.trust_score)
  const toneText = { high: 'text-brandText', medium: 'text-warn', low: 'text-danger' }[tone]
  const toneLabel = { high: 'Strong', medium: 'Fair', low: 'Building' }[tone]

  const attentionTone: Record<Tone, string> = {
    warn: 'bg-warnBg text-warn',
    danger: 'bg-dangerBg text-danger',
    neutral: 'bg-ivoryDim text-inkMid',
    success: 'bg-brandBg text-brandText',
    info: 'bg-infoBg text-info',
  }

  // A single paid invoice draws as one lonely dot, so wait for at least two points.
  const showChart = hasFeature(plan, 'analytics') && paid.length > 1

  return (
    <div className="space-y-6">
      {/* 1. Unfinished setup, visible with progress, until it's done */}
      {!setupComplete && (
        <section className={`${card} p-5`} aria-labelledby="setup-title">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="setup-title" className="text-sm font-semibold">Finish setting up</h2>
            <p className="text-xs text-inkFaint">{doneCount} of {steps.length} done</p>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={doneCount}
            aria-label="Setup progress"
            className="mt-3 h-1.5 overflow-hidden rounded-full bg-ivoryDeep"
          >
            <div className="h-full rounded-full bg-brandDim transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-3 divide-y divide-border">
            {steps.map((step) => (
              <li key={step.key}>
                {step.done || !step.href ? (
                  <div className="flex items-center gap-3 py-2.5 text-sm text-inkFaint">
                    <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-brandDim" aria-hidden />
                    <span className="line-through decoration-inkFaint/40">{step.label}</span>
                  </div>
                ) : (
                  <Link href={step.href} className="group flex items-center gap-3 py-2.5 text-sm font-medium text-ink">
                    <Circle className="h-[18px] w-[18px] shrink-0 text-inkFaint" aria-hidden />
                    <span className="flex-1 group-hover:text-brandText">{step.label}</span>
                    <ChevronRight className="h-4 w-4 text-inkFaint group-hover:text-brandText" aria-hidden />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2. What needs a reply or a decision today */}
      <section className={card} aria-labelledby="attention-title">
        <h2 id="attention-title" className="border-b border-border px-5 py-3 text-sm font-semibold">Needs attention</h2>
        {attention.length === 0 ? (
          <div className="flex items-center gap-3 px-5 py-5 text-sm text-inkMid">
            <CheckCircle2 className="h-5 w-5 text-brandDim" aria-hidden />
            You&apos;re all caught up.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {attention.map(({ key, icon: Icon, text, tab, tone: t }) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => onNavigate(tab)}
                  className="group flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition-colors hover:bg-ivoryDim"
                >
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${attentionTone[t]}`}>
                    <Icon className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="flex-1 font-medium">{text}</span>
                  <ChevronRight className="h-4 w-4 text-inkFaint group-hover:text-ink" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 3. The numbers (only for features the plan includes) */}
      {kpis.length > 0 ? (
        <div className={`grid grid-cols-2 gap-3 ${kpis.length === 3 ? 'sm:grid-cols-3' : ''}`}>
          {kpis.map((kpi, idx) => (
            <button
              key={kpi.label}
              type="button"
              onClick={() => onNavigate(kpi.tab)}
              className={`${card} p-4 text-left transition-colors hover:border-inkFaint ${
                kpis.length === 3 && idx === 2 ? 'col-span-2 sm:col-span-1' : ''
              }`}
            >
              <p className="text-xs font-medium text-inkFaint">{kpi.label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{kpi.value}</p>
              <p className="mt-0.5 text-xs text-inkFaint">{kpi.sub}</p>
            </button>
          ))}
        </div>
      ) : (
        // Free plan: one calm upgrade card instead of "—  Upgrade to unlock" on every tile
        <section className={`${card} flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h2 className="text-sm font-semibold">Bookings, customers and invoices</h2>
            <p className="mt-0.5 text-sm text-inkFaint">
              Included from {formatNaira(monthlyEquivNgn('growth', 'annual'))}/month on an annual plan.
            </p>
          </div>
          <ButtonLink href="/dashboard/upgrade" variant="secondary" className="shrink-0">See plans</ButtonLink>
        </section>
      )}

      {/* 4. Trust + today */}
      <div className={`grid gap-4 ${bookingsOn ? 'md:grid-cols-2' : ''}`}>
        <section className={`${card} p-5`} aria-labelledby="trust-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="trust-title" className="text-sm font-semibold">TrustScore</h2>
              <p className={`mt-1 text-xs font-medium ${toneText}`}>{toneLabel}{business.is_verified ? ' · Verified' : ''}</p>
            </div>
            <p className="text-3xl font-semibold tabular-nums tracking-tight">
              {business.trust_score}<span className="text-sm font-normal text-inkFaint">/100</span>
            </p>
          </div>
          {incompleteSignals.length > 0 && (
            <>
              <p className="mt-4 text-xs font-medium text-inkFaint">Next steps</p>
              <ul className="mt-1.5 space-y-1.5 text-sm text-inkMid">
                {incompleteSignals.slice(0, 3).map((s) => (
                  <li key={s.key} className="flex items-start gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-inkFaint" />
                    {IMPROVE_ACTIONS[s.key]}
                  </li>
                ))}
              </ul>
            </>
          )}
          <Link href="/dashboard/profile" className="mt-4 inline-block text-sm font-medium text-brandText hover:underline">
            See breakdown
          </Link>
        </section>

        {bookingsOn && (
          <section className={`${card} p-5`} aria-labelledby="today-title">
            <div className="flex items-baseline justify-between">
              <h2 id="today-title" className="text-sm font-semibold">Today</h2>
              <button type="button" onClick={() => onNavigate('bookings')} className="text-xs font-medium text-brandText hover:underline">
                All bookings
              </button>
            </div>
            {todayBookings.length === 0 ? (
              <p className="py-6 text-center text-sm text-inkFaint">No bookings today.</p>
            ) : (
              <ul className="mt-2 divide-y divide-border">
                {todayBookings.slice(0, 4).map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{b.customer_name ?? '—'}</p>
                      <p className="truncate text-xs text-inkFaint">
                        {b.booking_date_time ? new Date(b.booking_date_time).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' }) : ''}
                        {b.service_description ? ` · ${b.service_description}` : ''}
                      </p>
                    </div>
                    <StatusBadge tone={bookingTone(b.status)}>{b.status}</StatusBadge>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      {/* 5. Trend, last: useful context, not the first thing you need */}
      {showChart && (
        <section className={`${card} p-5`} aria-labelledby="revenue-title">
          <h2 id="revenue-title" className="mb-4 text-sm font-semibold">Revenue from paid invoices</h2>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={paid.map((i) => ({ date: formatDate(i.created_at).replace(/ \d{4}$/, ''), revenue: i.total }))}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" stroke="var(--color-border)" tick={{ fill: 'var(--color-inkFaint)', fontSize: 11 }} />
              <YAxis stroke="var(--color-border)" tick={{ fill: 'var(--color-inkFaint)', fontSize: 11 }} tickFormatter={(v: number) => (v >= 1000 ? `${v / 1000}k` : String(v))} />
              <Tooltip
                formatter={(v) => [formatNaira(Number(v)), 'Revenue']}
                contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-ink)' }}
                labelStyle={{ color: 'var(--color-inkMid)', fontSize: 11 }}
                itemStyle={{ color: 'var(--color-brandText)', fontSize: 11 }}
              />
              <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#rev)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}
    </div>
  )
}

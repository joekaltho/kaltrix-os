'use client'

export const dynamic = 'force-dynamic'

import Logo from '@/components/Logo'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { createClient, getSessionUser } from '@/lib/supabase/client'
import { Business, Booking, Message, Invoice, Customer } from '@/types'
import { getSubscriptionState, hasFeature, Plan, SubscriptionState } from '@/lib/check-plan'
import { hasPaymentInfo, type BankFields } from '@/lib/payment'
import { siteOrigin } from '@/lib/format'
import ListingsPanel from '@/components/ListingsPanel'
import BusinessPulsePanel from '@/components/BusinessPulsePanel'
import CopyLinkButton from '@/components/CopyLinkButton'
import ThemeToggle from '@/components/ThemeToggle'
import PageHeader from '@/components/ui/PageHeader'
import Notice from '@/components/ui/Notice'
import { Button, ButtonLink } from '@/components/ui/Button'
import { MobileBottomNav, MobileDrawer, Sidebar } from '@/components/dashboard/Sidebar'
import OverviewPanel from '@/components/dashboard/OverviewPanel'
import InboxPanel from '@/components/dashboard/InboxPanel'
import BookingsPanel from '@/components/dashboard/BookingsPanel'
import CustomersPanel from '@/components/dashboard/CustomersPanel'
import InvoicesPanel from '@/components/dashboard/InvoicesPanel'
import { NAV_BASE, isTab, tabHref, type NavItem, type Tab } from '@/components/dashboard/nav'

type NoticeState = { kind: 'success' | 'error' | 'warn'; text: string; invoiceId?: string } | null

const createdMessages: Record<string, string> = {
  invoice: 'Invoice created.',
  booking: 'Booking created.',
  customer: 'Customer added.',
  business: 'Your business profile is live. Finish setting up below.',
}

function Loading() {
  return (
    <div className="min-h-screen bg-ivory flex items-center justify-center font-sans">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-inkFaint text-sm">Loading KaltrixOS...</p>
      </div>
    </div>
  )
}

function Dashboard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [business, setBusiness] = useState<Business | null>(null)
  const [bank, setBank] = useState<BankFields | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  // One-time redirect params: ?upgraded=true (Paystack) and ?created=<thing>
  // (from the new-invoice/booking/customer/business forms). Read once into
  // state on first render, then stripped from the URL below so a refresh
  // doesn't repeat the message.
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(() => searchParams.get('upgraded') === 'true')
  const [notice, setNotice] = useState<NoticeState>(() => {
    const created = searchParams.get('created')
    if (!created || !createdMessages[created]) return null
    if (created === 'business' && searchParams.get('logo') === 'failed') {
      return { kind: 'warn', text: "Your business profile is live, but the logo couldn't be uploaded. You can add it in Business settings." }
    }
    return { kind: 'success', text: createdMessages[created], invoiceId: created === 'invoice' ? searchParams.get('id') || undefined : undefined }
  })
  const [userName, setUserName] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [plan, setPlan] = useState<Plan>('free')
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const tabParam = searchParams.get('tab')
  const requestedTab: Tab = isTab(tabParam) ? tabParam : 'overview'

  useEffect(() => {
    // Perf note (Sep 2026 platform-wide performance audit): this used to be
    // 8 fully sequential round trips (session -> profile -> business ->
    // subscription -> bookings -> customers -> invoices -> messages), each
    // waiting on the last even though most don't depend on each other. That
    // chain is the main reason dashboard load (and anything that redirects
    // here, like login) felt slow. Same data, same gating logic, same
    // fallback behavior -- just batched into parallel waves where the data
    // actually has no dependency on the previous step.
    const fetchData = async () => {
      setLoadError('')
      try {
        const { data: { user } } = await getSessionUser(supabase)
        if (!user) { router.push('/login'); return }

        // profile and business both only depend on user.id, not on each other.
        const [{ data: profile }, { data: businessData }] = await Promise.all([
          supabase.from('profiles').select('name, role').eq('id', user.id).single(),
          supabase.from('businesses').select('*').eq('user_id', user.id).single(),
        ])

        if (profile) {
          setUserName(profile.name)
          if (profile.role === 'admin') { router.push('/admin'); return }
        }

        if (businessData) {
          setBusiness(businessData)

          // messages have no plan gating, so they can load alongside the
          // subscription lookup instead of waiting on it. Payment details
          // (owner-only table) ride along; a failed lookup just means "not set".
          const [subState, { data: messagesData }, { data: bankData }] = await Promise.all([
            getSubscriptionState(businessData.id),
            supabase.from('messages').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false }),
            supabase.from('business_payment_details').select('bank_name, account_name, account_number').eq('business_id', businessData.id).maybeSingle(),
          ])
          setSubscription(subState)
          setPlan(subState.plan)
          setMessages(messagesData || [])
          setBank(bankData ?? null)

          // bookings/customers/invoices only need to know the plan (for
          // gating) -- once we have it, none of the three depend on each
          // other, so fetch whichever are enabled together.
          const [bookingsRes, customersRes, invoicesRes] = await Promise.all([
            hasFeature(subState.plan, 'bookings')
              ? supabase.from('bookings').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false })
              : Promise.resolve({ data: null }),
            hasFeature(subState.plan, 'crm')
              ? supabase.from('customers').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false })
              : Promise.resolve({ data: null }),
            hasFeature(subState.plan, 'invoices')
              ? supabase.from('invoices').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false })
              : Promise.resolve({ data: null }),
          ])
          if (hasFeature(subState.plan, 'bookings')) setBookings(bookingsRes.data || [])
          if (hasFeature(subState.plan, 'crm')) setCustomers(customersRes.data || [])
          if (hasFeature(subState.plan, 'invoices')) setInvoices(invoicesRes.data || [])
        }
      } catch {
        // A thrown network/fetch failure used to leave `loading` stuck at
        // true forever -- an infinite spinner with no explanation and no
        // way forward. Real risk given the latency/reliability profile
        // this app runs under (see the P0 performance work). Surface it
        // instead, with a retry.
        setLoadError('Could not load your dashboard. Check your connection and try again.')
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const keys = ['created', 'id', 'logo', 'upgraded']
    if (!keys.some((k) => params.has(k))) return
    keys.forEach((k) => params.delete(k))
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `${window.location.pathname}?${qs}` : window.location.pathname)
  }, [])

  // Success messages fade on their own; errors stay until dismissed.
  useEffect(() => {
    if (notice?.kind !== 'success') return
    const t = setTimeout(() => setNotice(null), 12000)
    return () => clearTimeout(t)
  }, [notice])

  const selectTab = useCallback((next: Tab) => {
    window.history.pushState(null, '', tabHref(next))
    window.scrollTo({ top: 0 })
    setDrawerOpen(false)
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  // Optimistic updates that roll back (and say so) if the write fails. They
  // used to update the screen unconditionally, so a rejected write looked like
  // it had worked until the next refresh.
  const updateBookingStatus = async (id: string, status: Booking['status']) => {
    const previous = bookings
    setBookings((bs) => bs.map((b) => (b.id === id ? { ...b, status } : b)))
    const { error } = await supabase.from('bookings').update({ status }).eq('id', id)
    if (error) {
      setBookings(previous)
      setNotice({ kind: 'error', text: `Couldn't update the booking: ${error.message}` })
    }
  }

  const updateInvoiceStatus = async (id: string, status: Invoice['status']) => {
    const previous = invoices
    setInvoices((is) => is.map((i) => (i.id === id ? { ...i, status } : i)))
    const { error } = await supabase.from('invoices').update({ status }).eq('id', id)
    if (error) {
      setInvoices(previous)
      setNotice({ kind: 'error', text: `Couldn't update the invoice: ${error.message}` })
    }
  }

  const markMessageRead = async (id: string) => {
    const previous = messages
    setMessages((ms) => ms.map((m) => (m.id === id ? { ...m, is_read: true } : m)))
    const { error } = await supabase.from('messages').update({ is_read: true }).eq('id', id)
    if (error) {
      setMessages(previous)
      setNotice({ kind: 'error', text: `Couldn't mark the message as read: ${error.message}` })
    }
  }

  const unreadMessages = messages.filter((m) => !m.is_read)
  const unpaidInvoices = invoices.filter((i) => i.status === 'unpaid')

  const navItems: NavItem[] = NAV_BASE.filter(
    (item) =>
      item.id === 'overview' || item.id === 'inbox' || item.id === 'listings' || item.id === 'pulse' ||
      (item.id === 'bookings' && hasFeature(plan, 'bookings')) ||
      (item.id === 'customers' && hasFeature(plan, 'crm')) ||
      (item.id === 'invoices' && hasFeature(plan, 'invoices'))
  ).map((item) => {
    if (item.id === 'inbox') return { ...item, badge: unreadMessages.length, badgeTone: 'alert' as const }
    if (item.id === 'invoices') return { ...item, badge: unpaidInvoices.length, badgeTone: 'count' as const }
    return item
  })

  // A tab the plan doesn't include (e.g. a bookmarked ?tab=invoices on Free) falls back to Overview.
  const activeTab: Tab = navItems.some((i) => i.id === requestedTab) ? requestedTab : 'overview'

  if (loading) return <Loading />

  if (loadError) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center font-sans px-4">
        <div className="text-center max-w-sm">
          <p className="text-ink font-semibold mb-1">Something went wrong</p>
          <p className="text-inkFaint text-sm mb-6">{loadError}</p>
          <Button variant="primary" onClick={() => window.location.reload()}>Try again</Button>
        </div>
      </div>
    )
  }

  const sidebar = (
    <Sidebar
      business={business}
      userName={userName}
      plan={plan}
      subscription={subscription}
      activeTab={activeTab}
      navItems={navItems}
      onSelect={selectTab}
      onSignOut={handleSignOut}
    />
  )

  const firstName = userName.split(' ')[0]
  const headers: Record<Tab, { title: string; description: string; action?: React.ReactNode }> = {
    overview: {
      title: 'Overview',
      description: firstName ? `Welcome back, ${firstName}` : 'Welcome back',
      action: hasFeature(plan, 'invoices')
        ? <ButtonLink href="/dashboard/invoices/new" variant="primary">New invoice</ButtonLink>
        : business?.slug
          ? <ButtonLink href={`/business/${business.slug}`} target="_blank" variant="secondary">View public page</ButtonLink>
          : undefined,
    },
    inbox: { title: 'Inbox', description: `${unreadMessages.length} unread message${unreadMessages.length !== 1 ? 's' : ''}` },
    bookings: {
      title: 'Bookings',
      description: `${bookings.length} total booking${bookings.length !== 1 ? 's' : ''}`,
      action: <ButtonLink href="/dashboard/bookings/new" variant="primary">New booking</ButtonLink>,
    },
    customers: {
      title: 'Customers',
      description: `${customers.length} customer${customers.length !== 1 ? 's' : ''} in CRM`,
      action: <ButtonLink href="/dashboard/customers/new" variant="primary">Add customer</ButtonLink>,
    },
    invoices: {
      title: 'Invoices',
      description: `${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length !== 1 ? 's' : ''}`,
      action: <ButtonLink href="/dashboard/invoices/new" variant="primary">New invoice</ButtonLink>,
    },
    listings: { title: 'Listings', description: 'Manage what shows in your public Shop' },
    pulse: { title: 'Business Pulse', description: 'How your business is doing right now' },
  }
  const header = headers[activeTab]

  return (
    <div className="min-h-screen bg-ivory text-ink font-sans flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface border-r border-border h-screen sticky top-0 overflow-hidden">
        {sidebar}
      </aside>

      <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>{sidebar}</MobileDrawer>

      <div className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* Mobile top bar: brand + plan only; navigation lives in the bottom bar */}
        <header className="md:hidden sticky top-0 z-30 glass border-b border-border px-4 h-12 flex items-center justify-between">
          <Logo size="sm" />
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium capitalize text-inkFaint">
              {plan} plan{subscription?.isTrialing ? ` · ${subscription.trialDaysLeft}d left` : ''}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-28 md:pb-8 max-w-4xl w-full mx-auto">

          <div className="space-y-3 empty:hidden mb-6">
            {showUpgradeSuccess && (
              <Notice kind="success" onDismiss={() => setShowUpgradeSuccess(false)}>
                Plan upgraded — welcome to <span className="capitalize">{plan}</span>.
              </Notice>
            )}
            {notice && (
              <Notice
                kind={notice.kind}
                onDismiss={() => setNotice(null)}
                action={
                  notice.invoiceId ? (
                    <CopyLinkButton
                      url={`${siteOrigin()}/invoice/${notice.invoiceId}`}
                      label="Copy invoice link"
                      copiedLabel="Link copied"
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-xs font-semibold text-ink hover:bg-ivoryDim"
                    />
                  ) : undefined
                }
              >
                {notice.text}
              </Notice>
            )}
          </div>

          {!business ? (
            <div className="text-center py-20">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-brandBg text-brandText">
                <Building2 className="h-6 w-6" aria-hidden />
              </div>
              <h1 className="text-xl font-semibold mb-1.5">Set up your business</h1>
              <p className="text-inkFaint mb-6 text-sm">Create your profile to get discovered and start managing your operations.</p>
              <Link
                href="/dashboard/create-business"
                className="inline-flex h-11 items-center rounded-lg bg-brandDim px-6 text-sm font-semibold text-white transition-colors hover:bg-[#15803d]"
              >
                Create business profile
              </Link>
            </div>
          ) : (
            <>
              <PageHeader title={header.title} description={header.description} action={header.action} />

              {activeTab === 'overview' && (
                <OverviewPanel
                  business={business}
                  plan={plan}
                  bank={bank}
                  bookings={bookings}
                  messages={messages}
                  invoices={invoices}
                  customers={customers}
                  onNavigate={selectTab}
                />
              )}

              {activeTab === 'inbox' && <InboxPanel messages={messages} onMarkRead={markMessageRead} />}
              {activeTab === 'bookings' && <BookingsPanel bookings={bookings} onStatus={updateBookingStatus} />}
              {activeTab === 'customers' && <CustomersPanel customers={customers} />}
              {activeTab === 'invoices' && (
                <InvoicesPanel
                  invoices={invoices}
                  paymentReady={hasPaymentInfo(bank, business.payment_instructions)}
                  onStatus={updateInvoiceStatus}
                />
              )}
              {activeTab === 'listings' && <ListingsPanel businessId={business.id} plan={plan} />}

              {activeTab === 'pulse' && (
                hasFeature(plan, 'analytics') ? (
                  <BusinessPulsePanel businessId={business.id} />
                ) : (
                  <div className="rounded-xl border border-border bg-surface px-6 py-12 text-center">
                    <p className="font-semibold mb-1">Business Pulse is a Pro feature</p>
                    <p className="text-inkFaint text-sm max-w-sm mx-auto mb-6">
                      See revenue, profit, growth, and a Business Health Score built from your real activity — updated every time you open it.
                    </p>
                    <ButtonLink href="/dashboard/upgrade" variant="primary">Upgrade to Pro</ButtonLink>
                  </div>
                )
              )}
            </>
          )}
        </main>
      </div>

      <MobileBottomNav navItems={navItems} activeTab={activeTab} onSelect={selectTab} onMore={() => setDrawerOpen(true)} />
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  )
}

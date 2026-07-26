'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState, type ReactElement } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Business, Booking, Message, Invoice, Customer } from '@/types'
import { getCurrentPlan, hasFeature, Plan } from '@/lib/check-plan'

type Tab = 'overview' | 'inbox' | 'bookings' | 'customers' | 'invoices'

function NavIcon({ type }: { type: string }) {
  const icons: Record<string, ReactElement> = {
    overview: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />,
    inbox: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
    bookings: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
    customers: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
    invoices: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
    profile: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    upgrade: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 10V3L4 14h7v7l9-11h-7z" />,
    discover: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />,
    signout: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />,
    pay: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />,
    ai: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />,
  }
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      {icons[type]}
    </svg>
  )
}

interface SidebarProps {
  business: Business | null
  userName: string
  plan: Plan
  activeTab: Tab
  navItems: { id: string; label: string; icon: string; badge?: number }[]
  onTabChange: (tab: Tab) => void
  onSignOut: () => void
}

function Sidebar({ business, userName, plan, activeTab, navItems, onTabChange, onSignOut }: SidebarProps) {
  return (
    <div className="flex flex-col h-full w-full">
      {/* Logo */}
      <div className="px-5 py-4 border-b border-border shrink-0">
        <span className="text-base font-black tracking-tight text-ink">Kaltrix<span className="text-brand">OS</span></span>
      </div>

      {/* Business card */}
      {business && (
        <div className="px-4 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-ivoryDim border border-border flex items-center justify-center text-xs font-black text-inkMid overflow-hidden shrink-0">
              {business.logo_url
                ? <img src={business.logo_url} alt="" className="w-full h-full object-cover" />
                : business.business_name.charAt(0).toUpperCase()
              }
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black text-ink truncate">{business.business_name}</p>
              <p className="text-xs text-inkFaint truncate">{business.industry}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-brand font-black text-sm">{business.trust_score}</span>
              <span className="text-inkFaint text-xs">TrustScore</span>
            </div>
            {business.is_verified
              ? <span className="text-xs text-brand font-bold bg-brandBg border border-brand/20 px-2 py-0.5 rounded-full">Verified</span>
              : <span className="text-xs text-amber-600 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Unverified</span>
            }
          </div>
        </div>
      )}

      {/* Nav links */}
      <div className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-xs font-bold text-inkFaint uppercase tracking-widest px-2 mb-2">Menu</p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onTabChange(item.id as Tab)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition text-left ${
              activeTab === item.id
                ? 'bg-brandBg text-brand'
                : 'text-inkMid hover:bg-ivoryDim hover:text-ink'
            }`}
          >
            <NavIcon type={item.icon} />
            {item.label}
            {(item.badge ?? 0) > 0 && (
              <span className={`ml-auto text-xs font-black w-5 h-5 flex items-center justify-center rounded-full shrink-0 ${
                item.id === 'inbox' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
              }`}>{item.badge}</span>
            )}
          </button>
        ))}

        <div className="pt-3 mt-3 border-t border-border space-y-0.5">
          <p className="text-xs font-bold text-inkFaint uppercase tracking-widest px-2 mb-2">Account</p>
          <Link href="/dashboard/profile" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-inkMid hover:bg-ivoryDim hover:text-ink transition">
            <NavIcon type="profile" />
            Edit Profile
          </Link>
          {business?.slug && (
            <Link href={`/business/${business.slug}`} target="_blank" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-inkMid hover:bg-ivoryDim hover:text-ink transition">
              <NavIcon type="discover" />
              View Public Page
              <svg className="w-3 h-3 ml-auto text-inkFaint shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </Link>
          )}
          {plan === 'free' && (
            <Link href="/dashboard/upgrade" className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-black text-brand bg-brandBg border border-brand/20 hover:bg-brandMid transition">
              <NavIcon type="upgrade" />
              Upgrade Plan
            </Link>
          )}

          {/* Coming Soon Section */}
          <div className="pt-3 mt-3 border-t border-border space-y-0.5">
            <p className="text-xs font-bold text-inkFaint uppercase tracking-widest px-2 mb-2">Coming Soon</p>
            
            {/* KaltrixPay */}
            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-inkFaint cursor-not-allowed">
              <NavIcon type="pay" />
              <span className="flex-1">KaltrixPay</span>
              <span className="text-xs font-bold text-brand bg-brandBg border border-brand/20 px-2 py-0.5 rounded-full shrink-0">Soon</span>
            </div>

            {/* Velocity AI */}
            <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-inkFaint cursor-not-allowed">
              <NavIcon type="ai" />
              <span className="flex-1">Velocity AI</span>
              <span className="text-xs font-bold text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full shrink-0">Soon</span>
            </div>
          </div>
        </div>
      </div>

      {/* User footer */}
      <div className="px-4 py-3 border-t border-border shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-ink">{userName}</p>
            <span className={`text-xs font-bold capitalize ${
              plan === 'free' ? 'text-inkFaint' :
              plan === 'growth' ? 'text-brand' : 'text-ink'
            }`}>{plan} plan</span>
          </div>
          <button onClick={onSignOut} className="flex items-center gap-1.5 text-xs text-inkFaint hover:text-red-500 transition" title="Sign out">
            <NavIcon type="signout" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [plan, setPlan] = useState<Plan>('free')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('name, role').eq('id', user.id).single()
      if (profile) {
        setUserName(profile.name)
        if (profile.role === 'admin') { router.push('/admin'); return }
      }

      const { data: businessData } = await supabase.from('businesses').select('*').eq('user_id', user.id).single()
      if (businessData) {
        setBusiness(businessData)
        const currentPlan = await getCurrentPlan()
        setPlan(currentPlan)

        if (hasFeature(currentPlan, 'bookings')) {
          const { data } = await supabase.from('bookings').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false })
          setBookings(data || [])
        }
        if (hasFeature(currentPlan, 'crm')) {
          const { data } = await supabase.from('customers').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false })
          setCustomers(data || [])
        }
        if (hasFeature(currentPlan, 'invoices')) {
          const { data } = await supabase.from('invoices').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false })
          setInvoices(data || [])
        }
        const { data: messagesData } = await supabase.from('messages').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false })
        setMessages(messagesData || [])
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const updateBookingStatus = async (id: string, status: Booking['status']) => {
    await supabase.from('bookings').update({ status }).eq('id', id)
    setBookings(bookings.map(b => b.id === id ? { ...b, status } : b))
  }

  const updateInvoiceStatus = async (id: string, status: Invoice['status']) => {
    await supabase.from('invoices').update({ status }).eq('id', id)
    setInvoices(invoices.map(i => i.id === id ? { ...i, status } : i))
  }

  const markMessageRead = async (id: string) => {
    await supabase.from('messages').update({ is_read: true }).eq('id', id)
    setMessages(messages.map(m => m.id === id ? { ...m, is_read: true } : m))
  }

  const todayBookings = bookings.filter(b => b.booking_date_time?.startsWith(new Date().toISOString().split('T')[0]))
  const unreadMessages = messages.filter(m => !m.is_read)
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid')
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'overview', always: true },
    { id: 'inbox', label: 'Inbox', icon: 'inbox', always: true, badge: unreadMessages.length },
    { id: 'bookings', label: 'Bookings', icon: 'bookings', requires: 'bookings' as const },
    { id: 'customers', label: 'Customers', icon: 'customers', requires: 'crm' as const },
    { id: 'invoices', label: 'Invoices', icon: 'invoices', requires: 'invoices' as const, badge: unpaidInvoices.length },
  ].filter(item => item.always || (item.requires && hasFeature(plan, item.requires)))

  if (loading) {
    return (
      <div className="min-h-screen bg-ivory flex items-center justify-center font-sans">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-inkFaint text-sm">Loading KaltrixOS...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-ivory text-ink font-sans flex">

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 bg-surface border-r border-border h-screen sticky top-0 overflow-hidden">
        <Sidebar
          business={business}
          userName={userName}
          plan={plan}
          activeTab={activeTab}
          navItems={navItems}
          onTabChange={(tab) => setActiveTab(tab)}
          onSignOut={handleSignOut}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-surface flex flex-col shadow-modal">
            <Sidebar
              business={business}
              userName={userName}
              plan={plan}
              activeTab={activeTab}
              navItems={navItems}
              onTabChange={(tab) => { setActiveTab(tab); setSidebarOpen(false) }}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* Mobile topbar */}
        <header className="md:hidden sticky top-0 z-30 glass border-b border-border shadow-card px-4 h-14 flex items-center justify-between">
          <button onClick={() => setSidebarOpen(true)} className="flex items-center gap-2 text-ink">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-base font-black">Kaltrix<span className="text-brand">OS</span></span>
          </button>
          <div className="flex items-center gap-2">
            {unreadMessages.length > 0 && (
              <button onClick={() => setActiveTab('inbox')} className="flex items-center gap-1 text-xs text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {unreadMessages.length}
              </button>
            )}
            <span className={`text-xs font-black px-2.5 py-1 rounded-full capitalize border ${
              plan === 'free' ? 'bg-ivory text-inkFaint border-border' :
              plan === 'growth' ? 'bg-brandBg text-brand border-brand/20' :
              'bg-ink text-ivory border-ink'
            }`}>{plan}</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8 max-w-4xl w-full mx-auto">

          {/* No business state */}
          {!business ? (
            <div className="text-center py-24">
              <div className="w-16 h-16 bg-brandBg border border-brand/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <h2 className="text-2xl font-black mb-2">No business profile yet</h2>
              <p className="text-inkFaint mb-8 text-sm">Create your profile to start getting discovered and managing operations.</p>
              <Link href="/dashboard/create-business" className="inline-flex items-center gap-2 gradient-brand text-white font-black px-8 py-4 rounded-xl transition shadow-brand text-sm">
                Create Business Profile
              </Link>
            </div>
          ) : (
            <>
              {/* Page title */}
              <div className="mb-6">
                <h1 className="text-xl font-black capitalize">{activeTab}</h1>
                <p className="text-inkFaint text-sm mt-0.5">
                  {activeTab === 'overview' && `Welcome back, ${userName.split(' ')[0]}`}
                  {activeTab === 'inbox' && `${unreadMessages.length} unread message${unreadMessages.length !== 1 ? 's' : ''}`}
                  {activeTab === 'bookings' && `${bookings.length} total booking${bookings.length !== 1 ? 's' : ''}`}
                  {activeTab === 'customers' && `${customers.length} customer${customers.length !== 1 ? 's' : ''} in CRM`}
                  {activeTab === 'invoices' && `${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length !== 1 ? 's' : ''}`}
                </p>
              </div>

              {/* OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Stats */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Today's Bookings", value: todayBookings.length, color: 'text-brand', sub: 'appointments', tab: 'bookings' as Tab, locked: !hasFeature(plan, 'bookings') },
                      { label: 'Unread Messages', value: unreadMessages.length, color: 'text-amber-600', sub: 'messages', tab: 'inbox' as Tab, locked: false },
                      { label: 'Unpaid Invoices', value: unpaidInvoices.length, color: 'text-red-500', sub: 'invoices', tab: 'invoices' as Tab, locked: !hasFeature(plan, 'invoices') },
                      { label: 'Total Revenue', value: `₦${totalRevenue.toLocaleString()}`, color: 'text-brand', sub: 'earned', tab: 'invoices' as Tab, locked: !hasFeature(plan, 'invoices') },
                    ].map((stat) => (
                      <button
                        key={stat.label}
                        onClick={() => !stat.locked && setActiveTab(stat.tab)}
                        className={`bg-surface rounded-2xl p-4 sm:p-5 border border-border shadow-card text-left transition ${!stat.locked ? 'hover:border-brand/30 hover:shadow-lift cursor-pointer' : 'cursor-default'}`}
                      >
                        <p className="text-inkFaint text-xs font-medium uppercase tracking-wider mb-3">{stat.label}</p>
                        <p className={`text-xl sm:text-2xl font-black ${stat.color}`}>{stat.locked ? '—' : stat.value}</p>
                        <p className="text-inkFaint text-xs mt-1">{stat.locked ? 'Upgrade to unlock' : stat.sub}</p>
                      </button>
                    ))}
                  </div>

                  {/* Upgrade banner for free plan */}
                  {plan === 'free' && (
                    <div className="bg-ink rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
                      <div className="absolute top-[-30%] right-[-5%] w-[40%] h-[200%] bg-brand/8 blur-3xl rounded-full pointer-events-none" />
                      <div className="relative z-10">
                        <h3 className="font-black text-white">Unlock bookings, CRM and invoices</h3>
                        <p className="text-white/50 text-sm mt-0.5">From ₦8,250/mo equivalent — less than a staff lunch.</p>
                      </div>
                      <Link href="/dashboard/upgrade" className="relative z-10 shrink-0 gradient-brand text-white font-black px-5 py-2.5 rounded-xl transition text-sm shadow-brand whitespace-nowrap">
                        Upgrade Now
                      </Link>
                    </div>
                  )}

                  {/* Analytics chart */}
                  {hasFeature(plan, 'analytics') && invoices.filter(i => i.status === 'paid').length > 0 && (
                    <div className="bg-surface rounded-2xl p-6 border border-border shadow-card">
                      <p className="text-xs font-bold text-inkFaint uppercase tracking-wider mb-5">Revenue Overview</p>
                      <ResponsiveContainer width="100%" height={160}>
                        <AreaChart data={invoices.filter(i => i.status === 'paid').map(i => ({
                          date: new Date(i.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
                          revenue: i.total,
                        }))}>
                          <defs>
                            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis dataKey="date" stroke="#e2e2db" tick={{ fill: '#8a8a8a', fontSize: 11 }} />
                          <YAxis stroke="#e2e2db" tick={{ fill: '#8a8a8a', fontSize: 11 }} />
                          <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e2db', borderRadius: '10px' }} labelStyle={{ color: '#3a3a3a', fontSize: 11 }} itemStyle={{ color: '#22c55e', fontSize: 11 }} />
                          <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#rev)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  )}

                  {/* Two column quick view */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    {/* Recent bookings */}
                    <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs font-bold text-inkFaint uppercase tracking-wider">Recent Bookings</p>
                        {hasFeature(plan, 'bookings') && (
                          <Link href="/dashboard/bookings/new" className="text-xs text-brand font-bold hover:underline">+ New</Link>
                        )}
                      </div>
                      {!hasFeature(plan, 'bookings') ? (
                        <Link href="/dashboard/upgrade" className="block text-center py-6 text-inkFaint text-xs hover:text-ink transition">
                          Upgrade to manage bookings
                        </Link>
                      ) : todayBookings.length === 0 ? (
                        <p className="text-inkFaint text-sm py-4 text-center">No bookings today</p>
                      ) : (
                        <div className="space-y-2">
                          {todayBookings.slice(0, 3).map(b => (
                            <div key={b.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                              <div>
                                <p className="text-sm font-semibold">{b.customer_name ?? '—'}</p>
                                <p className="text-xs text-inkFaint">{b.service_description ?? '—'}</p>
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                                b.status === 'confirmed' ? 'bg-brandBg text-brand border-brand/20' :
                                b.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
                                'bg-amber-50 text-amber-600 border-amber-200'
                              }`}>{b.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick actions */}
                    <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
                      <p className="text-xs font-bold text-inkFaint uppercase tracking-wider mb-4">Quick Actions</p>
                      <div className="space-y-1">
                        {[
                          { label: 'New Booking', href: '/dashboard/bookings/new', requires: 'bookings' as const },
                          { label: 'Add Customer', href: '/dashboard/customers/new', requires: 'crm' as const },
                          { label: 'New Invoice', href: '/dashboard/invoices/new', requires: 'invoices' as const },
                          { label: 'Edit Business Profile', href: '/dashboard/profile', requires: null },
                          { label: 'View Public Page', href: business.slug ? `/business/${business.slug}` : '#', requires: null, external: true },
                        ].map((action) => {
                          const locked = action.requires && !hasFeature(plan, action.requires)
                          if (locked) return null
                          return (
                            <Link
                              key={action.href}
                              href={action.href}
                              target={action.external ? '_blank' : undefined}
                              className="flex items-center justify-between w-full text-sm text-ink hover:text-brand transition py-2.5 border-b border-border last:border-0 font-medium group"
                            >
                              {action.label}
                              <svg className="w-4 h-4 text-inkFaint group-hover:text-brand transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* INBOX */}
              {activeTab === 'inbox' && (
                <div className="space-y-3">
                  {messages.length === 0 ? (
                    <div className="bg-surface rounded-2xl p-16 border border-border text-center shadow-card">
                      <div className="w-12 h-12 bg-ivoryDim rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-5 h-5 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-inkFaint font-medium text-sm">No messages yet</p>
                      <p className="text-inkFaint text-xs mt-1">Customers who find you on Discover can message you here</p>
                    </div>
                  ) : messages.map((msg) => (
                    <div
                      key={msg.id}
                      onClick={() => !msg.is_read && markMessageRead(msg.id)}
                      className={`bg-surface rounded-xl p-5 border shadow-card cursor-pointer transition ${!msg.is_read ? 'border-brand/30 bg-brandBg/20' : 'border-border hover:border-inkFaint'}`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 bg-ivoryDim rounded-full border border-border flex items-center justify-center text-xs font-black text-inkMid flex-shrink-0">
                            {msg.sender_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{msg.sender_name}</p>
                            {msg.sender_phone && <p className="text-inkFaint text-xs">{msg.sender_phone}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!msg.is_read && <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />}
                          <p className="text-inkFaint text-xs whitespace-nowrap">{new Date(msg.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="text-inkMid text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* BOOKINGS */}
              {hasFeature(plan, 'bookings') && activeTab === 'bookings' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <Link href="/dashboard/bookings/new" className="gradient-brand text-white text-sm font-black px-4 py-2 rounded-xl transition shadow-brand ml-auto">New Booking</Link>
                  </div>
                  {bookings.length === 0 ? (
                    <div className="bg-surface rounded-2xl p-16 border border-border text-center shadow-card">
                      <div className="w-12 h-12 bg-ivoryDim rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-5 h-5 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-inkFaint font-medium text-sm">No bookings yet</p>
                      <Link href="/dashboard/bookings/new" className="text-brand text-sm mt-2 block hover:underline font-semibold">Create your first booking</Link>
                    </div>
                  ) : bookings.map((booking) => (
                    <div key={booking.id} className="bg-surface rounded-xl p-5 border border-border shadow-card">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-black">{booking.customer_name ?? '—'}</p>
                          <p className="text-inkFaint text-sm">{booking.service_description ?? '—'}</p>
                          <p className="text-inkFaint text-xs mt-0.5">
                            {booking.booking_date_time ? new Date(booking.booking_date_time).toLocaleString() : '—'}
                          </p>
                          {booking.notes && <p className="text-inkFaint text-xs mt-1 italic">{booking.notes}</p>}
                        </div>
                        <span className={`text-xs font-black px-3 py-1 rounded-full border flex-shrink-0 ml-2 ${
                          booking.status === 'confirmed' ? 'bg-brandBg text-brand border-brand/20' :
                          booking.status === 'cancelled' ? 'bg-red-50 text-red-600 border-red-200' :
                          booking.status === 'completed' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                          'bg-amber-50 text-amber-600 border-amber-200'
                        }`}>{booking.status}</span>
                      </div>
                      {booking.status === 'pending' && (
                        <div className="flex gap-2 pt-3 border-t border-border">
                          <button onClick={() => updateBookingStatus(booking.id, 'confirmed')} className="gradient-brand text-white text-xs font-black px-3 py-1.5 rounded-lg transition">Confirm</button>
                          <button onClick={() => updateBookingStatus(booking.id, 'cancelled')} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-200">Cancel</button>
                        </div>
                      )}
                      {booking.status === 'confirmed' && (
                        <div className="flex gap-2 pt-3 border-t border-border">
                          <button onClick={() => updateBookingStatus(booking.id, 'completed')} className="bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-blue-200">Mark Complete</button>
                          <button onClick={() => updateBookingStatus(booking.id, 'cancelled')} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg transition border border-red-200">Cancel</button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* CUSTOMERS */}
              {hasFeature(plan, 'crm') && activeTab === 'customers' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <Link href="/dashboard/customers/new" className="gradient-brand text-white text-sm font-black px-4 py-2 rounded-xl transition shadow-brand">Add Customer</Link>
                  </div>
                  {customers.length === 0 ? (
                    <div className="bg-surface rounded-2xl p-16 border border-border text-center shadow-card">
                      <div className="w-12 h-12 bg-ivoryDim rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-5 h-5 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                      <p className="text-inkFaint font-medium text-sm">No customers yet</p>
                      <Link href="/dashboard/customers/new" className="text-brand text-sm mt-2 block hover:underline font-semibold">Add your first customer</Link>
                    </div>
                  ) : customers.map((customer) => (
                    <div key={customer.id} className="bg-surface rounded-xl p-5 border border-border shadow-card flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 bg-ivoryDim rounded-full border border-border flex items-center justify-center text-xs font-black text-inkMid">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-sm">{customer.name}</p>
                          <p className="text-inkFaint text-xs">{customer.phone}{customer.email && ` · ${customer.email}`}</p>
                        </div>
                      </div>
                      <p className="text-inkFaint text-xs">{new Date(customer.created_at).toLocaleDateString()}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* INVOICES */}
              {hasFeature(plan, 'invoices') && activeTab === 'invoices' && (
                <div className="space-y-3">
                  <div className="flex justify-end mb-2">
                    <Link href="/dashboard/invoices/new" className="gradient-brand text-white text-sm font-black px-4 py-2 rounded-xl transition shadow-brand">New Invoice</Link>
                  </div>
                  {invoices.length === 0 ? (
                    <div className="bg-surface rounded-2xl p-16 border border-border text-center shadow-card">
                      <div className="w-12 h-12 bg-ivoryDim rounded-xl flex items-center justify-center mx-auto mb-4">
                        <svg className="w-5 h-5 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p className="text-inkFaint font-medium text-sm">No invoices yet</p>
                      <Link href="/dashboard/invoices/new" className="text-brand text-sm mt-2 block hover:underline font-semibold">Create your first invoice</Link>
                    </div>
                  ) : invoices.map((invoice) => (
                    <div key={invoice.id} className="bg-surface rounded-xl p-5 border border-border shadow-card">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-black">{invoice.customer_name}</p>
                          {invoice.customer_phone && <p className="text-inkFaint text-xs mt-0.5">{invoice.customer_phone}</p>}
                          <p className="text-brand font-black text-lg mt-1">₦{invoice.total.toLocaleString()}</p>
                          <p className="text-inkFaint text-xs">{new Date(invoice.created_at).toLocaleDateString()}</p>
                          {invoice.due_date && <p className="text-inkFaint text-xs">Due: {invoice.due_date}</p>}
                        </div>
                        <span className={`text-xs font-black px-3 py-1 rounded-full border flex-shrink-0 ml-2 ${
                          invoice.status === 'paid' ? 'bg-brandBg text-brand border-brand/20' :
                          invoice.status === 'overdue' ? 'bg-red-50 text-red-600 border-red-200' :
                          'bg-amber-50 text-amber-600 border-amber-200'
                        }`}>{invoice.status}</span>
                      </div>
                      <div className="bg-ivory rounded-lg p-3 mb-3 border border-border">
                        {invoice.items.map((item, index) => (
                          <div key={index} className="flex items-center justify-between text-xs py-1">
                            <span className="text-inkMid">{item.name} ×{item.quantity}</span>
                            <span className="text-inkMid font-semibold">₦{(item.quantity * item.price).toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
                          <span className="text-xs font-black text-ink">Total</span>
                          <span className="text-xs font-black text-brand">₦{invoice.total.toLocaleString()}</span>
                        </div>
                      </div>
                      {invoice.status === 'unpaid' && (
                        <div className="flex gap-2">
                          <button onClick={() => updateInvoiceStatus(invoice.id, 'paid')} className="gradient-brand text-white text-xs font-black px-3 py-1.5 rounded-lg transition">Mark as Paid</button>
                          <button onClick={() => updateInvoiceStatus(invoice.id, 'overdue')} className="bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 transition">Mark Overdue</button>
                        </div>
                      )}
                      {invoice.status === 'overdue' && (
                        <button onClick={() => updateInvoiceStatus(invoice.id, 'paid')} className="gradient-brand text-white text-xs font-black px-3 py-1.5 rounded-lg transition">Mark as Paid</button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  )
}
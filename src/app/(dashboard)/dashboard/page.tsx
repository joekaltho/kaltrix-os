'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Business, Booking, Message, Invoice, Customer } from '@/types'
import { getCurrentPlan, hasFeature, Plan } from '@/lib/check-plan'

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
  const [activeTab, setActiveTab] = useState('overview')
  const [plan, setPlan] = useState<Plan>('free')

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
    if (!hasFeature(plan, 'bookings')) return
    await supabase.from('bookings').update({ status }).eq('id', id)
    setBookings(bookings.map(b => b.id === id ? { ...b, status } : b))
  }

  const updateInvoiceStatus = async (id: string, status: Invoice['status']) => {
    if (!hasFeature(plan, 'invoices')) return
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

  const tabs = [
    { id: 'overview', label: 'Overview', always: true },
    { id: 'inbox', label: 'Inbox', always: true },
    { id: 'bookings', label: 'Bookings', requires: 'bookings' as const },
    { id: 'customers', label: 'Customers', requires: 'crm' as const },
    { id: 'invoices', label: 'Invoices', requires: 'invoices' as const },
  ].filter(tab => tab.always || (tab.requires && hasFeature(plan, tab.requires)))

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
    <div className="min-h-screen bg-ivory text-ink font-sans">

      {/* Nav */}
      <nav className="sticky top-0 z-50 glass border-b border-border shadow-card">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <span className="text-base font-black tracking-tight">Kaltrix<span className="text-brand">OS</span></span>
          <div className="flex items-center gap-3">
            {unreadMessages.length > 0 && (
              <button
                onClick={() => setActiveTab('inbox')}
                className="flex items-center gap-1.5 text-xs text-amber-700 font-bold bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full transition hover:bg-amber-100"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse-slow" />
                {unreadMessages.length} new
              </button>
            )}
            <span className="text-inkFaint text-sm hidden md:block">
              {userName}
            </span>
            <span className={`text-xs font-black px-2.5 py-1 rounded-full capitalize border ${
              plan === 'free' ? 'bg-ivory text-inkFaint border-border' :
              plan === 'growth' ? 'bg-brandBg text-brand border-brand/20' :
              'bg-ink text-ivory border-ink'
            }`}>{plan}</span>
            <button
              onClick={handleSignOut}
              className="text-xs text-inkFaint hover:text-ink border border-border bg-surface hover:bg-ivoryDim px-3 py-1.5 rounded-lg transition font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {!business ? (
        <div className="max-w-lg mx-auto px-6 py-32 text-center">
          <div className="w-16 h-16 bg-brandBg border border-brand/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-7 h-7 text-brand" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-black mb-2">No business profile yet</h2>
          <p className="text-inkFaint mb-8">Create your profile to start getting discovered and managing operations.</p>
          <Link href="/dashboard/create-business" className="inline-flex items-center gap-2 gradient-brand text-white font-black px-8 py-4 rounded-xl transition shadow-brand text-sm">
            Create Business Profile
          </Link>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Business header */}
          <div className="flex items-start justify-between mb-8 pb-8 border-b border-border">
            <div>
              <h2 className="text-2xl font-black tracking-tight">{business.business_name}</h2>
              <p className="text-inkFaint text-sm mt-1">{business.industry} · {business.city}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-inkFaint font-medium uppercase tracking-wider">TrustScore</p>
                <p className="text-3xl font-black text-brand leading-none mt-0.5">{business.trust_score}</p>
              </div>
              <div className="w-px h-10 bg-border" />
              {business.is_verified ? (
                <span className="bg-brandBg text-brand text-xs font-black px-3 py-1.5 rounded-full border border-brand/20">
                  Verified
                </span>
              ) : (
                <span className="bg-amber-50 text-amber-700 text-xs font-bold px-3 py-1.5 rounded-full border border-amber-200">
                  Unverified
                </span>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-0.5 mb-8 border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition border-b-2 -mb-px flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? 'border-brand text-brand'
                    : 'border-transparent text-inkFaint hover:text-ink'
                }`}
              >
                {tab.label}
                {tab.id === 'inbox' && unreadMessages.length > 0 && (
                  <span className="bg-amber-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full font-black">
                    {unreadMessages.length}
                  </span>
                )}
                {tab.id === 'invoices' && unpaidInvoices.length > 0 && (
                  <span className="bg-red-500 text-white text-xs w-4 h-4 flex items-center justify-center rounded-full font-black">
                    {unpaidInvoices.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Today's Bookings", value: todayBookings.length, color: 'text-brand', sub: 'bookings' },
                  { label: 'Unread Messages', value: unreadMessages.length, color: 'text-amber-600', sub: 'messages' },
                  { label: 'Unpaid Invoices', value: unpaidInvoices.length, color: 'text-red-500', sub: 'invoices' },
                  { label: 'Total Revenue', value: `₦${totalRevenue.toLocaleString()}`, color: 'text-brand', sub: 'earned' },
                ].map((stat) => (
                  <div key={stat.label} className="bg-surface rounded-2xl p-5 border border-border shadow-card">
                    <p className="text-inkFaint text-xs font-medium uppercase tracking-wider mb-3">{stat.label}</p>
                    <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    <p className="text-inkFaint text-xs mt-1">{stat.sub}</p>
                  </div>
                ))}
              </div>

              {plan === 'free' && (
                <div className="bg-ink rounded-2xl p-6 flex items-center justify-between gap-4 relative overflow-hidden">
                  <div className="absolute top-[-30%] right-[-5%] w-[40%] h-[200%] bg-brand/8 blur-3xl rounded-full pointer-events-none" />
                  <div className="relative z-10">
                    <h3 className="font-black text-white">Unlock premium features</h3>
                    <p className="text-white/50 text-sm mt-0.5">Bookings, CRM, invoices and analytics. From ₦8,250/mo equivalent.</p>
                  </div>
                  <Link href="/dashboard/upgrade" className="relative z-10 shrink-0 gradient-brand text-white font-black px-5 py-2.5 rounded-xl transition text-sm shadow-brand whitespace-nowrap">
                    Upgrade Now
                  </Link>
                </div>
              )}

              {hasFeature(plan, 'analytics') && invoices.filter(i => i.status === 'paid').length > 0 && (
                <div className="bg-surface rounded-2xl p-6 border border-border shadow-card">
                  <p className="text-xs font-bold text-inkFaint uppercase tracking-wider mb-5">Revenue Overview</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={invoices.filter(i => i.status === 'paid').map(i => ({
                      date: new Date(i.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
                      revenue: i.total
                    }))}>
                      <defs>
                        <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#e2e2db" tick={{ fill: '#8a8a8a', fontSize: 11 }} />
                      <YAxis stroke="#e2e2db" tick={{ fill: '#8a8a8a', fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e2db', borderRadius: '10px', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }} labelStyle={{ color: '#3a3a3a', fontSize: 11 }} itemStyle={{ color: '#22c55e', fontSize: 11 }} />
                      <Area type="monotone" dataKey="revenue" stroke="#22c55e" fill="url(#rev)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-inkFaint uppercase tracking-wider">Recent Bookings</p>
                    {hasFeature(plan, 'bookings') && (
                      <Link href="/dashboard/bookings/new" className="text-xs text-brand font-bold hover:underline">New</Link>
                    )}
                  </div>
                  {!hasFeature(plan, 'bookings') ? (
                    <Link href="/dashboard/upgrade" className="block text-center py-8 text-inkFaint text-sm hover:text-ink transition">
                      Upgrade to manage bookings
                    </Link>
                  ) : todayBookings.length === 0 ? (
                    <p className="text-inkFaint text-sm py-6 text-center">No bookings today</p>
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

                <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-inkFaint uppercase tracking-wider">Quick Actions</p>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'New Booking', href: '/dashboard/bookings/new', requires: 'bookings' as const },
                      { label: 'New Customer', href: '/dashboard/customers/new', requires: 'crm' as const },
                      { label: 'New Invoice', href: '/dashboard/invoices/new', requires: 'invoices' as const },
                      { label: 'Edit Profile', href: '/dashboard/profile', requires: null },
                    ].map((action) => (
                      (!action.requires || hasFeature(plan, action.requires)) && (
                        <Link
                          key={action.href}
                          href={action.href}
                          className="flex items-center justify-between w-full text-sm text-ink hover:text-brand transition py-2 border-b border-border last:border-0 font-medium group"
                        >
                          {action.label}
                          <svg className="w-4 h-4 text-inkFaint group-hover:text-brand transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </Link>
                      )
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* INBOX */}
          {activeTab === 'inbox' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black">Inbox</h3>
                {unreadMessages.length > 0 && (
                  <span className="text-xs text-amber-700 font-bold">{unreadMessages.length} unread</span>
                )}
              </div>
              {messages.length === 0 ? (
                <div className="bg-surface rounded-2xl p-16 border border-border text-center shadow-card">
                  <div className="w-12 h-12 bg-ivoryDim rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-5 h-5 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="text-inkFaint font-medium text-sm">No messages yet</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    onClick={() => !msg.is_read && markMessageRead(msg.id)}
                    className={`bg-surface rounded-xl p-5 border shadow-card cursor-pointer transition ${
                      !msg.is_read ? 'border-brand/30 bg-brandBg/30' : 'border-border hover:border-inkFaint'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-ivoryDim rounded-full border border-border flex items-center justify-center text-xs font-black text-inkMid">
                          {msg.sender_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{msg.sender_name}</p>
                          {msg.sender_phone && <p className="text-inkFaint text-xs">{msg.sender_phone}</p>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!msg.is_read && <span className="w-2 h-2 rounded-full bg-brand" />}
                        <p className="text-inkFaint text-xs">{new Date(msg.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className="text-inkMid text-sm leading-relaxed">{msg.content}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* BOOKINGS */}
          {hasFeature(plan, 'bookings') && activeTab === 'bookings' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black">Bookings</h3>
                <Link href="/dashboard/bookings/new" className="gradient-brand text-white text-sm font-black px-4 py-2 rounded-xl transition shadow-brand">
                  New Booking
                </Link>
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
              ) : (
                bookings.map((booking) => (
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
                      <span className={`text-xs font-black px-3 py-1 rounded-full border ${
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
                ))
              )}
            </div>
          )}

          {/* CUSTOMERS */}
          {hasFeature(plan, 'crm') && activeTab === 'customers' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black">Customers</h3>
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
              ) : (
                customers.map((customer) => (
                  <div key={customer.id} className="bg-surface rounded-xl p-5 border border-border shadow-card flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-ivoryDim rounded-full border border-border flex items-center justify-center text-xs font-black text-inkMid">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-black text-sm">{customer.name}</p>
                        <p className="text-inkFaint text-xs">{customer.phone} {customer.email && `· ${customer.email}`}</p>
                      </div>
                    </div>
                    <p className="text-inkFaint text-xs">{new Date(customer.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* INVOICES */}
          {hasFeature(plan, 'invoices') && activeTab === 'invoices' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black">Invoices</h3>
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
              ) : (
                invoices.map((invoice) => (
                  <div key={invoice.id} className="bg-surface rounded-xl p-5 border border-border shadow-card">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-black">{invoice.customer_name}</p>
                        {invoice.customer_phone && <p className="text-inkFaint text-xs mt-0.5">{invoice.customer_phone}</p>}
                        <p className="text-brand font-black text-lg mt-1">₦{invoice.total.toLocaleString()}</p>
                        <p className="text-inkFaint text-xs">{new Date(invoice.created_at).toLocaleDateString()}</p>
                        {invoice.due_date && <p className="text-inkFaint text-xs">Due: {invoice.due_date}</p>}
                      </div>
                      <span className={`text-xs font-black px-3 py-1 rounded-full border ${
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
                ))
              )}
            </div>
          )}

        </div>
      )}
    </div>
  )
}

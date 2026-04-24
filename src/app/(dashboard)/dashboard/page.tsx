'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { Business, Booking, Message, Invoice, Customer } from '@/types'

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

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles').select('name, role').eq('id', user.id).single()

      if (profile) {
        setUserName(profile.name)
        if (profile.role === 'admin') { router.push('/admin'); return }
      }

      const { data: businessData } = await supabase
        .from('businesses').select('*').eq('user_id', user.id).single()

      if (businessData) {
        setBusiness(businessData)

        const [bookingsRes, messagesRes, invoicesRes, customersRes] = await Promise.all([
          supabase.from('bookings').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false }),
          supabase.from('messages').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false }),
          supabase.from('invoices').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false }),
          supabase.from('customers').select('*').eq('business_id', businessData.id).order('created_at', { ascending: false }),
        ])

        setBookings(bookingsRes.data || [])
        setMessages(messagesRes.data || [])
        setInvoices(invoicesRes.data || [])
        setCustomers(customersRes.data || [])
      }

      setLoading(false)
    }
    fetchData()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const todayBookings = bookings.filter(b => b.date === new Date().toISOString().split('T')[0])
  const unreadMessages = messages.filter(m => !m.is_read)
  const unpaidInvoices = invoices.filter(i => i.status === 'unpaid')
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + i.total, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-400 text-xl animate-pulse">Loading KaltrixOS...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">

      {/* Navbar */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-black z-10">
        <h1 className="text-xl font-bold">Kaltrix<span className="text-green-400">OS</span></h1>
        <div className="flex items-center gap-6">
          {unreadMessages.length > 0 && (
            <button onClick={() => setActiveTab('inbox')} className="text-sm text-yellow-400">
              {unreadMessages.length} new message{unreadMessages.length > 1 ? 's' : ''}
            </button>
          )}
          <span className="text-gray-400 text-sm">Hey, {userName}</span>
          <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-white transition">
            Sign out
          </button>
        </div>
      </nav>

      {!business ? (
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <h2 className="text-2xl font-bold mb-2">No business profile yet</h2>
          <p className="text-gray-400 mb-8">Create your business profile to get started</p>
          <Link href="/dashboard/create-business" className="bg-green-400 hover:bg-green-300 text-black font-semibold px-8 py-4 rounded-xl transition text-lg">
            Create Business Profile
          </Link>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-6 py-8">

          {/* Business Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold">{business.business_name}</h2>
              <p className="text-gray-400 text-sm">{business.industry} - {business.city}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-green-400 font-bold text-lg">TS: {business.trust_score}</span>
              {!business.is_verified && (
                <span className="bg-yellow-500/10 text-yellow-500 text-xs px-3 py-1 rounded-full border border-yellow-500/20">
                  Unverified
                </span>
              )}
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex gap-2 mb-8 border-b border-gray-800 overflow-x-auto">
            {['overview', 'bookings', 'customers', 'inbox', 'invoices'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize whitespace-nowrap transition border-b-2 ${
                  activeTab === tab
                    ? 'border-green-400 text-green-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {tab}
                {tab === 'inbox' && unreadMessages.length > 0 && (
                  <span className="ml-2 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full">
                    {unreadMessages.length}
                  </span>
                )}
                {tab === 'invoices' && unpaidInvoices.length > 0 && (
                  <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                    {unpaidInvoices.length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Stats Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                  <p className="text-gray-400 text-xs mb-1">Today Bookings</p>
                  <p className="text-3xl font-bold text-green-400">{todayBookings.length}</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                  <p className="text-gray-400 text-xs mb-1">Unread Messages</p>
                  <p className="text-3xl font-bold text-yellow-400">{unreadMessages.length}</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                  <p className="text-gray-400 text-xs mb-1">Unpaid Invoices</p>
                  <p className="text-3xl font-bold text-red-400">{unpaidInvoices.length}</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                  <p className="text-gray-400 text-xs mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold text-green-400">
                    ₦{totalRevenue.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Revenue Chart */}
              <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                <h3 className="text-sm font-medium text-gray-400 mb-4">Revenue Overview</h3>
                {invoices.filter(i => i.status === 'paid').length === 0 ? (
                  <div className="h-40 flex items-center justify-center">
                    <p className="text-gray-600 text-sm">No revenue data yet — create and mark invoices as paid to see your chart</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={invoices
                      .filter(i => i.status === 'paid')
                      .map(i => ({
                        date: new Date(i.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }),
                        revenue: i.total
                      }))
                    }>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4ade80" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis stroke="#4b5563" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
                        labelStyle={{ color: '#9ca3af' }}
                        itemStyle={{ color: '#4ade80' }}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#4ade80" fill="url(#revenueGradient)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* TrustScore + Website + Verification */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <p className="text-gray-400 text-sm mb-2">TrustScore</p>
                  <div className="text-4xl font-bold text-green-400">{business.trust_score}</div>
                  <div className="mt-3 bg-gray-800 rounded-full h-2">
                    <div className="bg-green-400 h-2 rounded-full" style={{ width: `${business.trust_score}%` }} />
                  </div>
                  <p className="text-gray-500 text-xs mt-2">out of 100</p>
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <p className="text-gray-400 text-sm mb-2">Website</p>
                  {business.website_url ? (
                    <div>
                      <div className="text-2xl font-bold text-green-400">Live</div>
                      <a href={business.website_url} target="_blank" rel="noreferrer" className="text-green-400 text-xs mt-2 block hover:underline truncate">
                        {business.website_url}
                      </a>
                    </div>
                  ) : (
                    <div>
                      <div className="text-2xl font-bold text-yellow-500">Missing</div>
                      <p className="text-gray-500 text-xs mt-2">No website hurts your TrustScore</p>
                      <Link href="/dashboard/upgrade" className="text-green-400 text-xs mt-2 block hover:underline">Get a website</Link>
                    </div>
                  )}
                </div>

                <div className="bg-gray-900 rounded-2xl p-6 border border-gray-800">
                  <p className="text-gray-400 text-sm mb-2">Verification</p>
                  {business.is_verified ? (
                    <div className="text-2xl font-bold text-green-400">Verified</div>
                  ) : (
                    <div>
                      <div className="text-2xl font-bold text-yellow-500">Pending</div>
                      <p className="text-gray-500 text-xs mt-2">Get verified to boost trust</p>
                      <Link href="/dashboard/upgrade" className="text-green-400 text-xs mt-2 block hover:underline">Get verified</Link>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <button onClick={() => setActiveTab('bookings')} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center hover:border-green-400/50 transition">
                  <p className="text-green-400 text-2xl font-bold mb-1">{bookings.length}</p>
                  <p className="text-sm text-gray-400">Bookings</p>
                </button>
                <button onClick={() => setActiveTab('customers')} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center hover:border-green-400/50 transition">
                  <p className="text-green-400 text-2xl font-bold mb-1">{customers.length}</p>
                  <p className="text-sm text-gray-400">Customers</p>
                </button>
                <button onClick={() => setActiveTab('inbox')} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center hover:border-green-400/50 transition">
                  <p className="text-yellow-400 text-2xl font-bold mb-1">{messages.length}</p>
                  <p className="text-sm text-gray-400">Messages</p>
                </button>
                <button onClick={() => setActiveTab('invoices')} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center hover:border-green-400/50 transition">
                  <p className="text-green-400 text-2xl font-bold mb-1">{invoices.length}</p>
                  <p className="text-sm text-gray-400">Invoices</p>
                </button>
              </div>

              {/* Upgrade CTA */}
              {!business.website_url && (
                <div className="bg-green-400/5 border border-green-400/20 rounded-2xl p-6 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-green-400">Get a Professional Website</h3>
                    <p className="text-gray-400 text-sm mt-1">Businesses with websites get 3x more customers.</p>
                  </div>
                  <Link href="/dashboard/upgrade" className="bg-green-400 hover:bg-green-300 text-black font-semibold px-6 py-3 rounded-xl transition text-sm whitespace-nowrap ml-4">
                    Get Started
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* BOOKINGS TAB */}
          {activeTab === 'bookings' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Bookings</h3>
                <Link href="/dashboard/bookings/new" className="bg-green-400 hover:bg-green-300 text-black text-sm font-semibold px-4 py-2 rounded-lg transition">
                  New Booking
                </Link>
              </div>
              {bookings.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                  <p className="text-gray-400">No bookings yet</p>
                  <Link href="/dashboard/bookings/new" className="text-green-400 text-sm mt-2 block hover:underline">
                    Create your first booking
                  </Link>
                </div>
              ) : (
                bookings.map((booking) => (
                  <div key={booking.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{booking.customer_name}</p>
                      <p className="text-gray-400 text-sm">{booking.service}</p>
                      <p className="text-gray-500 text-xs">{booking.date} at {booking.time}</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full border ${
                      booking.status === 'confirmed' ? 'bg-green-400/10 text-green-400 border-green-400/20' :
                      booking.status === 'cancelled' ? 'bg-red-400/10 text-red-400 border-red-400/20' :
                      booking.status === 'completed' ? 'bg-blue-400/10 text-blue-400 border-blue-400/20' :
                      'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                    }`}>
                      {booking.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* CUSTOMERS TAB */}
          {activeTab === 'customers' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Customers</h3>
                <Link href="/dashboard/customers/new" className="bg-green-400 hover:bg-green-300 text-black text-sm font-semibold px-4 py-2 rounded-lg transition">
                  Add Customer
                </Link>
              </div>
              {customers.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                  <p className="text-gray-400">No customers yet</p>
                  <Link href="/dashboard/customers/new" className="text-green-400 text-sm mt-2 block hover:underline">
                    Add your first customer
                  </Link>
                </div>
              ) : (
                customers.map((customer) => (
                  <div key={customer.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-gray-400 text-sm">{customer.phone}</p>
                      <p className="text-gray-500 text-xs">{customer.email}</p>
                    </div>
                    <p className="text-gray-600 text-xs">{new Date(customer.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* INBOX TAB */}
          {activeTab === 'inbox' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold">Inbox</h3>
              {messages.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                  <p className="text-gray-400">No messages yet</p>
                  <p className="text-gray-500 text-sm mt-1">Messages from customers will appear here</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`bg-gray-900 rounded-xl p-4 border transition ${
                    !message.is_read ? 'border-yellow-400/30' : 'border-gray-800'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{message.sender_name}</p>
                      {!message.is_read && (
                        <span className="bg-yellow-500 text-black text-xs px-2 py-0.5 rounded-full">New</span>
                      )}
                    </div>
                    <p className="text-gray-400 text-sm">{message.content}</p>
                    <p className="text-gray-600 text-xs mt-2">{new Date(message.created_at).toLocaleDateString()}</p>
                  </div>
                ))
              )}
            </div>
          )}

          {/* INVOICES TAB */}
          {activeTab === 'invoices' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Invoices</h3>
                <Link href="/dashboard/invoices/new" className="bg-green-400 hover:bg-green-300 text-black text-sm font-semibold px-4 py-2 rounded-lg transition">
                  New Invoice
                </Link>
              </div>
              {invoices.length === 0 ? (
                <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                  <p className="text-gray-400">No invoices yet</p>
                  <Link href="/dashboard/invoices/new" className="text-green-400 text-sm mt-2 block hover:underline">
                    Create your first invoice
                  </Link>
                </div>
              ) : (
                invoices.map((invoice) => (
                  <div key={invoice.id} className="bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{invoice.customer_name}</p>
                      <p className="text-gray-400 text-sm">₦{invoice.total.toLocaleString()}</p>
                      <p className="text-gray-500 text-xs">{new Date(invoice.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full border ${
                      invoice.status === 'paid' ? 'bg-green-400/10 text-green-400 border-green-400/20' :
                      invoice.status === 'overdue' ? 'bg-red-400/10 text-red-400 border-red-400/20' :
                      'bg-yellow-400/10 text-yellow-400 border-yellow-400/20'
                    }`}>
                      {invoice.status}
                    </span>
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
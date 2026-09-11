'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import type { Expense } from '@/types'
import {
  BusinessPulseData,
  formatNaira,
  getChange,
  changeLabel,
  growthCopy,
  healthTone,
  PERIOD_OPTIONS,
} from '@/lib/business-pulse'

const inputClass = 'w-full bg-ivory border border-border rounded-xl px-4 py-3 text-ink placeholder-inkFaint focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 transition text-sm'
const labelClass = 'text-xs font-bold text-inkMid uppercase tracking-wider mb-1.5 block'

interface BusinessPulsePanelProps {
  businessId: string
}

export default function BusinessPulsePanel({ businessId }: BusinessPulsePanelProps) {
  const supabase = createClient()
  const [periodDays, setPeriodDays] = useState<number>(30)
  const [pulse, setPulse] = useState<BusinessPulseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([])
  const [showAddExpense, setShowAddExpense] = useState(false)

  useEffect(() => {
    const loadPulse = async () => {
      setLoading(true)
      setErrorMsg('')
      const { data, error } = await supabase.rpc('get_business_pulse', {
        p_business_id: businessId,
        p_period_days: periodDays,
      })
      if (error) {
        setErrorMsg(`Could not load Business Pulse: ${error.message}`)
        setLoading(false)
        return
      }
      const result = data as BusinessPulseData
      if (result?.error) {
        setErrorMsg('Could not load Business Pulse for this business.')
        setLoading(false)
        return
      }
      setPulse(result)
      setLoading(false)
    }
    loadPulse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, periodDays, refreshTrigger])

  useEffect(() => {
    const fetchExpenses = async () => {
      const { data } = await supabase
        .from('expenses')
        .select('*')
        .eq('business_id', businessId)
        .order('expense_date', { ascending: false })
        .limit(8)
      setRecentExpenses(data || [])
    }
    fetchExpenses()
  }, [businessId, refreshTrigger, supabase])

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Delete this expense? This cannot be undone.')) return
    await supabase.from('expenses').delete().eq('id', id)
    setRefreshTrigger((n) => n + 1)
  }

  if (loading && !pulse) {
    return (
      <div className="flex justify-center py-16">
        <span className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (errorMsg) {
    return <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-4 text-sm">{errorMsg}</div>
  }

  if (!pulse) return null

  const revenueChange = getChange(pulse.revenue.current, pulse.revenue.previous, pulse.has_comparison_period)
  const expenseChange = getChange(pulse.expenses.current, pulse.expenses.previous, pulse.has_comparison_period)
  const profitChange = pulse.profit.available
    ? getChange(pulse.profit.current ?? 0, pulse.profit.previous ?? 0, pulse.has_comparison_period)
    : null
  const custChange = getChange(pulse.customers.new_current, pulse.customers.new_previous, pulse.has_comparison_period)

  const g = growthCopy[pulse.growth.status]

  return (
    <div className="space-y-5">
      {showAddExpense && (
        <AddExpenseModal
          businessId={businessId}
          onClose={() => setShowAddExpense(false)}
          onSaved={() => { setShowAddExpense(false); setRefreshTrigger((n) => n + 1) }}
        />
      )}

      {/* Period selector */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-inkFaint font-medium">
          {new Date(pulse.period_start).toLocaleDateString()} — {new Date(pulse.period_end).toLocaleDateString()}
        </p>
        <div className="flex bg-ivoryDim rounded-xl p-1 border border-border">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.days}
              onClick={() => setPeriodDays(opt.days)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                periodDays === opt.days ? 'bg-surface shadow-card text-ink' : 'text-inkFaint hover:text-ink'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {!pulse.has_any_data ? (
        <EmptyPulseState onAddExpense={() => setShowAddExpense(true)} />
      ) : (
        <>
          {/* Growth + Health Score */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className={`rounded-2xl p-5 border border-border shadow-card ${g.bg}`}>
              <p className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1">Growth</p>
              <p className={`text-xl font-black ${g.color}`}>{g.label}</p>
              <p className="text-xs text-inkFaint mt-1">{pulse.growth.basis}</p>
            </div>
            <HealthScoreCard health={pulse.business_health} />
          </div>

          {/* Core metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <MetricCard label="Revenue" value={formatNaira(pulse.revenue.current)} change={revenueChange} />
            <MetricCard
              label="Expenses"
              value={pulse.expenses.tracked ? formatNaira(pulse.expenses.current) : 'Not tracked'}
              change={pulse.expenses.tracked ? expenseChange : null}
              action={!pulse.expenses.tracked ? { label: 'Add expense', onClick: () => setShowAddExpense(true) } : undefined}
            />
            <MetricCard
              label="Profit"
              value={pulse.profit.available ? formatNaira(pulse.profit.current ?? 0) : 'Add expenses to see profit'}
              change={profitChange}
              muted={!pulse.profit.available}
            />
            <MetricCard
              label="Transactions"
              value={String(pulse.transactions.period_count)}
              sub={`${formatNaira(pulse.transactions.period_amount)} recorded`}
            />
          </div>

          {/* Revenue trend bars */}
          {pulse.has_comparison_period && (pulse.revenue.current > 0 || pulse.revenue.previous > 0) && (
            <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
              <p className="text-xs font-bold text-inkMid uppercase tracking-wider mb-3">Revenue vs. comparison period</p>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart
                  data={[
                    { name: 'Previous', value: pulse.revenue.previous },
                    { name: 'Current', value: pulse.revenue.current },
                  ]}
                  margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
                >
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--color-inkFaint)' }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => formatNaira(Number(v) || 0)} contentStyle={{ borderRadius: 12, border: '1px solid var(--color-border)', fontSize: 12 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    <Cell fill="var(--color-ivoryDeep)" />
                    <Cell fill="var(--color-brand)" />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Invoices & transaction health */}
          <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
            <p className="text-xs font-bold text-inkMid uppercase tracking-wider mb-3">Invoice & transaction health</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Stat label="Total invoices" value={pulse.invoices.total} />
              <Stat label="Paid" value={pulse.invoices.paid} color="text-brand" />
              <Stat label="Outstanding" value={pulse.invoices.outstanding_count} color={pulse.invoices.outstanding_count > 0 ? 'text-red-500' : undefined} />
              <Stat label="Outstanding amount" value={formatNaira(pulse.invoices.outstanding_amount)} />
            </div>
          </div>

          {/* Customer health */}
          <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
            <p className="text-xs font-bold text-inkMid uppercase tracking-wider mb-3">Customer health</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stat label="Total customers" value={pulse.customers.total} />
              <Stat label="New this period" value={pulse.customers.new_current} color="text-brand" />
              <div>
                <p className="text-xs text-inkFaint font-medium mb-0.5">Change vs. prior</p>
                <p className="text-lg font-black">{changeLabel(custChange)}</p>
              </div>
            </div>
          </div>

          {/* Bookings */}
          {pulse.bookings.total > 0 && (
            <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
              <p className="text-xs font-bold text-inkMid uppercase tracking-wider mb-3">Bookings this period</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Stat label="Confirmed" value={pulse.bookings.confirmed} color="text-brand" />
                <Stat label="Completed" value={pulse.bookings.completed} />
                <Stat label="Pending" value={pulse.bookings.pending} />
                <Stat label="Cancelled" value={pulse.bookings.cancelled} color={pulse.bookings.cancelled > 0 ? 'text-red-500' : undefined} />
              </div>
            </div>
          )}

          {/* Expenses list */}
          <div className="bg-surface rounded-2xl p-5 border border-border shadow-card">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-inkMid uppercase tracking-wider">Recent expenses</p>
              <button onClick={() => setShowAddExpense(true)} className="text-brand text-xs font-bold hover:underline">
                + Add expense
              </button>
            </div>
            {recentExpenses.length === 0 ? (
              <p className="text-inkFaint text-sm">No expenses logged yet. Add one to start tracking profit.</p>
            ) : (
              <div className="space-y-2">
                {recentExpenses.map((exp) => (
                  <div key={exp.id} className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-bold truncate">{exp.category}</p>
                      {exp.description && <p className="text-xs text-inkFaint truncate">{exp.description}</p>}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-inkFaint">{new Date(exp.expense_date).toLocaleDateString()}</span>
                      <span className="text-sm font-black">{formatNaira(exp.amount)}</span>
                      <button onClick={() => handleDeleteExpense(exp.id)} className="text-inkFaint hover:text-red-500 transition">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <p className="text-xs text-inkFaint font-medium mb-0.5">{label}</p>
      <p className={`text-lg font-black ${color ?? ''}`}>{value}</p>
    </div>
  )
}

function MetricCard({
  label,
  value,
  change,
  sub,
  muted,
  action,
}: {
  label: string
  value: string
  change?: ReturnType<typeof getChange> | null
  sub?: string
  muted?: boolean
  action?: { label: string; onClick: () => void }
}) {
  const badge = change
    ? change.direction === 'up'
      ? 'text-brand bg-brandBg'
      : change.direction === 'down'
      ? 'text-red-500 bg-red-50'
      : 'text-inkFaint bg-ivoryDim'
    : ''
  return (
    <div className="bg-surface rounded-2xl p-4 border border-border shadow-card">
      <p className="text-xs text-inkFaint font-medium mb-1">{label}</p>
      <p className={`text-lg font-black ${muted ? 'text-inkFaint text-sm' : 'text-ink'}`}>{value}</p>
      {sub && <p className="text-xs text-inkFaint mt-0.5">{sub}</p>}
      {change && (
        <span className={`inline-block text-[11px] font-bold px-2 py-0.5 rounded-full mt-2 ${badge}`}>
          {changeLabel(change)}
        </span>
      )}
      {action && (
        <button onClick={action.onClick} className="block text-brand text-xs font-bold hover:underline mt-2">
          {action.label}
        </button>
      )}
    </div>
  )
}

function HealthScoreCard({ health }: { health: BusinessPulseData['business_health'] }) {
  if (!health.available || health.score === null) {
    return (
      <div className="rounded-2xl p-5 border border-border shadow-card bg-ivoryDim">
        <p className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1">Business Health</p>
        <p className="text-xl font-black text-inkFaint">Not enough data yet</p>
        <p className="text-xs text-inkFaint mt-1">Start using KaltrixOS to build your Business Health Score.</p>
      </div>
    )
  }
  const tone = healthTone(health.score)
  return (
    <details className={`rounded-2xl p-5 border border-border shadow-card ${tone.bg} group`}>
      <summary className="list-none cursor-pointer flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-inkMid uppercase tracking-wider mb-1">Business Health</p>
          <p className={`text-xl font-black ${tone.color}`}>{health.score}/100 · {tone.label}</p>
        </div>
        <svg className="w-4 h-4 text-inkFaint transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="mt-4 space-y-2.5 pt-3 border-t border-border/60">
        {health.factors.map((f) => (
          <div key={f.key}>
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-ink">{f.label}</span>
              <span className="text-inkFaint font-medium">{f.points}/{f.max_points}</span>
            </div>
            <p className="text-xs text-inkFaint mt-0.5">{f.detail}</p>
          </div>
        ))}
      </div>
    </details>
  )
}

function EmptyPulseState({ onAddExpense }: { onAddExpense: () => void }) {
  return (
    <div className="bg-surface rounded-2xl p-10 sm:p-16 border border-border text-center shadow-card">
      <div className="w-12 h-12 bg-ivoryDim rounded-xl flex items-center justify-center mx-auto mb-4">
        <svg className="w-5 h-5 text-inkFaint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12h4l3 8 4-16 3 8h4" />
        </svg>
      </div>
      <p className="font-black text-lg mb-1">Not enough data yet</p>
      <p className="text-inkFaint text-sm max-w-sm mx-auto mb-6">
        Business Pulse fills in as you use KaltrixOS. Here&apos;s what unlocks each metric:
      </p>
      <ul className="text-sm text-inkMid text-left max-w-xs mx-auto space-y-2 mb-6">
        <li className="flex gap-2"><span className="text-brand">•</span> Send and get invoices paid to see revenue trends</li>
        <li className="flex gap-2"><span className="text-brand">•</span> Add expenses to see profit</li>
        <li className="flex gap-2"><span className="text-brand">•</span> Add customers and bookings to see growth and fulfillment</li>
      </ul>
      <button onClick={onAddExpense} className="gradient-brand text-white text-sm font-black px-6 py-3 rounded-xl transition shadow-brand">
        Log your first expense
      </button>
    </div>
  )
}

function AddExpenseModal({ businessId, onClose, onSaved }: { businessId: string; onClose: () => void; onSaved: () => void }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    amount: '',
    category: 'general',
    description: '',
    expense_date: new Date().toISOString().slice(0, 10),
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const amount = parseInt(form.amount, 10)
    if (!amount || amount < 0) {
      setError('Enter a valid amount')
      setLoading(false)
      return
    }

    const { error: insertError } = await supabase.from('expenses').insert({
      business_id: businessId,
      amount,
      category: form.category || 'general',
      description: form.description || null,
      expense_date: form.expense_date,
    })

    if (insertError) {
      setError(`Could not save expense: ${insertError.message}`)
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
          <h3 className="font-black text-lg">Add Expense</h3>
          <button onClick={onClose} className="text-inkFaint hover:text-ink transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl p-3 mb-4 text-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Amount (₦) *</label>
            <input type="number" name="amount" value={form.amount} onChange={handleChange} required min="0" className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select name="category" value={form.category} onChange={handleChange} className={inputClass}>
              <option value="general">General</option>
              <option value="supplies">Supplies</option>
              <option value="transport">Transport</option>
              <option value="rent">Rent</option>
              <option value="salaries">Salaries</option>
              <option value="marketing">Marketing</option>
              <option value="utilities">Utilities</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" name="expense_date" value={form.expense_date} onChange={handleChange} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Note (optional)</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2} className={inputClass + ' resize-none'} />
          </div>

          <button type="submit" disabled={loading} className="w-full gradient-brand text-white font-black py-3 rounded-xl transition shadow-brand disabled:opacity-50 text-sm flex items-center justify-center gap-2">
            {loading ? (
              <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
            ) : 'Save Expense'}
          </button>
        </form>
      </div>
    </div>
  )
}

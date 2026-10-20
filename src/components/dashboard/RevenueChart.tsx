'use client'

// The Overview revenue trend. Lives in its own file so the charting library
// (recharts, the single largest piece of the dashboard's JavaScript) is only
// downloaded when a chart is actually drawn: Overview loads this with next/dynamic.
// The chart is the last card on the page, so it never blocks the useful content above it.

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { formatNaira } from '@/lib/format'

export interface RevenuePoint { date: string; revenue: number }

export default function RevenueChart({ data }: { data: RevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={160}>
      <AreaChart data={data}>
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
  )
}

'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { fmt, MONTHS } from '@/lib/utils'

interface MonthData {
  month: string
  total: number
}

interface Props {
  data: MonthData[]
}

export const TrendChart = React.memo(function TrendChart({ data }: Props) {
  const chartData = data.map(d => {
    const [, m] = d.month.split('-')
    return { month: MONTHS[parseInt(m) - 1], total: d.total }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
        <Tooltip formatter={(v) => [fmt(Number(v)), 'Spend']} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
        <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
})

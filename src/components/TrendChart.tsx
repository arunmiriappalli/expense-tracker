'use client'

import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
import { fmt, MONTHS } from '@/lib/utils'

interface MonthData {
  month: string
  total: number
}

interface Props {
  data: MonthData[]
  activeMonth?: string
  onBarClick?: (monthKey: string) => void
}

export const TrendChart = React.memo(function TrendChart({ data, activeMonth, onBarClick }: Props) {
  const chartData = data.map(d => {
    const [, m] = d.month.split('-')
    return { monthKey: d.month, month: MONTHS[parseInt(m) - 1], total: d.total }
  })

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="month" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={52} />
        <Tooltip formatter={(v) => [fmt(Number(v)), 'Spend']} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
        <Bar
          dataKey="total"
          radius={[4, 4, 0, 0]}
          cursor={onBarClick ? 'pointer' : 'default'}
          onClick={(data: { monthKey: string }) => onBarClick?.(data.monthKey)}
        >
          {chartData.map((d) => (
            <Cell
              key={d.monthKey}
              fill={d.monthKey === activeMonth ? '#1D4ED8' : '#3B82F6'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
})

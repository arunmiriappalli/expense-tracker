'use client'

import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { fmt } from '@/lib/utils'

const COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#6366F1', '#84CC16',
]

interface Props {
  data: Record<string, number>
}

export const CategoryChart = React.memo(function CategoryChart({ data }: Props) {
  const entries = Object.entries(data)
    .filter(([name]) => name !== 'Investments')
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))

  if (!entries.length) return null

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={entries}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="45%"
          outerRadius={85}
          innerRadius={45}
        >
          {entries.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [fmt(Number(v)), '']}
          contentStyle={{ fontSize: '12px', borderRadius: '8px' }}
        />
        <Legend
          formatter={(value, entry) => `${value} (${fmt((entry.payload as { value: number }).value)})`}
          wrapperStyle={{ fontSize: '11px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
})

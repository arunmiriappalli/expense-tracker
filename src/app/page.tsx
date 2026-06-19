'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CategoryChart } from '@/components/CategoryChart'
import { TrendChart } from '@/components/TrendChart'
import { TransactionList } from '@/components/TransactionList'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`
  return `₹${n.toFixed(0)}`
}

interface StatsData {
  byMonth: Record<string, {
    total: number
    byCategory: Record<string, number>
    byHolder: Record<'self' | 'spouse', number>
  }>
  spendByMonth: Record<string, {
    total: number
    byCategory: Record<string, number>
    byHolder: Record<'self' | 'spouse', number>
  }>
  byCategory: Record<string, number>
  spendByCategory: Record<string, number>
  byHolder: Record<'self' | 'spouse', number>
  spendByHolder: Record<'self' | 'spouse', number>
  annualTotal: number
  annualActivityTotal: number
  year: number
}

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: string
  category: string
  source: string
  source_file_name: string
  card_holder: string
  statement_month: number
  statement_year: number
}

export default function Dashboard() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [holderFilter, setHolderFilter] = useState<'all' | 'self' | 'spouse'>('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [stats, setStats] = useState<StatsData | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async (y: number) => {
    const res = await fetch(`/api/stats?year=${y}`)
    if (res.ok) setStats(await res.json())
  }, [])

  const loadTransactions = useCallback(async (y: number, m: number) => {
    setLoading(true)
    const res = await fetch(`/api/transactions?year=${y}&month=${m}&type=debit`)
    if (res.ok) setTransactions(await res.json())
    setLoading(false)
  }, [])

  useEffect(() => { loadStats(year) }, [year, loadStats])
  useEffect(() => { loadTransactions(year, month) }, [year, month, loadTransactions])

  const currentMonthKey = `${year}-${String(month).padStart(2, '0')}`
  const currentMonthSpendData = stats?.spendByMonth[currentMonthKey]
  const currentMonthActivityData = stats?.byMonth[currentMonthKey]
  const monthSpendTotal = currentMonthSpendData?.total ?? 0
  const monthActivityTotal = currentMonthActivityData?.total ?? 0
  const monthCategories = currentMonthActivityData?.byCategory ?? {}
  const monthByHolder = currentMonthSpendData?.byHolder ?? { self: 0, spouse: 0 }

  const trendData = Object.entries(stats?.spendByMonth ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([m, d]) => ({ month: m, total: d.total }))

  const availableMonths = Object.keys(stats?.spendByMonth ?? {}).map(k => {
    const [, m] = k.split('-')
    return parseInt(m)
  })

  const transactionCategories = Array.from(new Set(transactions.map(tx => tx.category))).sort((a, b) => a.localeCompare(b))
  const filteredTransactions = transactions
    .filter(tx => holderFilter === 'all' || tx.card_holder === holderFilter)
    .filter(tx => categoryFilter === 'all' || tx.category === categoryFilter)
    .slice()
    .sort((a, b) => {
      const diff = b.amount - a.amount
      if (diff !== 0) return diff
      return b.date.localeCompare(a.date)
    })

  return (
    <div className="space-y-4">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{MONTHS[month - 1]} {year}</h1>
          <p className="text-2xl font-bold text-gray-900 mt-0.5">{fmt(monthSpendTotal)}</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1} disabled={!availableMonths.includes(i + 1)}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Annual summary */}
      {stats && (
        <Card className="bg-blue-600 text-white border-0">
          <CardContent className="pt-4 pb-4">
            <p className="text-blue-100 text-sm">Annual spend {year}</p>
            <p className="text-3xl font-bold mt-0.5">{fmt(stats.annualTotal)}</p>
            <p className="text-blue-200 text-xs mt-1">
              All money out: {fmt(stats.annualActivityTotal)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Monthly split by person */}
      {(currentMonthSpendData || currentMonthActivityData) && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm text-gray-500 font-medium">
              This month by person — {MONTHS[month - 1]}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-500">Mine</p>
                <p className="mt-1 text-2xl font-semibold text-gray-900">{fmt(monthByHolder.self)}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {monthSpendTotal > 0 ? Math.round((monthByHolder.self / monthSpendTotal) * 100) : 0}% of monthly spend
                </p>
              </div>
              <div className="rounded-2xl border border-rose-100 bg-rose-50/80 p-4">
                <p className="text-xs uppercase tracking-wide text-rose-500">Wife</p>
                <p className="mt-1 text-2xl font-semibold text-rose-900">{fmt(monthByHolder.spouse)}</p>
                <p className="mt-1 text-xs text-rose-500">
                  {monthSpendTotal > 0 ? Math.round((monthByHolder.spouse / monthSpendTotal) * 100) : 0}% of monthly spend
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monthly trend */}
      {trendData.length > 1 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm text-gray-500 font-medium">Month on month</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <TrendChart data={trendData} />
          </CardContent>
        </Card>
      )}

      {/* Category breakdown */}
      {Object.keys(monthCategories).length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-sm text-gray-500 font-medium">By category — all money out in {MONTHS[month - 1]}</CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <CategoryChart data={monthCategories} />
          </CardContent>
        </Card>
      )}

      {/* Top categories list */}
      {Object.keys(monthCategories).length > 0 && (
        <div className="space-y-2">
          {Object.entries(monthCategories)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between bg-white rounded-xl px-4 py-3">
                <span className="text-sm text-gray-700">{cat}</span>
                <div className="text-right">
                  <span className="text-sm font-semibold text-gray-900">{fmt(amt)}</span>
                  <span className="text-xs text-gray-400 ml-2">
                    {monthActivityTotal > 0 ? Math.round((amt / monthActivityTotal) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Transactions */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <CardTitle className="text-sm text-gray-500 font-medium">Transactions — {MONTHS[month - 1]}</CardTitle>
        </CardHeader>
        <CardContent className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                value={holderFilter}
                onChange={e => setHolderFilter(e.target.value as 'all' | 'self' | 'spouse')}
              >
                <option value="all">All people</option>
                <option value="self">Self</option>
                <option value="spouse">Spouse</option>
              </select>
              <select
                className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
              >
                <option value="all">All categories</option>
                {transactionCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-gray-400">
              Sorted by amount, highest first
            </p>
          </div>
          {loading
            ? <p className="text-center text-gray-400 py-6 text-sm">Loading…</p>
            : <TransactionList transactions={filteredTransactions} />
          }
        </CardContent>
      </Card>

      {!stats && !loading && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📂</p>
          <p className="text-sm">No data yet.</p>
          <a href="/upload" className="text-sm text-blue-600 hover:underline mt-1 inline-block">
            Upload your first statement →
          </a>
        </div>
      )}
    </div>
  )
}

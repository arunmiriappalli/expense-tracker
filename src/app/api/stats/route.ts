import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  // Fetch all debits for the year, then split into:
  // - activity: every money-out row for chart visibility
  // - spend: rows that count toward expense totals
  const { data, error } = await supabase
    .from('transactions')
    .select('date, amount, category, type, statement_month, card_holder')
    .eq('statement_year', year)
    .eq('type', 'debit')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const excludedFromSpend = new Set(['Transfer', 'Rewards', 'Investments'])

  const byMonth: Record<string, {
    total: number
    byCategory: Record<string, number>
    byHolder: Record<'self' | 'spouse', number>
  }> = {}

  const spendByMonth: Record<string, {
    total: number
    byCategory: Record<string, number>
    byHolder: Record<'self' | 'spouse', number>
  }> = {}

  for (const tx of data ?? []) {
    const key = `${year}-${String(tx.statement_month).padStart(2, '0')}`
    if (!byMonth[key]) byMonth[key] = { total: 0, byCategory: {}, byHolder: { self: 0, spouse: 0 } }
    byMonth[key].total += tx.amount
    byMonth[key].byCategory[tx.category] = (byMonth[key].byCategory[tx.category] ?? 0) + tx.amount
    byMonth[key].byHolder[tx.card_holder as 'self' | 'spouse'] =
      (byMonth[key].byHolder[tx.card_holder as 'self' | 'spouse'] ?? 0) + tx.amount

    if (!excludedFromSpend.has(tx.category)) {
      if (!spendByMonth[key]) spendByMonth[key] = { total: 0, byCategory: {}, byHolder: { self: 0, spouse: 0 } }
      spendByMonth[key].total += tx.amount
      spendByMonth[key].byCategory[tx.category] = (spendByMonth[key].byCategory[tx.category] ?? 0) + tx.amount
      spendByMonth[key].byHolder[tx.card_holder as 'self' | 'spouse'] =
        (spendByMonth[key].byHolder[tx.card_holder as 'self' | 'spouse'] ?? 0) + tx.amount
    }
  }

  // Category totals across the year
  const byCategory: Record<string, number> = {}
  const spendByCategory: Record<string, number> = {}
  const byHolder: Record<'self' | 'spouse', number> = { self: 0, spouse: 0 }
  const spendByHolder: Record<'self' | 'spouse', number> = { self: 0, spouse: 0 }
  for (const tx of data ?? []) {
    byCategory[tx.category] = (byCategory[tx.category] ?? 0) + tx.amount
    byHolder[tx.card_holder as 'self' | 'spouse'] += tx.amount
    if (!excludedFromSpend.has(tx.category)) {
      spendByCategory[tx.category] = (spendByCategory[tx.category] ?? 0) + tx.amount
      spendByHolder[tx.card_holder as 'self' | 'spouse'] += tx.amount
    }
  }

  const annualTotal = Object.values(spendByCategory).reduce((a, b) => a + b, 0)
  const annualActivityTotal = Object.values(byCategory).reduce((a, b) => a + b, 0)

  return NextResponse.json({
    byMonth,
    spendByMonth,
    byCategory,
    spendByCategory,
    byHolder,
    spendByHolder,
    annualTotal,
    annualActivityTotal,
    year,
  })
}

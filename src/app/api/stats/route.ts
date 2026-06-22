import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

const CACHE = 'private, max-age=60, stale-while-revalidate=300'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()))

  const { data, error } = await supabase.rpc('get_annual_stats', { p_year: year })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const excludedFromSpend = new Set(['Transfer', 'Rewards', 'Investments'])

  const byMonth: Record<string, {
    total: number
    byCategory: Record<string, number>
    byHolder: Record<'self' | 'spouse', number>
    byCategoryHolder: Record<string, Record<'self' | 'spouse', number>>
  }> = {}

  const spendByMonth: Record<string, {
    total: number
    byCategory: Record<string, number>
    byHolder: Record<'self' | 'spouse', number>
  }> = {}

  const byCategory: Record<string, number> = {}
  const spendByCategory: Record<string, number> = {}
  const byHolder: Record<'self' | 'spouse', number> = { self: 0, spouse: 0 }
  const spendByHolder: Record<'self' | 'spouse', number> = { self: 0, spouse: 0 }

  for (const row of (data ?? [])) {
    const key = `${year}-${String(row.statement_month).padStart(2, '0')}`
    const holder = (row.card_holder === 'spouse' ? 'spouse' : 'self') as 'self' | 'spouse'
    const total = Number(row.total)

    if (!byMonth[key]) byMonth[key] = { total: 0, byCategory: {}, byHolder: { self: 0, spouse: 0 }, byCategoryHolder: {} }
    byMonth[key].total += total
    byMonth[key].byCategory[row.category] = (byMonth[key].byCategory[row.category] ?? 0) + total
    byMonth[key].byHolder[holder] += total
    if (!byMonth[key].byCategoryHolder[row.category]) byMonth[key].byCategoryHolder[row.category] = { self: 0, spouse: 0 }
    byMonth[key].byCategoryHolder[row.category][holder] += total

    byCategory[row.category] = (byCategory[row.category] ?? 0) + total
    byHolder[holder] += total

    if (!excludedFromSpend.has(row.category)) {
      if (!spendByMonth[key]) spendByMonth[key] = { total: 0, byCategory: {}, byHolder: { self: 0, spouse: 0 } }
      spendByMonth[key].total += total
      spendByMonth[key].byCategory[row.category] = (spendByMonth[key].byCategory[row.category] ?? 0) + total
      spendByMonth[key].byHolder[holder] += total

      spendByCategory[row.category] = (spendByCategory[row.category] ?? 0) + total
      spendByHolder[holder] += total
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
  }, { headers: { 'Cache-Control': CACHE } })
}

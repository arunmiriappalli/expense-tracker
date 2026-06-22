import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export interface MonthlySummaryRow {
  year: number
  month: number
  spendSelf: number
  spendSpouse: number
  investSelf: number
  investSpouse: number
}

export async function GET() {
  const { data, error } = await supabase.rpc('get_monthly_summary')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows: MonthlySummaryRow[] = (data ?? []).map((r: {
    year: number; month: number;
    spend_self: number; spend_spouse: number;
    invest_self: number; invest_spouse: number;
  }) => ({
    year: r.year,
    month: r.month,
    spendSelf: Number(r.spend_self),
    spendSpouse: Number(r.spend_spouse),
    investSelf: Number(r.invest_self),
    investSpouse: Number(r.invest_spouse),
  }))

  return NextResponse.json(rows)
}

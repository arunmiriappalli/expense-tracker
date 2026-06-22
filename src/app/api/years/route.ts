import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET() {
  const { data, error } = await supabase.rpc('get_monthly_summary')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const years = [...new Set((data ?? []).map((r: { year: number }) => r.year))].sort() as number[]
  return NextResponse.json(years)
}

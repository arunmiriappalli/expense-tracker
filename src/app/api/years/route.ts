import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET() {
  const { data, error } = await supabase.rpc('get_distinct_years')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(
    (data ?? []).map((r: { yr: number }) => r.yr),
    { headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=300' } }
  )
}

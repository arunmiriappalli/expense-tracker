import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase/client'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const year = searchParams.get('year')
  const month = searchParams.get('month')
  const category = searchParams.get('category')
  const type = searchParams.get('type')

  let query = supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })

  if (year) query = query.eq('statement_year', parseInt(year))
  if (month) query = query.eq('statement_month', parseInt(month))
  if (category) query = query.eq('category', category)
  if (type) query = query.eq('type', type)

  const { data, error } = await query.limit(500)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

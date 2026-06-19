import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPdf } from '@/lib/pdf'
import { parseStatement } from '@/lib/parsers'
import { supabase } from '@/lib/supabase/client'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const buffer = await file.arrayBuffer()
  const text = await extractTextFromPdf(buffer)

  const result = parseStatement(text)
  if (!result) {
    return NextResponse.json({ error: 'Unrecognized statement format' }, { status: 422 })
  }

  const { transactions, source } = result

  // Derive statement month/year from transactions dates
  const dates = transactions.map(t => t.date).sort()
  const refDate = new Date(dates[dates.length - 1] ?? new Date().toISOString())
  const statementMonth = refDate.getMonth() + 1
  const statementYear = refDate.getFullYear()

  const rows = transactions.map(t => ({
    date: t.date,
    description: t.description,
    amount: t.amount,
    type: t.type,
    category: t.category,
    source: t.source,
    source_file_name: file.name,
    card_holder: t.cardHolder,
    statement_month: statementMonth,
    statement_year: statementYear,
  }))

  // Upsert — skip duplicates silently
  const { error, data } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'date,amount,description,source', ignoreDuplicates: true })
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    source,
    parsed: transactions.length,
    inserted: data?.length ?? 0,
  })
}

import { NextRequest, NextResponse } from 'next/server'
import { extractTextFromPdf } from '@/lib/pdf'
import { parseStatement } from '@/lib/parsers'
import { upsertTransactions } from '@/lib/db/upsertTransactions'

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
  const { inserted, error } = await upsertTransactions(transactions, file.name)

  if (error) return NextResponse.json({ error }, { status: 500 })

  return NextResponse.json({ source, parsed: transactions.length, inserted })
}

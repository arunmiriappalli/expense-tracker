import { ParsedTransaction } from '@/types'
import { supabase } from '@/lib/supabase/client'

export async function upsertTransactions(
  transactions: ParsedTransaction[],
  sourceFileName: string,
): Promise<{ inserted: number; error?: string }> {
  const dates = transactions.map(t => t.date).sort()
  const refDate = new Date(dates[dates.length - 1] ?? new Date().toISOString())
  const statementMonth = refDate.getMonth() + 1
  const statementYear = refDate.getFullYear()

  const seen = new Set<string>()
  const rows = transactions
    .map(t => ({
      date: t.date,
      description: t.description.slice(0, 800),
      amount: t.amount,
      type: t.type,
      category: t.category,
      source: t.source,
      source_file_name: sourceFileName,
      card_holder: t.cardHolder,
      statement_month: statementMonth,
      statement_year: statementYear,
    }))
    .filter(r => {
      const key = `${r.date}|${r.amount}|${r.description}|${r.source}`
      if (seen.has(key)) return false
      seen.add(key); return true
    })

  const { data, error } = await supabase
    .from('transactions')
    .upsert(rows, { onConflict: 'date,amount,description,source', ignoreDuplicates: false })
    .select('id')

  if (error) return { inserted: 0, error: error.message }
  return { inserted: data?.length ?? 0 }
}

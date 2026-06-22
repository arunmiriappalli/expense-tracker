import { ParsedTransaction } from '@/types'
import { categorize } from '@/lib/categorize'
import { pa, toIsoDate } from './utils'

// pdfjs produces one item per line; each transaction spans 3-4 lines:
//   DD/MM/YYYY
//   DESCRIPTION
//   [MERCHANT CATEGORY]  ← optional
//   AMOUNT Dr|Cr
// Table header ("Date" / "Transaction Details" / ...) repeats on every page.

const DATE_LINE = /^\d{2}\/\d{2}\/\d{4}$/
const AMOUNT_LINE = /^([\d,]+\.\d{2})\s*(Dr|Cr)$/i // case-insensitive; space before Dr/Cr optional
const STOP = /^-+End of the Statement/i

function cleanDesc(raw: string): string {
  return raw
    .replace(/^UPI_/i, '')
    .replace(/\s+IND\s*-\s*Ref\s+No\s*:\s*\S*\s*$/i, '')
    .replace(/\s*-\s*Ref\s+No\s*:\s*\S*\s*$/i, '')
    .replace(/\s+IND\s*$/i, '')
    .replace(/-\d{15,}-\d{15,}\s*$/, '')
    .trim()
}

export function parseYesKlickCC(text: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  let inTable = false
  let sawDateHeader = false
  let state: 'idle' | 'got_date' | 'got_desc' | 'got_cat' = 'idle'
  let txDate = ''
  let txDesc = ''

  for (const line of lines) {
    if (STOP.test(line)) { inTable = false; state = 'idle'; continue }

    // Detect table header ("Date" → "Transaction Details" in sequence; case-insensitive)
    if (/^date$/i.test(line) && state === 'idle') { sawDateHeader = true; continue }
    if (sawDateHeader) {
      if (/^transaction details$/i.test(line)) inTable = true
      sawDateHeader = false
      continue
    }
    if (/^(Merchant Category|Amount \(Rs\.\)|Amount \(INR\)|Dr\.?\/Cr\.?)$/i.test(line)) continue

    if (!inTable) continue

    if (DATE_LINE.test(line)) {
      txDate = line; txDesc = ''; state = 'got_date'; continue
    }
    if (state === 'idle') continue

    const amtMatch = line.match(AMOUNT_LINE)
    if (amtMatch && txDate && txDesc) {
      const description = cleanDesc(txDesc)
      transactions.push({
        date: toIsoDate(txDate),
        description,
        amount: pa(amtMatch[1]),
        type: amtMatch[2] === 'Cr' ? 'credit' : 'debit',
        category: categorize(description),
        source: 'yes_klick_cc',
        cardHolder: 'self',
      })
      state = 'idle'; txDate = ''; txDesc = ''; continue
    }

    if (state === 'got_date') { txDesc = line; state = 'got_desc'; continue }
    // got_desc / got_cat: non-amount lines are category or extra description — skip them
    if (state === 'got_desc') { state = 'got_cat'; continue }
    // got_cat: waiting for amount; ignore anything unexpected
  }

  return transactions
}

import { ParsedTransaction, StatementSource } from '@/types'
import { categorize } from '@/lib/categorize'

// pdfjs produces one item per line; each transaction spans 3-4 lines:
//   DD/MM/YYYY
//   DESCRIPTION
//   [MERCHANT CATEGORY]  ← optional
//   AMOUNT Dr|Cr

const DATE_LINE = /^\d{2}\/\d{2}\/\d{4}$/
const AMOUNT_LINE = /^([\d,]+\.\d{2})\s+(Dr|Cr)$/
const STOP = /\*{4}\s*End of Statement|Schedule of charges|^CASHBACK DETAILS/i

function toIsoDate(d: string): string {
  const [dd, mm, yyyy] = d.split('/')
  return `${yyyy}-${mm}-${dd}`
}

function pa(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

function cleanDesc(raw: string): string {
  return raw
    .replace(/^RAZ\*/i, '')
    .replace(/,\s*[A-Z][A-Z ]+$/, '')
    .replace(/\s+IND$/i, '')
    .trim()
}

export function parseAxisCC(text: string, source: StatementSource): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  let inTable = false
  let state: 'idle' | 'got_date' | 'got_desc' | 'got_cat' = 'idle'
  let txDate = ''
  let txDesc = ''

  for (const line of lines) {
    if (STOP.test(line)) { inTable = false; state = 'idle'; continue }
    if (line === 'Account Summary') { inTable = true; continue }
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
        source,
        cardHolder: 'self',
      })
      state = 'idle'; txDate = ''; txDesc = ''; continue
    }

    if (state === 'got_date') { txDesc = line; state = 'got_desc'; continue }
    if (state === 'got_desc') { state = 'got_cat'; continue }
    // got_cat: waiting for amount line (already handled above); ignore unexpected extras
  }

  return transactions
}

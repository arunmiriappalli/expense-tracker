import { ParsedTransaction } from '@/types'
import { categorize } from '@/lib/categorize'

// pdfjs produces one item per line; transaction section layout:
//   "Opening Balance"
//   OPENING_BALANCE_VALUE
//   DD-MM-YYYY
//   DESCRIPTION
//   AMOUNT
//   BALANCE
//   ... (repeating)
//   "Closing Balance"
// Direction (credit/debit) is derived from balance delta vs previous balance.

const DATE_LINE = /^\d{2}-\d{2}-\d{4}$/
const NUMBER_LINE = /^[\d,]+\.\d{2}$/

function toIsoDate(d: string): string {
  const [dd, mm, yyyy] = d.split('-')
  return `${yyyy}-${mm}-${dd}`
}

function pa(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

function cleanDesc(raw: string): string {
  const upiTo = raw.match(/UPI(?:\s+TRANSFER)?\s+TO\s+(.+?)\s*\(\d+\)/i)
  if (upiTo) return upiTo[1].trim()

  const upiMerchant = raw.match(/UPI\s+TO\s+MERCHANT\s*:\s*(.+?)\s*\(\d+\)/i)
  if (upiMerchant) return upiMerchant[1].trim()

  if (/^SB:.*:INT\.PD/i.test(raw)) return 'Interest Credited'

  return raw.replace(/\s*\(\d{8,}\)\s*$/, '').trim()
}

export function parseAxisBank(text: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  let inTable = false
  let awaitingOpenBal = false
  let prevBalance: number | null = null
  let state: 'idle' | 'got_date' | 'got_desc' | 'got_amount' = 'idle'
  let txDate = ''
  let txDesc = ''
  let txAmount = 0

  for (const line of lines) {
    if (/^Closing Balance/i.test(line) || /^To know your Tariff/i.test(line)) {
      inTable = false; continue
    }

    if (line === 'Opening Balance') { awaitingOpenBal = true; continue }
    if (awaitingOpenBal) {
      if (NUMBER_LINE.test(line)) { prevBalance = pa(line); inTable = true }
      awaitingOpenBal = false; continue
    }

    if (!inTable) continue

    if (DATE_LINE.test(line)) {
      txDate = line; txDesc = ''; txAmount = 0; state = 'got_date'; continue
    }
    if (state === 'idle') continue

    if (state === 'got_date') { txDesc = line; state = 'got_desc'; continue }

    if (state === 'got_desc') {
      if (NUMBER_LINE.test(line)) { txAmount = pa(line); state = 'got_amount' }
      continue
    }

    if (state === 'got_amount') {
      if (NUMBER_LINE.test(line)) {
        const balance = pa(line)
        const type: 'credit' | 'debit' = prevBalance !== null && balance > prevBalance ? 'credit' : 'debit'
        const description = cleanDesc(txDesc)
        transactions.push({
          date: toIsoDate(txDate),
          description,
          amount: txAmount,
          type,
          category: categorize(description),
          source: 'axis_bank',
          cardHolder: 'spouse',
        })
        prevBalance = balance
        state = 'idle'; txDate = ''; txDesc = ''; txAmount = 0
      }
      continue
    }
  }

  return transactions
}

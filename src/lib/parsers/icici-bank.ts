import { ParsedTransaction } from '@/types'
import { categorize } from '@/lib/categorize'

// pdfjs puts each column cell on its own line. A transaction block looks like:
//
//   DD-MM-YYYY
//   [payee name]                ← PARTICULARS line 1
//   UPI/ACH/NEFT details...     ← PARTICULARS line 2+ (multi-line)
//   AMOUNT                      ← DEPOSITS or WITHDRAWALS column (whichever is non-zero)
//   BALANCE                     ← BALANCE column
//
// B/F (balance-forward) entry has only one amount (the opening balance):
//   DD-MM-YYYY
//   B/F
//   BALANCE

const AMOUNT_RE = /^[\d,]+\.\d{2}$/
const DATE_RE = /^\d{2}-\d{2}-\d{4}$/

function pa(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

function toIsoDate(d: string): string {
  const [dd, mm, yyyy] = d.split('-')
  return `${yyyy}-${mm}-${dd}`
}

export function parseIciciBank(text: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  let inTable = false
  let prevBalance: number | null = null

  let txDate = ''
  let descLines: string[] = []
  let amounts: number[] = []

  function flush() {
    if (!txDate) return
    if (descLines.some(l => l === 'B/F')) {
      // Opening balance entry — set prevBalance and do not emit a transaction
      if (amounts.length >= 1) prevBalance = amounts[amounts.length - 1]
      return
    }
    if (amounts.length < 2) return // malformed block — skip
    const balance = amounts[amounts.length - 1]
    const txAmt = amounts[amounts.length - 2]
    const type: 'credit' | 'debit' = prevBalance !== null && balance > prevBalance ? 'credit' : 'debit'
    const description = descLines.join(' ').trim() || 'Unknown'
    transactions.push({
      date: toIsoDate(txDate),
      description,
      amount: txAmt,
      type,
      category: categorize(description),
      source: 'icici_bank',
      cardHolder: 'self',
    })
    prevBalance = balance
  }

  function resetTx() {
    txDate = ''
    descLines = []
    amounts = []
  }

  for (const line of lines) {
    // Enter transaction section on first occurrence
    if (!inTable) {
      if (line.includes('Statement of Transactions in Savings Account')) inTable = true
      continue
    }

    // Repeated page header — flush any open transaction and keep going
    if (line.includes('Statement of Transactions in Savings Account')) {
      flush(); resetTx(); continue
    }

    // Skip column headers and summary lines
    if (/^(DATE|MODE|PARTICULARS|DEPOSITS|WITHDRAWALS|BALANCE)$/.test(line)) continue
    if (/^(Page \d+|ACCOUNT DETAILS|GRAND TOTAL|Account Related)/.test(line)) continue
    if (/^FIXED DEPOSITS/.test(line)) { flush(); resetTx(); inTable = false; continue }
    if (/^Total:/i.test(line)) { flush(); resetTx(); inTable = false; continue }

    // Footer summary section — flush the last real transaction and stop accumulating amounts
    if (/^(Total Withdrawals|Total Deposits|Opening Balance|Closing Balance)/i.test(line)) {
      flush(); resetTx(); continue
    }

    if (DATE_RE.test(line)) {
      flush()
      resetTx()
      txDate = line
      continue
    }

    if (!txDate) continue // haven't started a transaction yet

    if (AMOUNT_RE.test(line)) {
      amounts.push(pa(line))
      continue
    }

    descLines.push(line)
  }

  flush() // emit the last transaction
  return transactions
}

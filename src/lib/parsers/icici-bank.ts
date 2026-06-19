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
// UPI reference lines — hash-like garbage, not useful descriptions
const UPI_OVERFLOW = /^(?:[0-9a-fA-F]{6,}|[A-Z]{2,3}[0-9a-fA-F]{4,}|[A-Za-z0-9]{1,4}\/[0-9a-fA-F]{4,}|[a-z0-9]{8,}\/)/

function pa(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

function toIsoDate(d: string): string {
  const [dd, mm, yyyy] = d.split('-')
  return `${yyyy}-${mm}-${dd}`
}

function isNameLine(line: string): boolean {
  if (UPI_OVERFLOW.test(line)) return false
  if (/^\d+$/.test(line)) return false
  const alpha = (line.match(/[a-zA-Z]/g) || []).length
  return alpha / line.length > 0.3
}

function cleanMode(mode: string): string {
  const billMatch = mode.match(/CC BillPay-(\d+)/i)
  if (billMatch) return `CC Bill Payment (${billMatch[1]})`
  if (/^ACH\//i.test(mode)) return mode.replace(/^ACH\//, '').split('/')[0].trim()
  if (/^NEFT-/i.test(mode)) {
    const parts = mode.split('-')
    return parts.slice(2).join(' ').split('/')[0].trim()
  }
  if (/^MMT\/IMPS/i.test(mode)) {
    return mode.replace(/^MMT\/IMPS\/[\d/]+\//, '').split('/')[0].trim()
  }
  if (/^BIL\/INFT/i.test(mode)) {
    const m = mode.match(/CC BillPay-(\d+)/i)
    return m ? `CC Bill Payment (${m[1]})` : mode.split('/')[2]?.trim() || mode
  }
  return mode.trim()
}

function pickDesc(descLines: string[]): string {
  // Prefer lines that look like actual payee names (high alpha ratio, not UPI overflow)
  // but avoid raw mode strings that start with ACH/NEFT/UPI/BIL/MMT
  const pureNames = descLines.filter(
    l => isNameLine(l) && !/^(ACH\/|NEFT-|UPI\/|BIL\/|MMT\/IMPS)/i.test(l),
  )
  if (pureNames.length > 0) return pureNames[0]
  // Fall back: clean the first desc line (which may be ACH/NEFT/BIL prefix)
  if (descLines.length > 0) return cleanMode(descLines[0])
  return 'Unknown'
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
    const description = pickDesc(descLines)
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
    if (/^(Page \d+|Total:|ACCOUNT DETAILS|FIXED DEPOSITS|GRAND TOTAL|Account Related)/.test(line)) continue

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

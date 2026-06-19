import { ParsedTransaction, StatementSource } from '@/types'
import { categorize } from '@/lib/categorize'

// pdfjs puts each column cell on its own line. A transaction block looks like:
//
//   DD/MM/YYYY          ← Date column
//   NNNNNNNNNNN         ← SerNo. (11-digit)
//   MERCHANT NAME       ← Transaction Details (may wrap to multiple lines)
//   [CITY]              ← wrapped continuation (e.g. "BANGALORE IN" → "BANGALORE" + "IN")
//   N                   ← Reward Points (integer, possibly 0)
//   [#]                 ← Intl.# marker if international (optional)
//   AMOUNT [CR]         ← Amount; " CR" suffix = credit/payment
//
// Card number lines (e.g. "5524XXXXXXXX3109") reset cardHolder.

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/
const SERIAL_RE = /^\d{11}$/
const REWARDS_RE = /^\d{1,5}$/ // reward points: small integer (0–99999)
const AMOUNT_RE = /^([\d,]+\.\d{2})\s*(CR)?$/i
const CARD_RE = /^\d{4}X+\d{4}$/

function pa(s: string): number {
  return parseFloat(s.replace(/,/g, ''))
}

function toIsoDate(d: string): string {
  const [dd, mm, yyyy] = d.split('/')
  return `${yyyy}-${mm}-${dd}`
}

function cleanDesc(raw: string): string {
  return raw
    .replace(/\s+(?:BANGALORE|MUMBAI|DELHI|HYDERABAD|AHMEDABAD|VISAKHAPATNAM|GURGAON|httpswwwe?)\s*$/i, '')
    .replace(/\s+IN\s*$/i, '')
    .trim()
}

export function parseIciciCC(text: string, source: StatementSource): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  let inTable = false
  let sawDateHeader = false
  let cardHolder: 'self' | 'spouse' = 'self'

  // Per-transaction state
  let txDate = ''
  let txSerial = ''
  let txDescLines: string[] = []

  function emit(amount: number, isCredit: boolean) {
    if (!txDate || !txSerial) return
    const raw = txDescLines.join(' ').trim()
    const description = cleanDesc(raw) || 'Unknown'
    transactions.push({
      date: toIsoDate(txDate),
      description,
      amount,
      type: isCredit ? 'credit' : 'debit',
      category: categorize(description),
      source,
      cardHolder,
    })
    txDate = ''; txSerial = ''; txDescLines = []
  }

  for (const line of lines) {
    // Card number line — update cardHolder regardless of table state
    if (CARD_RE.test(line)) {
      cardHolder = line.endsWith('3109') ? 'spouse' : 'self'
      continue
    }

    // Detect table header: "Date" followed immediately by "SerNo."
    if (!inTable) {
      if (/^date$/i.test(line)) { sawDateHeader = true; continue }
      if (sawDateHeader) {
        if (/^serno\.$/i.test(line)) inTable = true
        sawDateHeader = false
        continue
      }
      continue
    }

    // Skip column header lines that repeat on every page
    if (/^(SerNo\.|Transaction Details|Reward\s*Points?|Intl\.|amount|Amount \(in)/i.test(line)) continue
    if (line === '#') continue // Intl. marker standalone

    if (DATE_RE.test(line)) {
      // Starting a new transaction — previous one should have been emitted already
      txDate = line; txSerial = ''; txDescLines = []
      continue
    }

    if (!txDate) continue // not in a transaction

    if (SERIAL_RE.test(line) && !txSerial) {
      txSerial = line; continue
    }

    if (!txSerial) continue // waiting for serial number

    const amtMatch = line.match(AMOUNT_RE)
    if (amtMatch) {
      emit(pa(amtMatch[1]), !!amtMatch[2])
      continue
    }

    if (REWARDS_RE.test(line)) continue // reward points integer — skip

    txDescLines.push(line)
  }

  return transactions
}

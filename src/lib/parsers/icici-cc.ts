import { ParsedTransaction, StatementSource } from '@/types'
import { categorize } from '@/lib/categorize'

// pdfjs puts each column cell on its own line. A transaction block looks like:
//
//   DD/MM/YYYY           ← Date column
//   NNNNNNNNNNN          ← SerNo. (8–12 digits; older statements use 10, newer use 11)
//   MERCHANT NAME        ← Transaction Details (may wrap to multiple lines)
//   [CITY / extra]       ← wrapped continuation
//   N                    ← Reward Points (integer, possibly 0)
//   [FOREIGN_AMT]        ← foreign currency amount for intl. spends (optional)
//   [CURRENCY_CODE]      ← e.g. "SGD", "USD" — may be merged with foreign amt
//   AMOUNT [CR]          ← INR amount; " CR" suffix = credit/payment
//
// "Last amount wins" — if multiple AMOUNT_RE lines appear (international tx with
// a foreign-currency amount before the INR amount), we keep overwriting txAmount
// so the last (INR) figure is used.
//
// Card number lines (e.g. "5524XXXXXXXX3109") inside the table reset cardHolder; ignored outside.

const DATE_RE = /^\d{2}\/\d{2}\/\d{4}$/
const SERIAL_RE = /^\d{8,12}$/       // transaction reference number
const REWARDS_RE = /^\d{1,5}$/       // reward points: small integer (0–99999)
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

  let txDate = ''
  let txSerial = ''
  let txDescLines: string[] = []
  let txAmount = 0
  let txIsCredit = false

  function flush() {
    if (txDate && txSerial && txAmount) {
      const raw = txDescLines.join(' ').trim()
      const description = cleanDesc(raw) || 'Unknown'
      transactions.push({
        date: toIsoDate(txDate),
        description,
        amount: txAmount,
        type: txIsCredit ? 'credit' : 'debit',
        category: categorize(description),
        source,
        cardHolder,
      })
    }
    txDate = ''; txSerial = ''; txDescLines = []; txAmount = 0; txIsCredit = false
  }

  for (const line of lines) {
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

    // End-of-table: credit summary section follows transactions
    if (/^(Credit Limit|Previous Balance|Purchases \/ Charges)/i.test(line)) {
      flush(); inTable = false; continue
    }

    // Card number section separator — flush pending tx and switch card holder
    if (CARD_RE.test(line)) {
      flush()
      cardHolder = line.endsWith('3109') ? 'spouse' : 'self'
      continue
    }

    // Skip column header lines that repeat on every page
    if (/^(SerNo\.|Transaction Details|Reward\s*Points?|Intl\.|amount|Amount \(in)/i.test(line)) continue
    if (line === '#') continue

    if (DATE_RE.test(line)) {
      flush()
      txDate = line
      continue
    }

    if (!txDate) continue

    if (SERIAL_RE.test(line) && !txSerial) {
      txSerial = line; continue
    }

    if (!txSerial) continue

    const amtMatch = line.match(AMOUNT_RE)
    if (amtMatch) {
      // Keep updating — last amount wins (handles foreign amount before INR amount)
      txAmount = pa(amtMatch[1])
      txIsCredit = !!amtMatch[2]
      continue
    }

    if (REWARDS_RE.test(line)) continue

    txDescLines.push(line)
  }

  flush() // emit last pending transaction
  return transactions
}

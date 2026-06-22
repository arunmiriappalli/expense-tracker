import { ParsedTransaction } from '@/types'
import { categorize } from '@/lib/categorize'
import { pa, toIsoDate } from './utils'

// pdfjs produces one item per line; each transaction spans N lines:
//   SI_NUMBER
//   DD-MM-YYYY
//   DESCRIPTION_LINE_1
//   [DESCRIPTION_LINE_2 ...]  ← descriptions wrap across PDF lines
//   AMOUNT                    ← pure decimal number, no label
//   BALANCE Cr
// Opening balance appears in the Summary section AFTER the transactions,
// so we do a pre-scan to find it before parsing.

const DATE_LINE = /^\d{2}-\d{2}-\d{4}$/
const PURE_NUMBER = /^[\d,]+\.\d{2}$/
const BALANCE_LINE = /^([\d,]+\.\d{2})\s+Cr$/
const SI_LINE = /^\d{1,3}$/
const STOP = /^Summary\s*:|^Total\s+Debits|^Total\s+Credits/i
const HEADER_ITEMS = new Set(['SI', 'Date', 'Particulars', 'Chq Num', 'Withdrawal', 'Deposit', 'Balance'])

function cleanDesc(parts: string[]): string {
  const raw = parts.join(' ')

  // UPIAB/REF/CR|DR/NAME/... → first NAME segment
  const upiAb = raw.match(/^UPIAB\/[^/]+\/(?:CR|DR)\/([^/]+)/i)
  if (upiAb) return upiAb[1].trim()

  // UPIAR/REF/CR|DR/NAME/... → first NAME segment
  const upiAr = raw.match(/^UPIAR\/[^/]+\/(?:CR|DR)\/([^/]+)/i)
  if (upiAr) return upiAr[1].trim()

  // IMPS/REF/NAME/BANK → NAME
  const imps = raw.match(/^IMPS\/[^/]+\/([^/]+)\/[A-Z]{2,10}/i)
  if (imps) return imps[1].trim()

  // UPI/REF/NAME → NAME
  const upi = raw.match(/^UPI\/[^/]+\/(.+)/i)
  if (upi) return upi[1].split('/')[0].trim()

  // NEFT/RTGS: BANKREF/COMPANY → COMPANY
  const neft = raw.match(/^(?:NEFT|RTGS)\/[^/]+\/([^/]+)/i)
  if (neft) return neft[1].trim()

  // NACH/ECS/REF/COMPANY → first word of COMPANY (avoids date-stamped cycle suffixes)
  const nach = raw.match(/^NACH\/ECS\/[^/]+\/(\S+)/i)
  if (nach) return nach[1].trim()

  return raw.replace(/\s*\d{6,}\s*$/, '').trim()
}

export function parseUnionBank(text: string): ParsedTransaction[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const transactions: ParsedTransaction[] = []

  // Pre-scan: opening balance is in the Summary section (after transactions)
  let prevBalance: number | null = null
  const obIdx = lines.findIndex(l => /^Opening\s+Balance\s*:$/i.test(l))
  if (obIdx >= 0 && obIdx + 1 < lines.length) {
    const m = lines[obIdx + 1].match(BALANCE_LINE)
    if (m) prevBalance = pa(m[1])
  }

  let inTable = false
  let state: 'idle' | 'collecting' | 'got_amount' = 'idle'
  let txDate = ''
  let txDescParts: string[] = []
  let txAmount = 0

  for (const line of lines) {
    if (STOP.test(line)) { inTable = false; continue }
    if (/^STATEMENT OF ACCOUNT/i.test(line)) { inTable = true; state = 'idle'; continue }
    if (!inTable) continue
    if (HEADER_ITEMS.has(line)) continue

    if (state === 'idle') {
      if (DATE_LINE.test(line)) {
        txDate = line; txDescParts = []; txAmount = 0; state = 'collecting'
      }
      // SI numbers and other non-date lines are skipped
      continue
    }

    if (state === 'collecting') {
      if (PURE_NUMBER.test(line)) {
        txAmount = pa(line); state = 'got_amount'
      } else if (!SI_LINE.test(line) && !BALANCE_LINE.test(line) && !HEADER_ITEMS.has(line)) {
        if (DATE_LINE.test(line)) {
          // Unexpected new date — discard incomplete transaction and start fresh
          txDate = line; txDescParts = []; txAmount = 0
        } else {
          txDescParts.push(line)
        }
      }
      continue
    }

    if (state === 'got_amount') {
      const balMatch = line.match(BALANCE_LINE)
      if (balMatch) {
        const balance = pa(balMatch[1])
        const type: 'credit' | 'debit' = prevBalance !== null && balance > prevBalance ? 'credit' : 'debit'
        const description = cleanDesc(txDescParts)
        transactions.push({
          date: toIsoDate(txDate, '-'),
          description,
          amount: txAmount,
          type,
          category: categorize(description),
          source: 'union_bank',
          cardHolder: 'spouse',
        })
        prevBalance = balance
        state = 'idle'; txDate = ''; txDescParts = []; txAmount = 0
      }
      continue
    }
  }

  return transactions
}

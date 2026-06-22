import { ParsedTransaction } from '@/types'
import { categorize } from '@/lib/categorize'
import { pa, toIsoDate } from './utils'

// pdfjs produces one item per line. Two statement formats exist:
//
// 2026+ format (date-only line):
//   "Opening Balance"
//   BALANCE
//   DD-MM-YYYY
//   DESCRIPTION
//   AMOUNT
//   BALANCE
//
// 2024 format (date+description on same line):
//   "Opening Balance"
//   BALANCE
//   DD-MM-YYYY DESCRIPTION_PART1
//   [optional continuation lines]
//   AMOUNT
//   BALANCE   (may be "BALANCE_VALUEPage N of M" at page breaks)
//
// Direction (credit/debit) is derived from balance delta vs previous balance.

const DATE_ONLY = /^\d{2}-\d{2}-\d{4}$/
const DATE_WITH_DESC = /^(\d{2}-\d{2}-\d{4})\s+(.+)/
const NUMBER_LINE = /^[\d,]+\.\d{2}$/

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

  function emit(balance: number) {
    if (!txDate || !txAmount) return
    const type: 'credit' | 'debit' = prevBalance !== null && balance > prevBalance ? 'credit' : 'debit'
    const description = cleanDesc(txDesc)
    transactions.push({
      date: toIsoDate(txDate, '-'),
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

  for (const line of lines) {
    if (/^Closing Balance/i.test(line) || /^To know your Tariff/i.test(line)) {
      inTable = false; continue
    }

    if (/^Opening Balance/i.test(line)) {
      const inline = line.match(/([\d,]+\.\d{2})/)
      if (inline) { prevBalance = pa(inline[1]); inTable = true }
      else { awaitingOpenBal = true }
      continue
    }
    if (awaitingOpenBal) {
      if (NUMBER_LINE.test(line)) { prevBalance = pa(line); inTable = true }
      awaitingOpenBal = false; continue
    }

    if (!inTable) continue

    // A new date line always starts a fresh transaction (flushes any partial state)
    const dateWithDesc = DATE_WITH_DESC.exec(line)
    if (dateWithDesc) {
      txDate = dateWithDesc[1]; txDesc = dateWithDesc[2]; txAmount = 0; state = 'got_desc'
      continue
    }
    if (DATE_ONLY.test(line)) {
      txDate = line; txDesc = ''; txAmount = 0; state = 'got_date'
      continue
    }

    if (state === 'idle') continue

    if (state === 'got_date') {
      txDesc = line; state = 'got_desc'; continue
    }

    if (state === 'got_desc') {
      if (NUMBER_LINE.test(line)) { txAmount = pa(line); state = 'got_amount' }
      else { txDesc += ' ' + line } // multi-line description continuation
      continue
    }

    if (state === 'got_amount') {
      // Balance may be "1,26,485.61" or "1,48,597.50Page 3 of 6" at page breaks
      const balMatch = line.match(/^([\d,]+\.\d{2})/)
      if (balMatch) emit(pa(balMatch[1]))
      continue
    }
  }

  return transactions
}

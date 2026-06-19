import { ParsedTransaction, StatementSource } from '@/types'
import { parseIciciBank } from './icici-bank'
import { parseIciciCC } from './icici-cc'
import { parseAxisCC } from './axis-cc'
import { parseAxisBank } from './axis-bank'
import { parseUnionBank } from './union-bank'
import { parseYesKlickCC } from './yes-klick-cc'

function detectSource(text: string): StatementSource | null {
  // ── ICICI Bank ──────────────────────────────────────────────────────────────
  if (
    (text.includes('ICICI Bank') || text.includes('ICICIBANK')) &&
    (text.includes('WITHDRAWALS') || text.includes('Withdrawal')) &&
    text.includes('Savings Account')
  ) return 'icici_bank'

  // ── ICICI Credit Cards ───────────────────────────────────────────────────────
  if (text.includes('Amazon Pay') || text.includes('AMAZON PAY')) return 'icici_amazon_cc'
  if (
    text.includes('Emeralde') ||
    text.includes('EPM') ||
    (text.includes('REWARD 360') && text.includes('ICICI'))
  ) return 'icici_epm_cc'
  // Generic ICICI CC fallback (catches other ICICI CC products)
  if (
    (text.includes('INFINITY PAYMENT RECEIVED') || text.includes('SPENDS OVERVIEW')) &&
    text.includes('ICICI')
  ) return 'icici_epm_cc'

  // ── Axis Credit Cards ────────────────────────────────────────────────────────
  if (text.includes('Airtel Axis Bank') || text.includes('AIRTEL AXIS')) return 'axis_airtel_cc'
  if (text.includes('My Zone') || text.includes('MYZONE') || text.includes('MY ZONE')) return 'axis_myzone_cc'
  // Generic Axis CC fallback
  if (
    (text.includes('Axis Bank') || text.includes('AXIS BANK')) &&
    text.includes('DATE') && text.includes('TRANSACTION DETAILS') &&
    (text.includes(' Dr') || text.includes(' Cr'))
  ) return 'axis_airtel_cc'

  // ── Axis Bank Savings ────────────────────────────────────────────────────────
  if (
    (text.includes('Axis Bank') || text.includes('AXIS BANK')) &&
    (text.includes('SB-PRIORITY') || text.includes('SAVINGS ACCOUNT')) &&
    text.includes('Opening Balance')
  ) return 'axis_bank'

  // ── Union Bank ───────────────────────────────────────────────────────────────
  if (
    text.includes('Union Bank') ||
    text.includes('UBIN') ||
    (text.includes('STATEMENT OF ACCOUNT') && text.includes('Withdrawal') && text.includes('Deposit'))
  ) return 'union_bank'

  // ── Yes Bank Klick ───────────────────────────────────────────────────────────
  if (text.includes('YES BANK') || text.includes('Yes Bank') || text.includes('KLICK')) return 'yes_klick_cc'

  return null
}

export function parseStatement(text: string): {
  transactions: ParsedTransaction[]
  source: StatementSource
} | null {
  const source = detectSource(text)
  if (!source) return null

  let transactions: ParsedTransaction[]

  switch (source) {
    case 'icici_bank':
      transactions = parseIciciBank(text)
      break
    case 'icici_amazon_cc':
    case 'icici_epm_cc':
      transactions = parseIciciCC(text, source)
      break
    case 'axis_airtel_cc':
    case 'axis_myzone_cc':
      transactions = parseAxisCC(text, source)
      break
    case 'axis_bank':
      transactions = parseAxisBank(text)
      break
    case 'union_bank':
      transactions = parseUnionBank(text)
      break
    case 'yes_klick_cc':
      transactions = parseYesKlickCC(text)
      break
    default:
      return null
  }

  return { transactions, source }
}

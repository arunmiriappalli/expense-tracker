import { ParsedTransaction, StatementSource } from '@/types'
import { parseIciciBank } from './icici-bank'
import { parseIciciCC } from './icici-cc'
import { parseAxisCC } from './axis-cc'
import { parseAxisBank } from './axis-bank'
import { parseUnionBank } from './union-bank'
import { parseYesKlickCC } from './yes-klick-cc'

function detectSource(text: string, fromEmail?: string): StatementSource | null {
  const from = fromEmail?.toLowerCase().trim()

  // ── Sender-based detection (Gmail sync) ─────────────────────────────────────
  if (from) {
    if (from === 'estatement@icicibank.com' || from === 'estatement@icici.bank.in')
      return 'icici_bank'

    if (from === 'credit_cards@icicibank.com' || from === 'credit_cards@icici.bank.in')
      return (text.includes('Amazon Pay') || text.includes('AMAZON PAY')) ? 'icici_amazon_cc' : 'icici_epm_cc'

    if (from === 'estatement@yesbank.in' || from === 'estatement@yes.bank.in')
      return 'yes_klick_cc'

    if (from === 'statements@axisbank.com' || from === 'statements@axis.bank.in')
      return 'axis_bank'

    if (from === 'cc.statements@axisbank.com' || from === 'cc.statements@axis.bank.in') {
      if (text.includes('Airtel Axis Bank') || text.includes('AIRTEL AXIS')) return 'axis_airtel_cc'
      if (text.includes('My Zone') || text.includes('MYZONE') || text.includes('MY ZONE')) return 'axis_myzone_cc'
      return 'axis_airtel_cc' // generic Axis CC fallback
    }

    if (from === 'noreplyunionbank@unionbankofindia.com' || from === 'noreplyunionbank@ubi.bank.in')
      return 'union_bank'

    // Unknown sender — fall through to text-based detection
  }

  // ── Text-based detection (manual PDF upload fallback) ───────────────────────
  // Savings accounts checked first — their transaction text often contains CC brand
  // names (Amazon Pay UPI, Yes Bank transfers) that would trigger the CC checks.

  if (
    (text.includes('ICICI Bank') || text.includes('ICICIBANK')) &&
    text.includes('Statement of Transactions in Savings Account')
  ) return 'icici_bank'

  if (
    (text.includes('Axis Bank') || text.includes('AXIS BANK')) &&
    (text.includes('SB-PRIORITY') || text.includes('SAVINGS ACCOUNT') || text.includes('Money Quotient')) &&
    text.includes('Opening Balance')
  ) return 'axis_bank'

  if (
    text.includes('Union Bank') ||
    text.includes('UBIN') ||
    (text.includes('STATEMENT OF ACCOUNT') && text.includes('Withdrawal') && text.includes('Deposit'))
  ) return 'union_bank'

  if (text.includes('Amazon Pay') || text.includes('AMAZON PAY')) return 'icici_amazon_cc'
  if (
    text.includes('Emeralde') ||
    text.includes('EPM') ||
    (text.includes('REWARD 360') && text.includes('ICICI'))
  ) return 'icici_epm_cc'
  if (
    (text.includes('INFINITY PAYMENT RECEIVED') || text.includes('SPENDS OVERVIEW')) &&
    text.includes('ICICI')
  ) return 'icici_epm_cc'

  if (text.includes('Airtel Axis Bank') || text.includes('AIRTEL AXIS')) return 'axis_airtel_cc'
  if (text.includes('My Zone') || text.includes('MYZONE') || text.includes('MY ZONE')) return 'axis_myzone_cc'
  if (
    (text.includes('Axis Bank') || text.includes('AXIS BANK')) &&
    text.includes('DATE') && text.includes('TRANSACTION DETAILS') &&
    (text.includes(' Dr') || text.includes(' Cr'))
  ) return 'axis_airtel_cc'

  if (text.includes('YES BANK') || text.includes('Yes Bank') || text.includes('KLICK')) return 'yes_klick_cc'

  return null
}

export function parseStatement(text: string, fromEmail?: string): {
  transactions: ParsedTransaction[]
  source: StatementSource
} | null {
  const source = detectSource(text, fromEmail)
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

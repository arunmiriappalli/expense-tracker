export type TransactionType = 'debit' | 'credit'

export type StatementSource =
  | 'icici_bank'
  | 'icici_amazon_cc'
  | 'icici_epm_cc'
  | 'axis_airtel_cc'
  | 'axis_myzone_cc'
  | 'axis_bank'
  | 'union_bank'
  | 'yes_klick_cc'

export interface ParsedTransaction {
  date: string // YYYY-MM-DD
  description: string
  amount: number
  type: TransactionType
  category: string
  source: StatementSource
  cardHolder: 'self' | 'spouse'
}

export interface Transaction extends ParsedTransaction {
  id: string
  statementMonth: number
  statementYear: number
  createdAt: string
}

export interface MonthlyStats {
  month: string // YYYY-MM
  totalSpend: number
  totalIncome: number
  byCategory: Record<string, number>
}

'use client'

import { useState } from 'react'

interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  type: string
  category: string
  source: string
  source_file_name: string
  card_holder: 'self' | 'spouse'
}

const CATEGORY_COLORS: Record<string, string> = {
  'Food & Dining': 'bg-orange-100 text-orange-700',
  'Groceries': 'bg-green-100 text-green-700',
  'Shopping': 'bg-blue-100 text-blue-700',
  'Travel': 'bg-purple-100 text-purple-700',
  'Utilities': 'bg-yellow-100 text-yellow-700',
  'Housing': 'bg-red-100 text-red-700',
  'Fuel': 'bg-gray-100 text-gray-700',
  'Health': 'bg-pink-100 text-pink-700',
  'Education': 'bg-violet-100 text-violet-700',
  'Entertainment': 'bg-indigo-100 text-indigo-700',
  'Investments': 'bg-teal-100 text-teal-700',
  'Transfer': 'bg-slate-100 text-slate-500',
  'Rewards': 'bg-emerald-100 text-emerald-700',
  'Government': 'bg-stone-100 text-stone-700',
}

const SOURCE_SHORT: Record<string, string> = {
  icici_bank: 'ICICI Bank',
  icici_amazon_cc: 'Amazon CC',
  icici_epm_cc: 'EPM CC',
  axis_airtel_cc: 'Airtel CC',
  axis_myzone_cc: 'MyZone CC',
  axis_bank: 'Axis Bank',
  union_bank: 'Union Bank',
  yes_klick_cc: 'Klick CC',
}

const HOLDER_LABEL: Record<'self' | 'spouse', string> = {
  self: 'Self',
  spouse: 'Spouse',
}

const HOLDER_STYLES: Record<'self' | 'spouse', string> = {
  self: 'bg-slate-100 text-slate-700',
  spouse: 'bg-rose-100 text-rose-700',
}

function trimFileName(fileName: string) {
  if (!fileName) return ''
  return fileName.length > 34 ? `${fileName.slice(0, 31)}...` : fileName
}

function fmt(n: number) {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

function CopyBadge({ fileName }: { fileName: string }) {
  const [copied, setCopied] = useState(false)

  function handleClick() {
    navigator.clipboard.writeText(fileName).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleClick}
      title={fileName}
      className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700 hover:bg-amber-200 transition-colors truncate max-w-40 cursor-pointer"
    >
      {copied ? 'Copied!' : `PDF: ${trimFileName(fileName)}`}
    </button>
  )
}

export function TransactionList({ transactions }: { transactions: Transaction[] }) {
  if (!transactions.length) {
    return <p className="text-center text-gray-400 py-8">No transactions found</p>
  }

  return (
    <div className="divide-y divide-gray-50">
      {transactions.map(tx => (
        <div key={tx.id} className="flex items-start gap-3 py-3 px-1">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 break-words">{tx.description}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{formatDate(tx.date)}</span>
              <span className="text-xs text-gray-300">·</span>
              <span className="text-xs text-gray-400">{SOURCE_SHORT[tx.source] ?? tx.source}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide ${HOLDER_STYLES[tx.card_holder] ?? 'bg-gray-100 text-gray-600'}`}
              >
                {HOLDER_LABEL[tx.card_holder] ?? tx.card_holder}
              </span>
              {tx.source_file_name && (
                <CopyBadge fileName={tx.source_file_name} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[tx.category] ?? 'bg-gray-100 text-gray-600'}`}
            >
              {tx.category}
            </span>
            <span className={`text-sm font-semibold tabular-nums ${tx.type === 'credit' ? 'text-green-600' : 'text-gray-900'}`}>
              {tx.type === 'credit' ? '+' : '-'}₹{fmt(tx.amount)}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

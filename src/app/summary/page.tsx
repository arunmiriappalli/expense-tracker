'use client'

import { useState, useEffect } from 'react'
import type { MonthlySummaryRow } from '@/app/api/summary/route'
import { fmt, MONTHS } from '@/lib/utils'

export default function SummaryPage() {
  const [rows, setRows] = useState<MonthlySummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'Summary · Spends' }, [])

  useEffect(() => {
    fetch('/api/summary')
      .then(r => r.json())
      .then(data => { setRows(data); setLoading(false) })
  }, [])

  const totals = rows.reduce(
    (acc, r) => ({
      spendSelf: acc.spendSelf + r.spendSelf,
      spendSpouse: acc.spendSpouse + r.spendSpouse,
      investSelf: acc.investSelf + r.investSelf,
      investSpouse: acc.investSpouse + r.investSpouse,
    }),
    { spendSelf: 0, spendSpouse: 0, investSelf: 0, investSpouse: 0 }
  )

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-gray-900">Monthly Summary</h1>

      {loading ? (
        <p className="text-center text-gray-400 py-8 text-sm">Loading…</p>
      ) : (
        <div className="bg-white rounded-2xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="text-left px-4 py-3 font-medium">Month</th>
                  <th className="text-right px-3 py-3 font-medium">Self</th>
                  <th className="text-right px-3 py-3 font-medium">Wife</th>
                  <th className="text-right px-3 py-3 font-medium">Total</th>
                  <th className="text-right px-3 py-3 font-medium">Invest Self</th>
                  <th className="text-right px-4 py-3 font-medium">Invest Wife</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map(r => {
                  const total = r.spendSelf + r.spendSpouse
                  return (
                    <tr key={`${r.year}-${r.month}`} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-700 font-medium whitespace-nowrap">
                        {MONTHS[r.month - 1]} {r.year}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">
                        {fmt(r.spendSelf)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">
                        {fmt(r.spendSpouse)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">
                        {fmt(total)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-teal-700">
                        {fmt(r.investSelf)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-teal-600">
                        {fmt(r.investSpouse)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmt(totals.spendSelf)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-rose-700">{fmt(totals.spendSpouse)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-gray-900">{fmt(totals.spendSelf + totals.spendSpouse)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-teal-700">{fmt(totals.investSelf)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-teal-600">{fmt(totals.investSpouse)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

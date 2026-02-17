'use client'

import { useState } from 'react'
import { useAccounting } from './AccountingContext'
import { formatCurrency, formatDate, ACCOUNT_TYPE_INFO } from './types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Download, Scale, AlertCircle, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export function BalanceSheet() {
  const { getBalanceSheet } = useAccounting()
  const [asOf, setAsOf] = useState(new Date().toISOString().split('T')[0])

  const data = getBalanceSheet(asOf)
  const isBalanced =
    Math.abs(data.totalAssets - (data.totalLiabilities + data.totalEquity)) <
    0.01

  const handleExport = () => {
    let csv = `Balance Sheet as of ${formatDate(asOf)}\n\n`

    csv += 'ASSETS\n'
    csv += 'Account Code,Account Name,Balance\n'
    for (const item of data.assets) {
      csv += `"${item.account.code}","${item.account.name}","${item.balance}"\n`
    }
    csv += `"","Total Assets","${data.totalAssets}"\n\n`

    csv += 'LIABILITIES\n'
    csv += 'Account Code,Account Name,Balance\n'
    for (const item of data.liabilities) {
      csv += `"${item.account.code}","${item.account.name}","${item.balance}"\n`
    }
    csv += `"","Total Liabilities","${data.totalLiabilities}"\n\n`

    csv += 'EQUITY\n'
    csv += 'Account Code,Account Name,Balance\n'
    for (const item of data.equity) {
      csv += `"${item.account.code}","${item.account.name}","${item.balance}"\n`
    }
    csv += `"","Total Equity","${data.totalEquity}"\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `balance-sheet-${asOf}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Balance sheet exported')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
            <Scale className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 font-mono">
              Balance Sheet
            </h2>
            <p className="text-sm text-slate-500">
              Assets = Liabilities + Equity
            </p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date Selector */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
        <Label htmlFor="as-of" className="text-sm font-medium">
          As of:
        </Label>
        <Input
          id="as-of"
          type="date"
          value={asOf}
          onChange={(e) => setAsOf(e.target.value)}
          className="w-48 bg-white"
        />
        <div
          className={cn(
            'ml-auto flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium',
            isBalanced
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700',
          )}
        >
          {isBalanced ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Balanced
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4" />
              Out of Balance
            </>
          )}
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Report Header */}
          <div className="text-center py-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-900">
              Balance Sheet
            </h3>
            <p className="text-sm text-slate-500">As of {formatDate(asOf)}</p>
          </div>

          <div className="p-6 space-y-8">
            {/* Assets Section */}
            <section>
              <h4
                className={cn(
                  'text-sm font-semibold uppercase tracking-wider mb-4',
                  ACCOUNT_TYPE_INFO.asset.color,
                )}
              >
                Assets
              </h4>
              {data.assets.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No asset balances
                </p>
              ) : (
                <div className="space-y-2">
                  {data.assets.map((item) => (
                    <div
                      key={item.account.id}
                      className="flex items-center justify-between py-2 border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-slate-400 w-12">
                          {item.account.code}
                        </span>
                        <span className="text-sm text-slate-700">
                          {item.account.name}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-slate-200">
                <span className="font-semibold text-slate-900">
                  Total Assets
                </span>
                <span className="font-mono text-lg font-bold text-blue-600">
                  {formatCurrency(data.totalAssets)}
                </span>
              </div>
            </section>

            {/* Liabilities Section */}
            <section>
              <h4
                className={cn(
                  'text-sm font-semibold uppercase tracking-wider mb-4',
                  ACCOUNT_TYPE_INFO.liability.color,
                )}
              >
                Liabilities
              </h4>
              {data.liabilities.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No liability balances
                </p>
              ) : (
                <div className="space-y-2">
                  {data.liabilities.map((item) => (
                    <div
                      key={item.account.id}
                      className="flex items-center justify-between py-2 border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-slate-400 w-12">
                          {item.account.code}
                        </span>
                        <span className="text-sm text-slate-700">
                          {item.account.name}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-slate-200">
                <span className="font-semibold text-slate-900">
                  Total Liabilities
                </span>
                <span className="font-mono text-lg font-bold text-purple-600">
                  {formatCurrency(data.totalLiabilities)}
                </span>
              </div>
            </section>

            {/* Equity Section */}
            <section>
              <h4
                className={cn(
                  'text-sm font-semibold uppercase tracking-wider mb-4',
                  ACCOUNT_TYPE_INFO.equity.color,
                )}
              >
                Equity
              </h4>
              {data.equity.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No equity balances
                </p>
              ) : (
                <div className="space-y-2">
                  {data.equity.map((item) => (
                    <div
                      key={item.account.id}
                      className="flex items-center justify-between py-2 border-b border-slate-100"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-slate-400 w-12">
                          {item.account.code}
                        </span>
                        <span className="text-sm text-slate-700">
                          {item.account.name}
                        </span>
                      </div>
                      <span className="font-mono text-sm font-medium text-slate-900">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-slate-200">
                <span className="font-semibold text-slate-900">
                  Total Equity
                </span>
                <span className="font-mono text-lg font-bold text-indigo-600">
                  {formatCurrency(data.totalEquity)}
                </span>
              </div>
            </section>

            {/* Summary */}
            <section className="bg-slate-50 -mx-6 -mb-6 px-6 py-6 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  Total Liabilities + Equity
                </span>
                <span className="font-mono text-lg font-bold text-slate-900">
                  {formatCurrency(data.totalLiabilities + data.totalEquity)}
                </span>
              </div>
              {!isBalanced && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg flex items-center gap-2 text-red-700">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm">
                    Balance sheet is out of balance by{' '}
                    {formatCurrency(
                      Math.abs(
                        data.totalAssets -
                          (data.totalLiabilities + data.totalEquity),
                      ),
                    )}
                  </span>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

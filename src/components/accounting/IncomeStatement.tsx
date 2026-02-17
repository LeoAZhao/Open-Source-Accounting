'use client'

import { useState } from 'react'
import { useAccounting } from './AccountingContext'
import { formatCurrency, formatDate, ACCOUNT_TYPE_INFO } from './types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Download,
  BarChart3,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { toast } from 'sonner'

export function IncomeStatement() {
  const { getIncomeStatement } = useAccounting()

  // Default to current month
  const now = new Date()
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split('T')[0]
  const today = now.toISOString().split('T')[0]

  const [startDate, setStartDate] = useState(firstOfMonth)
  const [endDate, setEndDate] = useState(today)

  const data = getIncomeStatement(startDate, endDate)
  const profitMargin =
    data.totalRevenue > 0
      ? ((data.netIncome / data.totalRevenue) * 100).toFixed(1)
      : '0.0'

  const handleExport = () => {
    let csv = `Income Statement\n`
    csv += `Period: ${formatDate(startDate)} to ${formatDate(endDate)}\n\n`

    csv += 'REVENUE\n'
    csv += 'Account Code,Account Name,Amount\n'
    for (const item of data.revenue) {
      csv += `"${item.account.code}","${item.account.name}","${item.balance}"\n`
    }
    csv += `"","Total Revenue","${data.totalRevenue}"\n\n`

    csv += 'EXPENSES\n'
    csv += 'Account Code,Account Name,Amount\n'
    for (const item of data.expenses) {
      csv += `"${item.account.code}","${item.account.name}","${item.balance}"\n`
    }
    csv += `"","Total Expenses","${data.totalExpenses}"\n\n`

    csv += `"","Net Income","${data.netIncome}"\n`

    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `income-statement-${startDate}-to-${endDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Income statement exported')
  }

  const setQuickPeriod = (period: 'month' | 'quarter' | 'year' | 'ytd') => {
    const now = new Date()
    let start: Date
    const end: Date = now

    switch (period) {
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1)
        break
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3)
        start = new Date(now.getFullYear(), quarter * 3, 1)
        break
      case 'year':
        start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate())
        break
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1)
        break
    }

    setStartDate(start.toISOString().split('T')[0])
    setEndDate(end.toISOString().split('T')[0])
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 font-mono">
              Income Statement
            </h2>
            <p className="text-sm text-slate-500">Profit & Loss Report</p>
          </div>
        </div>
        <Button variant="outline" onClick={handleExport}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Date Selector */}
      <div className="flex items-center gap-4 mb-6 p-4 bg-slate-50 rounded-lg flex-wrap">
        <div className="flex items-center gap-2">
          <Label
            htmlFor="start-date"
            className="text-sm font-medium whitespace-nowrap"
          >
            From:
          </Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40 bg-white"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label
            htmlFor="end-date"
            className="text-sm font-medium whitespace-nowrap"
          >
            To:
          </Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40 bg-white"
          />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-slate-500">Quick:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickPeriod('month')}
          >
            Month
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickPeriod('quarter')}
          >
            Quarter
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickPeriod('ytd')}
          >
            YTD
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setQuickPeriod('year')}
          >
            12 Mo
          </Button>
        </div>
      </div>

      {/* Report Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          {/* Report Header */}
          <div className="text-center py-6 border-b border-slate-200 bg-slate-50">
            <h3 className="text-lg font-semibold text-slate-900">
              Income Statement
            </h3>
            <p className="text-sm text-slate-500">
              {formatDate(startDate)} — {formatDate(endDate)}
            </p>
          </div>

          <div className="p-6 space-y-8">
            {/* Revenue Section */}
            <section>
              <h4
                className={cn(
                  'text-sm font-semibold uppercase tracking-wider mb-4',
                  ACCOUNT_TYPE_INFO.revenue.color,
                )}
              >
                Revenue
              </h4>
              {data.revenue.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No revenue recorded
                </p>
              ) : (
                <div className="space-y-2">
                  {data.revenue.map((item) => (
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
                      <span className="font-mono text-sm font-medium text-emerald-600">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-slate-200">
                <span className="font-semibold text-slate-900">
                  Total Revenue
                </span>
                <span className="font-mono text-lg font-bold text-emerald-600">
                  {formatCurrency(data.totalRevenue)}
                </span>
              </div>
            </section>

            {/* Expenses Section */}
            <section>
              <h4
                className={cn(
                  'text-sm font-semibold uppercase tracking-wider mb-4',
                  ACCOUNT_TYPE_INFO.expense.color,
                )}
              >
                Expenses
              </h4>
              {data.expenses.length === 0 ? (
                <p className="text-sm text-slate-400 italic">
                  No expenses recorded
                </p>
              ) : (
                <div className="space-y-2">
                  {data.expenses.map((item) => (
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
                      <span className="font-mono text-sm font-medium text-amber-600">
                        {formatCurrency(item.balance)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between mt-4 pt-4 border-t-2 border-slate-200">
                <span className="font-semibold text-slate-900">
                  Total Expenses
                </span>
                <span className="font-mono text-lg font-bold text-amber-600">
                  {formatCurrency(data.totalExpenses)}
                </span>
              </div>
            </section>

            {/* Net Income Summary */}
            <section className="bg-slate-50 -mx-6 -mb-6 px-6 py-6 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-lg text-slate-900">
                    Net Income
                  </span>
                  {data.netIncome > 0 ? (
                    <TrendingUp className="w-5 h-5 text-emerald-500" />
                  ) : data.netIncome < 0 ? (
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  ) : (
                    <Minus className="w-5 h-5 text-slate-400" />
                  )}
                </div>
                <span
                  className={cn(
                    'font-mono text-2xl font-bold',
                    data.netIncome > 0
                      ? 'text-emerald-600'
                      : data.netIncome < 0
                        ? 'text-red-600'
                        : 'text-slate-600',
                  )}
                >
                  {formatCurrency(data.netIncome)}
                </span>
              </div>

              {data.totalRevenue > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Profit Margin</span>
                    <span
                      className={cn(
                        'font-mono font-medium',
                        parseFloat(profitMargin) > 0
                          ? 'text-emerald-600'
                          : parseFloat(profitMargin) < 0
                            ? 'text-red-600'
                            : 'text-slate-600',
                      )}
                    >
                      {profitMargin}%
                    </span>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

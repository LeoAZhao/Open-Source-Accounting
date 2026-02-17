'use client'

import { useMemo } from 'react'
import { useAccounting } from './AccountingContext'
import { formatCurrency, formatDate, calculateAccountBalance } from './types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Receipt,
  AlertTriangle,
  ArrowRight,
  Plus,
  Scale,
  Wallet,
  CreditCard,
} from 'lucide-react'

interface DashboardProps {
  onNavigate: (
    section: 'transactions' | 'accounts' | 'balance-sheet' | 'income-statement',
  ) => void
  onNewTransaction: () => void
}

export function Dashboard({ onNavigate, onNewTransaction }: DashboardProps) {
  const { accounts, transactions, getBalanceSheet, getIncomeStatement, dataVersion } =
    useAccounting()

  const stats = useMemo(() => {
    const now = new Date()
    const today = now.toISOString().split('T')[0]
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split('T')[0]
    const firstOfYear = new Date(now.getFullYear(), 0, 1)
      .toISOString()
      .split('T')[0]

    const balanceSheet = getBalanceSheet(today)
    const monthlyPL = getIncomeStatement(firstOfMonth, today)
    const yearlyPL = getIncomeStatement(firstOfYear, today)

    // Posted/reversed only for reports (exclude draft and voided)
    const postedOrReversed = transactions.filter(
      (t) => t.status === 'posted' || t.status === 'reversed',
    )

    // Get recent transactions (posted only)
    const recentTransactions = [...transactions]
      .filter((t) => t.status === 'posted')
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate))
      .slice(0, 5)

    // Calculate cash position (sum of cash and bank accounts)
    const cashAccounts = accounts.filter(
      (a) =>
        a.type === 'asset' &&
        (a.subtype === 'cash' || a.subtype === 'bank') &&
        a.isActive,
    )
    const cashBalance = cashAccounts.reduce((sum, acc) => {
      return (
        sum +
        calculateAccountBalance(acc, postedOrReversed)
      )
    }, 0)

    // Calculate receivables (posted only)
    const receivableAccounts = accounts.filter(
      (a) =>
        a.type === 'asset' && a.subtype === 'accounts_receivable' && a.isActive,
    )
    const receivablesBalance = receivableAccounts.reduce(
      (sum, acc) => sum + calculateAccountBalance(acc, postedOrReversed),
      0,
    )

    // Calculate payables (posted only)
    const payableAccounts = accounts.filter(
      (a) =>
        a.type === 'liability' &&
        a.subtype === 'accounts_payable' &&
        a.isActive,
    )
    const payablesBalance = payableAccounts.reduce((sum, acc) => {
      return (
        sum +
        calculateAccountBalance(acc, postedOrReversed)
      )
    }, 0)

    // Count transactions this month
    const monthlyTransactionCount = transactions.filter(
      (t) => t.transactionDate >= firstOfMonth && t.status === 'posted',
    ).length

    return {
      balanceSheet,
      monthlyPL,
      yearlyPL,
      recentTransactions,
      cashBalance,
      receivablesBalance,
      payablesBalance,
      monthlyTransactionCount,
      totalAccounts: accounts.length,
      activeAccounts: accounts.filter((a) => a.isActive).length,
    }
  }, [accounts, transactions, getBalanceSheet, getIncomeStatement, dataVersion])

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 font-mono">
            Dashboard
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Financial overview as of {formatDate(new Date().toISOString())}
          </p>
        </div>
        <Button
          onClick={onNewTransaction}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          New Transaction
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Cash Position"
          value={formatCurrency(stats.cashBalance)}
          icon={Wallet}
          trend={stats.cashBalance >= 0 ? 'positive' : 'negative'}
          subtitle="Cash & Bank"
        />
        <MetricCard
          title="Net Income (MTD)"
          value={formatCurrency(stats.monthlyPL.netIncome)}
          icon={stats.monthlyPL.netIncome >= 0 ? TrendingUp : TrendingDown}
          trend={stats.monthlyPL.netIncome >= 0 ? 'positive' : 'negative'}
          subtitle="This month"
        />
        <MetricCard
          title="Receivables"
          value={formatCurrency(stats.receivablesBalance)}
          icon={DollarSign}
          trend="neutral"
          subtitle="Outstanding"
        />
        <MetricCard
          title="Payables"
          value={formatCurrency(stats.payablesBalance)}
          icon={CreditCard}
          trend="neutral"
          subtitle="Outstanding"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Balance Sheet Summary */}
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Balance Sheet
              </CardTitle>
              <Scale className="w-4 h-4 text-slate-400" />
            </div>
            <CardDescription>Current position</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Total Assets</span>
                <span className="font-mono font-semibold text-blue-600">
                  {formatCurrency(stats.balanceSheet.totalAssets)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">
                  Total Liabilities
                </span>
                <span className="font-mono font-semibold text-purple-600">
                  {formatCurrency(stats.balanceSheet.totalLiabilities)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">Total Equity</span>
                <span className="font-mono font-semibold text-indigo-600">
                  {formatCurrency(stats.balanceSheet.totalEquity)}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-4 text-slate-500"
              onClick={() => onNavigate('balance-sheet')}
            >
              View Full Report
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Income Statement Summary */}
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Income Statement
              </CardTitle>
              {stats.yearlyPL.netIncome >= 0 ? (
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              ) : (
                <TrendingDown className="w-4 h-4 text-red-500" />
              )}
            </div>
            <CardDescription>Year to date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Revenue</span>
                <span className="font-mono font-semibold text-emerald-600">
                  {formatCurrency(stats.yearlyPL.totalRevenue)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Expenses</span>
                <span className="font-mono font-semibold text-amber-600">
                  {formatCurrency(stats.yearlyPL.totalExpenses)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-medium text-slate-900">
                  Net Income
                </span>
                <span
                  className={cn(
                    'font-mono font-bold',
                    stats.yearlyPL.netIncome >= 0
                      ? 'text-emerald-600'
                      : 'text-red-600',
                  )}
                >
                  {formatCurrency(stats.yearlyPL.netIncome)}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-4 text-slate-500"
              onClick={() => onNavigate('income-statement')}
            >
              View Full Report
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Activity
              </CardTitle>
              <Receipt className="w-4 h-4 text-slate-400" />
            </div>
            <CardDescription>This month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Transactions</span>
                <span className="font-mono font-semibold text-slate-900">
                  {stats.monthlyTransactionCount}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-sm text-slate-600">Active Accounts</span>
                <span className="font-mono font-semibold text-slate-900">
                  {stats.activeAccounts}
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-slate-600">Total Accounts</span>
                <span className="font-mono font-semibold text-slate-900">
                  {stats.totalAccounts}
                </span>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full mt-4 text-slate-500"
              onClick={() => onNavigate('accounts')}
            >
              Manage Accounts
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card className="mt-6">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold">
                Recent Transactions
              </CardTitle>
              <CardDescription>Latest posted entries</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onNavigate('transactions')}
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {stats.recentTransactions.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Receipt className="w-8 h-8 mx-auto mb-2" />
              <p>No transactions yet</p>
              <Button
                variant="link"
                className="text-emerald-600"
                onClick={onNewTransaction}
              >
                Create your first transaction
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.recentTransactions.map((txn) => {
                const total = txn.lines.reduce(
                  (sum, line) => sum + line.debit,
                  0,
                )
                return (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between py-3 px-4 bg-slate-50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-xs text-slate-400">
                        {txn.transactionNumber}
                      </span>
                      <div>
                        <p className="text-sm font-medium text-slate-900">
                          {txn.description}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(txn.transactionDate)}
                        </p>
                      </div>
                    </div>
                    <span className="font-mono font-semibold text-slate-900">
                      {formatCurrency(total)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warnings */}
      {transactions.some((t) => t.status === 'voided') && (
        <Card className="mt-6 border-amber-200 bg-amber-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 text-amber-700">
              <AlertTriangle className="w-5 h-5" />
              <span className="text-sm">
                You have{' '}
                {transactions.filter((t) => t.status === 'voided').length}{' '}
                voided transaction(s). Review them in the transactions list.
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  icon: Icon,
  trend,
  subtitle,
}: {
  title: string
  value: string
  icon: React.ElementType
  trend: 'positive' | 'negative' | 'neutral'
  subtitle: string
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500">{title}</p>
            <p
              className={cn(
                'text-2xl font-mono font-bold mt-1',
                trend === 'positive' && 'text-emerald-600',
                trend === 'negative' && 'text-red-600',
                trend === 'neutral' && 'text-slate-900',
              )}
            >
              {value}
            </p>
            <p className="text-xs text-slate-400 mt-1">{subtitle}</p>
          </div>
          <div
            className={cn(
              'w-10 h-10 rounded-lg flex items-center justify-center',
              trend === 'positive' && 'bg-emerald-100',
              trend === 'negative' && 'bg-red-100',
              trend === 'neutral' && 'bg-slate-100',
            )}
          >
            <Icon
              className={cn(
                'w-5 h-5',
                trend === 'positive' && 'text-emerald-600',
                trend === 'negative' && 'text-red-600',
                trend === 'neutral' && 'text-slate-600',
              )}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

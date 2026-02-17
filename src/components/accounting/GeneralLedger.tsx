'use client'

import { useState, useMemo } from 'react'
import { useAccounting } from './AccountingContext'
import { formatCurrency, formatDate, ACCOUNT_TYPE_INFO } from './types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, Database, FileText } from 'lucide-react'
import { toast } from 'sonner'

export function GeneralLedger() {
  const { accounts, getGeneralLedger, exportToCSV, dataVersion } =
    useAccounting()
  const activeAccounts = accounts
    .filter((a) => a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code))

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    activeAccounts[0]?.id || '',
  )
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId)
  const entries = useMemo(() => {
    if (!selectedAccountId) return []
    return getGeneralLedger(
      selectedAccountId,
      startDate || undefined,
      endDate || undefined,
    )
  }, [selectedAccountId, startDate, endDate, getGeneralLedger, dataVersion])

  const handleExport = () => {
    if (!selectedAccountId) {
      toast.error('Please select an account')
      return
    }
    const csv = exportToCSV('general-ledger', {
      accountId: selectedAccountId,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    })
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `general-ledger-${selectedAccount?.code}-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('General ledger exported')
  }

  const totalDebits = entries.reduce((sum, e) => sum + e.line.debit, 0)
  const totalCredits = entries.reduce((sum, e) => sum + e.line.credit, 0)
  const endingBalance =
    entries.length > 0 ? entries[entries.length - 1].runningBalance : 0

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
            <Database className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 font-mono">
              General Ledger
            </h2>
            <p className="text-sm text-slate-500">
              Account activity and running balance
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={!selectedAccountId}
        >
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-end gap-4 mb-6 p-4 bg-slate-50 rounded-lg">
        <div className="flex-1 space-y-2">
          <Label htmlFor="account">Account</Label>
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
          >
            <SelectTrigger className="bg-white">
              <SelectValue placeholder="Select an account" />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              {(
                ['asset', 'liability', 'equity', 'revenue', 'expense'] as const
              ).map((type) => (
                <div key={type}>
                  <div
                    className={cn(
                      'px-2 py-1 text-xs font-semibold sticky top-0 bg-white',
                      ACCOUNT_TYPE_INFO[type].color,
                    )}
                  >
                    {ACCOUNT_TYPE_INFO[type].label}s
                  </div>
                  {activeAccounts
                    .filter((a) => a.type === type)
                    .map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        <span className="font-mono text-slate-500 mr-2">
                          {acc.code}
                        </span>
                        {acc.name}
                      </SelectItem>
                    ))}
                </div>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="start-date">From</Label>
          <Input
            id="start-date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40 bg-white"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end-date">To</Label>
          <Input
            id="end-date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40 bg-white"
          />
        </div>
        <Button
          variant="ghost"
          onClick={() => {
            setStartDate('')
            setEndDate('')
          }}
          className="text-slate-500"
        >
          Clear Dates
        </Button>
      </div>

      {/* Account Info */}
      {selectedAccount && (
        <div className="mb-4 p-4 bg-white border border-slate-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-lg font-semibold text-slate-600">
                  {selectedAccount.code}
                </span>
                <span className="text-lg font-semibold text-slate-900">
                  {selectedAccount.name}
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {selectedAccount.description}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500 uppercase tracking-wider">
                {ACCOUNT_TYPE_INFO[selectedAccount.type].label} • Normal:{' '}
                {ACCOUNT_TYPE_INFO[selectedAccount.type].normalBalance}
              </p>
              <p className="font-mono text-2xl font-bold text-slate-900 mt-1">
                {formatCurrency(endingBalance)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Ledger Table */}
      <div className="flex-1 overflow-y-auto">
        {!selectedAccountId ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileText className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">Select an account</p>
            <p className="text-sm">Choose an account to view its ledger</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileText className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">No transactions</p>
            <p className="text-sm">
              This account has no activity in the selected period
            </p>
          </div>
        ) : (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Transaction</th>
                  <th className="text-left px-4 py-3">Description</th>
                  <th className="text-right px-4 py-3">Debit</th>
                  <th className="text-right px-4 py-3">Credit</th>
                  <th className="text-right px-4 py-3">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry) => (
                  <tr
                    key={`${entry.transaction.id}-${entry.line.id}`}
                    className="hover:bg-slate-50"
                  >
                    <td className="px-4 py-3 text-sm text-slate-600">
                      {formatDate(entry.transaction.transactionDate)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-slate-500">
                        {entry.transaction.transactionNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-900">
                      {entry.line.description || entry.transaction.description}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {entry.line.debit > 0 && (
                        <span className="text-amber-600">
                          {formatCurrency(entry.line.debit)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm">
                      {entry.line.credit > 0 && (
                        <span className="text-emerald-600">
                          {formatCurrency(entry.line.credit)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm font-medium text-slate-900">
                      {formatCurrency(entry.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr className="font-semibold">
                  <td colSpan={3} className="px-4 py-3 text-sm text-slate-700">
                    Totals ({entries.length} entries)
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-amber-600">
                    {formatCurrency(totalDebits)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-emerald-600">
                    {formatCurrency(totalCredits)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm text-slate-900">
                    {formatCurrency(endingBalance)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

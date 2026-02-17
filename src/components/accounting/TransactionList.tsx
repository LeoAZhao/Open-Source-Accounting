'use client'

import { useState, useMemo, useRef } from 'react'
import { useAccounting } from './AccountingContext'
import {
  Transaction,
  formatCurrency,
  formatDate,
  ACCOUNT_TYPE_INFO,
} from './types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Ban,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  FileText,
  Download,
  Upload,
  Loader2,
  CheckCircle2,
  Send,
} from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { TransactionForm } from './TransactionForm'
import {
  scanPdfFn,
  type ScanPdfTransaction,
} from '@/server/functions/scan-pdf'

type EditableLine = {
  accountId: string
  debit: number
  credit: number
  description: string
}
type EditableTxn = {
  description: string
  transactionDate: string
  lines: EditableLine[]
}

export function TransactionList() {
  const {
    transactions,
    accounts,
    voidTransaction,
    reverseTransaction,
    exportToCSV,
    addBulkTransactions,
    postTransaction,
    postBulkTransactions,
  } = useAccounting()

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'posted' | 'voided' | 'reversed' | 'draft'
  >('all')
  const [scanLoading, setScanLoading] = useState(false)
  const [scanResult, setScanResult] = useState<ScanPdfTransaction[] | null>(
    null,
  )
  const [editedTxns, setEditedTxns] = useState<EditableTxn[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [viewingTransaction, setViewingTransaction] =
    useState<Transaction | null>(null)
  const [voidingTransaction, setVoidingTransaction] =
    useState<Transaction | null>(null)
  const [reversingTransaction, setReversingTransaction] =
    useState<Transaction | null>(null)
  const [voidReason, setVoidReason] = useState('')
  const [reverseReason, setReverseReason] = useState('')
  const [expandedTransactions, setExpandedTransactions] = useState<Set<string>>(
    new Set(),
  )
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filteredTransactions = useMemo(() => {
    return transactions
      .filter((txn) => {
        // Status filter (draft is valid status)
        if (statusFilter !== 'all' && txn.status !== statusFilter) return false

        // Date filter
        if (dateFrom && txn.transactionDate < dateFrom) return false
        if (dateTo && txn.transactionDate > dateTo) return false

        // Search filter
        if (searchQuery) {
          const query = searchQuery.toLowerCase()
          const matchesNumber = txn.transactionNumber
            .toLowerCase()
            .includes(query)
          const matchesDescription = txn.description
            .toLowerCase()
            .includes(query)
          const matchesAccount = txn.lines.some((line) => {
            const account = accounts.find((a) => a.id === line.accountId)
            return (
              account?.name.toLowerCase().includes(query) ||
              account?.code.includes(query)
            )
          })
          if (!matchesNumber && !matchesDescription && !matchesAccount)
            return false
        }

        return true
      })
      .sort((a, b) => {
        // Sort by transaction date desc, then entry date desc
        const dateCompare = b.transactionDate.localeCompare(a.transactionDate)
        if (dateCompare !== 0) return dateCompare
        return b.entryDate.localeCompare(a.entryDate)
      })
  }, [transactions, accounts, statusFilter, dateFrom, dateTo, searchQuery])

  const draftTransactions = useMemo(
    () => filteredTransactions.filter((t) => t.status === 'draft'),
    [filteredTransactions],
  )
  const draftCount = draftTransactions.length
  const selectedDraftCount = draftTransactions.filter((t) =>
    selectedIds.has(t.id),
  ).length

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const selectAllDrafts = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(draftTransactions.map((t) => t.id)))
    } else {
      setSelectedIds(new Set())
    }
  }
  const clearSelection = () => setSelectedIds(new Set())

  const handlePostOne = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const result = postTransaction(id)
    if (result.success) {
      toast.success('Transaction posted — reports updated.')
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    } else {
      toast.error(result.error)
    }
  }
  const handlePostSelected = () => {
    const ids = Array.from(selectedIds)
    if (!ids.length) {
      toast.error('Select one or more draft transactions to post.')
      return
    }
    const result = postBulkTransactions(ids)
    if (result.success) {
      toast.success(
        `Posted ${result.posted} transaction(s) — Balance Sheet, Ledger & Income Statement updated.`,
      )
      clearSelection()
    }
    result.errors?.forEach((err) => toast.error(err))
  }
  const handlePostAllDrafts = () => {
    if (!draftCount) {
      toast.error('No draft transactions to post.')
      return
    }
    const ids = draftTransactions.map((t) => t.id)
    const result = postBulkTransactions(ids)
    if (result.success) {
      toast.success(
        `Posted all ${result.posted} draft(s) — reports updated.`,
      )
      clearSelection()
    }
    result.errors?.forEach((err) => toast.error(err))
  }

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedTransactions)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedTransactions(newExpanded)
  }

  const handleVoid = () => {
    if (!voidingTransaction || !voidReason.trim()) {
      toast.error('Please provide a reason for voiding')
      return
    }
    const result = voidTransaction(voidingTransaction.id, voidReason.trim())
    if (result.success) {
      toast.success('Transaction voided')
      setVoidingTransaction(null)
      setVoidReason('')
    } else {
      toast.error(result.error)
    }
  }

  const handleReverse = () => {
    if (!reversingTransaction || !reverseReason.trim()) {
      toast.error('Please provide a reason for reversal')
      return
    }
    const result = reverseTransaction(
      reversingTransaction.id,
      reverseReason.trim(),
    )
    if (result.success) {
      toast.success(
        `Reversal transaction ${result.transaction?.transactionNumber} created`,
      )
      setReversingTransaction(null)
      setReverseReason('')
    } else {
      toast.error(result.error)
    }
  }

  const handleExport = () => {
    const csv = exportToCSV('transactions')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Transactions exported')
  }

  const getStatusBadge = (status: Transaction['status']) => {
    switch (status) {
      case 'posted':
        return (
          <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
            Posted
          </Badge>
        )
      case 'draft':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            Draft
          </Badge>
        )
      case 'voided':
        return (
          <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
            Voided
          </Badge>
        )
      case 'reversed':
        return (
          <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
            Reversed
          </Badge>
        )
    }
  }

  const handleScanPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error('Please select a PDF file')
      return
    }
    setScanLoading(true)
    setScanResult(null)
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64 = result.split(',')[1]
          if (base64) resolve(base64)
          else reject(new Error('Failed to read file'))
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const res = await scanPdfFn({ data: { pdfBase64: base64 } })
      if (!res.success) {
        toast.error(res.error ?? 'Scanner error')
        return
      }
      if (!res.transactions?.length) {
        toast.info('No transactions found in PDF')
        setScanResult([])
        setEditedTxns([])
        return
      }
      setScanResult(res.transactions)
      const initial: EditableTxn[] = res.transactions.map((t) => ({
        description: t.description,
        transactionDate: t.date,
        lines: t.lines.map((l) => ({
          accountId: resolveAccountId(l.account) ?? '',
          debit: l.debit,
          credit: l.credit,
          description: t.description,
        })),
      }))
      setEditedTxns(initial)
      toast.success(`Found ${res.count} transaction(s). Match accounts and confirm below.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setScanLoading(false)
      e.target.value = ''
    }
  }

  const resolveAccountId = (accountNameOrCode: string): string | null => {
    const normalized = accountNameOrCode.trim().toLowerCase()
    const byName = accounts.find(
      (a) => a.name.toLowerCase() === normalized || a.name.toLowerCase().includes(normalized),
    )
    if (byName) return byName.id
    const byCode = accounts.find(
      (a) => a.code.toLowerCase() === normalized || a.code === accountNameOrCode.trim(),
    )
    if (byCode) return byCode.id
    return null
  }

  const updateEditableLine = (
    txnIdx: number,
    lineIdx: number,
    updates: Partial<EditableLine>,
  ) => {
    setEditedTxns((prev) => {
      if (!prev) return prev
      const next = prev.map((txn, i) =>
        i !== txnIdx
          ? txn
          : {
              ...txn,
              lines: txn.lines.map((line, j) =>
                j !== lineIdx ? line : { ...line, ...updates },
              ),
            },
      )
      return next
    })
  }

  const updateEditableTxn = (txnIdx: number, updates: Partial<EditableTxn>) => {
    setEditedTxns((prev) => {
      if (!prev) return prev
      return prev.map((txn, i) =>
        i !== txnIdx ? txn : { ...txn, ...updates },
      )
    })
  }

  const handleConfirmAndAddAll = () => {
    if (!editedTxns?.length) return
    const linesWithoutAccount = editedTxns.flatMap((t) =>
      t.lines.filter((l) => !l.accountId),
    )
    if (linesWithoutAccount.length > 0) {
      toast.error(
        'Select an account for every line. Use the dropdown to match PDF account names to your Chart of Accounts.',
      )
      return
    }
    const toAdd: EditableTxn[] = []
    for (const t of editedTxns) {
      const lines = t.lines.filter((l) => l.accountId)
      const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
      const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
      const balanced =
        Math.round((totalDebit - totalCredit) * 100) / 100 === 0
      if (lines.length >= 2 && balanced) {
        toAdd.push({
          description: t.description,
          transactionDate: t.transactionDate,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description || t.description,
          })),
        })
      }
    }
    if (toAdd.length === 0) {
      toast.error(
        'No valid transactions: each needs at least 2 lines, and debits must equal credits.',
      )
      return
    }
    const result = addBulkTransactions(toAdd)
    if (result.success) {
      toast.success(
        `Added ${result.added} transaction(s) as drafts — ledger and reports will update.`,
      )
      setScanResult(null)
      setEditedTxns(null)
    }
    if (result.errors?.length) {
      result.errors.forEach((err) => toast.error(err))
    }
  }

  const getTransactionTotal = (txn: Transaction) => {
    return txn.lines.reduce((sum, line) => sum + line.debit, 0)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 font-mono">
            Transactions
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {filteredTransactions.length} of {transactions.length} transactions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleScanPdf}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanLoading}
            className="bg-gradient-to-r from-blue-500 to-blue-600 text-white border-0 hover:from-blue-600 hover:to-blue-700 disabled:opacity-70"
          >
            {scanLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            Scan PDF Statement
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
          <Button
            onClick={() => setShowAddForm(true)}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Transaction
          </Button>
        </div>
      </div>

      {/* Scan PDF – editable transaction preview */}
      {scanResult !== null && editedTxns !== null && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">
              Edit &amp; match accounts: {editedTxns.length} transaction(s)
            </h3>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setScanResult(null)
                  setEditedTxns(null)
                }}
              >
                Dismiss
              </Button>
              {editedTxns.length > 0 && (
                <Button
                  size="sm"
                  onClick={handleConfirmAndAddAll}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  Confirm &amp; Add All
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-4 max-h-[28rem] overflow-y-auto">
            {editedTxns.map((txn, txnIdx) => (
              <div
                key={txnIdx}
                className="rounded-lg border border-emerald-200 bg-white p-3 shadow-sm"
              >
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <Label className="text-xs text-slate-500">
                      Transaction description
                    </Label>
                    <Input
                      value={txn.description}
                      onChange={(e) =>
                        updateEditableTxn(txnIdx, {
                          description: e.target.value,
                        })
                      }
                      className="mt-0.5 h-8 text-sm"
                      placeholder="Description"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500">Date</Label>
                    <Input
                      type="date"
                      value={txn.transactionDate}
                      onChange={(e) =>
                        updateEditableTxn(txnIdx, {
                          transactionDate: e.target.value,
                        })
                      }
                      className="mt-0.5 h-8 text-sm"
                    />
                  </div>
                </div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="text-xs text-slate-500 border-b border-slate-200">
                      <th className="text-left font-medium py-2 pr-2">
                        Account
                      </th>
                      <th className="text-right font-medium py-2 w-28">
                        Debit
                      </th>
                      <th className="text-right font-medium py-2 w-28">
                        Credit
                      </th>
                      <th className="text-left font-medium py-2 pl-2">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {txn.lines.map((line, lineIdx) => (
                      <tr
                        key={lineIdx}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-1.5 pr-2">
                          <Select
                            value={line.accountId || '__none__'}
                            onValueChange={(v) =>
                              updateEditableLine(txnIdx, lineIdx, {
                                accountId: v === '__none__' ? '' : v,
                              })
                            }
                          >
                            <SelectTrigger className="h-8 text-sm bg-white">
                              <SelectValue placeholder="Select account" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">
                                — Select account —
                              </SelectItem>
                              {accounts
                                .filter((a) => a.isActive)
                                .map((acc) => (
                                  <SelectItem
                                    key={acc.id}
                                    value={acc.id}
                                  >
                                    <span className="font-mono text-slate-500 mr-2">
                                      {acc.code}
                                    </span>
                                    {acc.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="py-1.5 text-right w-28">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.debit || ''}
                            onChange={(e) =>
                              updateEditableLine(txnIdx, lineIdx, {
                                debit: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="h-8 text-sm text-right font-mono bg-white w-full"
                          />
                        </td>
                        <td className="py-1.5 text-right w-28">
                          <Input
                            type="number"
                            min={0}
                            step={0.01}
                            value={line.credit || ''}
                            onChange={(e) =>
                              updateEditableLine(txnIdx, lineIdx, {
                                credit: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="h-8 text-sm text-right font-mono bg-white w-full"
                          />
                        </td>
                        <td className="py-1.5 pl-2">
                          <Input
                            value={line.description}
                            onChange={(e) =>
                              updateEditableLine(txnIdx, lineIdx, {
                                description: e.target.value,
                              })
                            }
                            className="h-8 text-sm bg-white"
                            placeholder="Line memo"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v: typeof statusFilter) => setStatusFilter(v)}
        >
          <SelectTrigger className="bg-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="voided">Voided</SelectItem>
            <SelectItem value="reversed">Reversed</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          placeholder="From date"
          className="bg-white"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          placeholder="To date"
          className="bg-white"
        />
      </div>

      {/* Post drafts toolbar */}
      {draftCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all-drafts"
              checked={
                selectedDraftCount === draftCount && draftCount > 0
              }
              onCheckedChange={(checked) =>
                selectAllDrafts(checked === true)
              }
            />
            <Label
              htmlFor="select-all-drafts"
              className="cursor-pointer text-sm font-medium text-slate-700"
            >
              Select all {draftCount} draft(s)
            </Label>
          </div>
          <div className="h-4 w-px bg-amber-200" />
          <Button
            size="sm"
            variant="outline"
            onClick={handlePostSelected}
            disabled={selectedDraftCount === 0}
            className="border-amber-300 bg-white hover:bg-amber-50"
          >
            <Send className="mr-2 h-4 w-4" />
            Post Selected {selectedDraftCount > 0 ? selectedDraftCount : ''}
          </Button>
          <Button
            size="sm"
            onClick={handlePostAllDrafts}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Post All Drafts ({draftCount})
          </Button>
        </div>
      )}

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto">
        {filteredTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-slate-400">
            <FileText className="w-12 h-12 mb-4" />
            <p className="text-lg font-medium">No transactions found</p>
            <p className="text-sm">
              Create your first transaction to get started
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTransactions.map((txn) => {
              const isExpanded = expandedTransactions.has(txn.id)
              return (
                <div
                  key={txn.id}
                  className={cn(
                    'border rounded-lg overflow-hidden transition-all',
                    txn.status === 'draft' &&
                      'border-amber-200 bg-amber-50/60 hover:bg-amber-50/80',
                    txn.status === 'posted' &&
                      'border-emerald-200/80 bg-emerald-50/40 hover:bg-emerald-50/60',
                    txn.status === 'voided' && 'opacity-60 bg-white',
                    txn.status === 'reversed' &&
                      'border-amber-200 bg-white',
                  )}
                >
                  {/* Transaction Header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 cursor-pointer"
                    onClick={() => toggleExpanded(txn.id)}
                  >
                    <div className="flex items-center gap-4">
                      {txn.status === 'draft' ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(txn.id)}
                            onCheckedChange={() => toggleSelected(txn.id)}
                          />
                        </div>
                      ) : (
                        <div className="w-4 shrink-0" />
                      )}
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-medium text-slate-600">
                            {txn.transactionNumber}
                          </span>
                          {getStatusBadge(txn.status)}
                          {txn.reversesTransactionId && (
                            <Badge variant="outline" className="text-xs">
                              Reversal
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-900 mt-0.5">
                          {txn.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {txn.status === 'draft' && (
                        <Button
                          size="sm"
                          onClick={(e) => handlePostOne(txn.id, e)}
                          className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
                        >
                          <Send className="mr-1.5 h-3.5 w-3.5" />
                          Post
                        </Button>
                      )}
                      <div className="text-right">
                        <p className="font-mono font-semibold text-slate-900">
                          {formatCurrency(getTransactionTotal(txn))}
                        </p>
                        <p className="text-xs text-slate-500">
                          {formatDate(txn.transactionDate)}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => setViewingTransaction(txn)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          {txn.status === 'posted' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setReversingTransaction(txn)}
                                className="text-amber-600"
                              >
                                <RotateCcw className="w-4 h-4 mr-2" />
                                Reverse
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setVoidingTransaction(txn)}
                                className="text-red-600"
                              >
                                <Ban className="w-4 h-4 mr-2" />
                                Void
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 px-4 py-3 bg-slate-50">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-slate-500">
                            <th className="text-left font-medium pb-2">
                              Account
                            </th>
                            <th className="text-right font-medium pb-2 w-28">
                              Debit
                            </th>
                            <th className="text-right font-medium pb-2 w-28">
                              Credit
                            </th>
                            <th className="text-left font-medium pb-2 pl-4">
                              Memo
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {txn.lines.map((line) => {
                            const account = accounts.find(
                              (a) => a.id === line.accountId,
                            )
                            return (
                              <tr
                                key={line.id}
                                className="border-t border-slate-100"
                              >
                                <td className="py-2">
                                  <span className="font-mono text-slate-500 mr-2">
                                    {account?.code}
                                  </span>
                                  <span
                                    className={
                                      ACCOUNT_TYPE_INFO[
                                        account?.type || 'asset'
                                      ].color
                                    }
                                  >
                                    {account?.name}
                                  </span>
                                </td>
                                <td className="text-right py-2 font-mono text-amber-600">
                                  {line.debit > 0
                                    ? formatCurrency(line.debit)
                                    : ''}
                                </td>
                                <td className="text-right py-2 font-mono text-emerald-600">
                                  {line.credit > 0
                                    ? formatCurrency(line.credit)
                                    : ''}
                                </td>
                                <td className="py-2 pl-4 text-slate-500">
                                  {line.description}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>

                      {/* Audit Info */}
                      <div className="mt-3 pt-3 border-t border-slate-200 text-xs text-slate-400 flex gap-6">
                        <span>Entry Date: {formatDate(txn.entryDate)}</span>
                        {txn.voidedAt && (
                          <span className="text-red-500">
                            Voided: {formatDate(txn.voidedAt)} —{' '}
                            {txn.voidedReason}
                          </span>
                        )}
                        {txn.reversedByTransactionId && (
                          <span className="text-amber-500">
                            Reversed by:{' '}
                            {
                              transactions.find(
                                (t) => t.id === txn.reversedByTransactionId,
                              )?.transactionNumber
                            }
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Add Transaction Form */}
      <TransactionForm open={showAddForm} onOpenChange={setShowAddForm} />

      {/* View Transaction Dialog */}
      <Dialog
        open={!!viewingTransaction}
        onOpenChange={() => setViewingTransaction(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-mono">
              {viewingTransaction?.transactionNumber}
            </DialogTitle>
            <DialogDescription>
              {viewingTransaction?.description}
            </DialogDescription>
          </DialogHeader>
          {viewingTransaction && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Transaction Date</p>
                  <p className="font-medium">
                    {formatDate(viewingTransaction.transactionDate)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Entry Date</p>
                  <p className="font-medium">
                    {formatDate(viewingTransaction.entryDate)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <div className="mt-1">
                    {getStatusBadge(viewingTransaction.status)}
                  </div>
                </div>
                <div>
                  <p className="text-slate-500">Total</p>
                  <p className="font-mono font-semibold">
                    {formatCurrency(getTransactionTotal(viewingTransaction))}
                  </p>
                </div>
              </div>

              {viewingTransaction.voidedReason && (
                <div className="p-3 bg-red-50 rounded-lg text-sm">
                  <p className="font-medium text-red-700">Void Reason:</p>
                  <p className="text-red-600">
                    {viewingTransaction.voidedReason}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Void Confirmation Dialog */}
      <Dialog
        open={!!voidingTransaction}
        onOpenChange={() => setVoidingTransaction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Void Transaction
            </DialogTitle>
            <DialogDescription>
              Voiding a transaction removes its effect from all reports. This
              action is recorded in the audit trail.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-mono text-sm">
                {voidingTransaction?.transactionNumber}
              </p>
              <p className="text-sm text-slate-600">
                {voidingTransaction?.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="void-reason">Reason for voiding (required)</Label>
              <Textarea
                id="void-reason"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="Explain why this transaction is being voided..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setVoidingTransaction(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleVoid}
              variant="destructive"
              disabled={!voidReason.trim()}
            >
              Void Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reverse Confirmation Dialog */}
      <Dialog
        open={!!reversingTransaction}
        onOpenChange={() => setReversingTransaction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <RotateCcw className="w-5 h-5" />
              Reverse Transaction
            </DialogTitle>
            <DialogDescription>
              Reversing creates a new transaction that offsets the original.
              Both transactions remain visible in the ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-slate-50 rounded-lg">
              <p className="font-mono text-sm">
                {reversingTransaction?.transactionNumber}
              </p>
              <p className="text-sm text-slate-600">
                {reversingTransaction?.description}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reverse-reason">
                Reason for reversal (required)
              </Label>
              <Textarea
                id="reverse-reason"
                value={reverseReason}
                onChange={(e) => setReverseReason(e.target.value)}
                placeholder="Explain why this transaction is being reversed..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReversingTransaction(null)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReverse}
              className="bg-amber-600 hover:bg-amber-700"
              disabled={!reverseReason.trim()}
            >
              Create Reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

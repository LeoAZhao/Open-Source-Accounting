'use client'

import { useState, useEffect } from 'react'
import { useAccounting } from './AccountingContext'
import {
  JournalEntryLine,
  generateId,
  formatCurrency,
  validateTransaction,
  ACCOUNT_TYPE_INFO,
} from './types'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

interface TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

interface LineItem {
  id: string
  accountId: string
  debit: string
  credit: string
  description: string
}

export function TransactionForm({
  open,
  onOpenChange,
  onSuccess,
}: TransactionFormProps) {
  const { accounts, addTransaction } = useAccounting()
  const activeAccounts = accounts
    .filter((a) => a.isActive)
    .sort((a, b) => a.code.localeCompare(b.code))

  const [transactionDate, setTransactionDate] = useState(
    new Date().toISOString().split('T')[0],
  )
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<LineItem[]>([
    { id: generateId(), accountId: '', debit: '', credit: '', description: '' },
    { id: generateId(), accountId: '', debit: '', credit: '', description: '' },
  ])
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setTransactionDate(new Date().toISOString().split('T')[0])
      setDescription('')
      setLines([
        {
          id: generateId(),
          accountId: '',
          debit: '',
          credit: '',
          description: '',
        },
        {
          id: generateId(),
          accountId: '',
          debit: '',
          credit: '',
          description: '',
        },
      ])
      setErrors({})
    }
  }, [open])

  const totalDebits = lines.reduce(
    (sum, line) => sum + (parseFloat(line.debit) || 0),
    0,
  )
  const totalCredits = lines.reduce(
    (sum, line) => sum + (parseFloat(line.credit) || 0),
    0,
  )
  const isBalanced =
    Math.abs(totalDebits - totalCredits) < 0.01 && totalDebits > 0
  const difference = Math.abs(totalDebits - totalCredits)

  const addLine = () => {
    setLines([
      ...lines,
      {
        id: generateId(),
        accountId: '',
        debit: '',
        credit: '',
        description: '',
      },
    ])
  }

  const removeLine = (id: string) => {
    if (lines.length <= 2) {
      toast.error('A transaction must have at least 2 lines')
      return
    }
    setLines(lines.filter((line) => line.id !== id))
  }

  const updateLine = (id: string, field: keyof LineItem, value: string) => {
    setLines(
      lines.map((line) => {
        if (line.id !== id) return line

        // If entering debit, clear credit and vice versa
        if (field === 'debit' && value) {
          return { ...line, debit: value, credit: '' }
        }
        if (field === 'credit' && value) {
          return { ...line, credit: value, debit: '' }
        }

        return { ...line, [field]: value }
      }),
    )
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!transactionDate) {
      newErrors.date = 'Transaction date is required'
    }

    if (!description.trim()) {
      newErrors.description = 'Description is required'
    }

    // Check each line
    lines.forEach((line, index) => {
      if (!line.accountId) {
        newErrors[`line-${index}-account`] = 'Account is required'
      }
      const debit = parseFloat(line.debit) || 0
      const credit = parseFloat(line.credit) || 0
      if (debit === 0 && credit === 0) {
        newErrors[`line-${index}-amount`] = 'Enter a debit or credit amount'
      }
      if (debit > 0 && credit > 0) {
        newErrors[`line-${index}-amount`] = 'Cannot have both debit and credit'
      }
    })

    if (!isBalanced) {
      newErrors.balance = `Transaction does not balance. Difference: ${formatCurrency(difference)}`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) {
      toast.error('Please fix the errors before saving')
      return
    }

    const journalLines: JournalEntryLine[] = lines.map((line) => ({
      id: generateId(),
      accountId: line.accountId,
      debit: parseFloat(line.debit) || 0,
      credit: parseFloat(line.credit) || 0,
      description: line.description.trim() || description.trim(),
    }))

    const validation = validateTransaction(journalLines)
    if (!validation.valid) {
      toast.error(validation.error)
      return
    }

    const result = addTransaction({
      transactionDate,
      description: description.trim(),
      lines: journalLines,
    })

    if (result.success) {
      toast.success(
        `Transaction ${result.transaction?.transactionNumber} created`,
      )
      onOpenChange(false)
      onSuccess?.()
    } else {
      toast.error(result.error)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-mono">New Journal Entry</DialogTitle>
          <DialogDescription>
            Create a double-entry transaction. Debits must equal credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Header Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Transaction Date</Label>
              <Input
                id="date"
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className={cn(errors.date && 'border-red-500')}
              />
              {errors.date && (
                <p className="text-xs text-red-500">{errors.date}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Office supplies purchase"
                className={cn(errors.description && 'border-red-500')}
              />
              {errors.description && (
                <p className="text-xs text-red-500">{errors.description}</p>
              )}
            </div>
          </div>

          {/* Journal Lines */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Journal Lines</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addLine}
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Line
              </Button>
            </div>

            {/* Header Row */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
              <div className="col-span-5">Account</div>
              <div className="col-span-2 text-right">Debit</div>
              <div className="col-span-2 text-right">Credit</div>
              <div className="col-span-2">Memo</div>
              <div className="col-span-1"></div>
            </div>

            {/* Line Items */}
            {lines.map((line, index) => {
              const account = accounts.find((a) => a.id === line.accountId)
              return (
                <div
                  key={line.id}
                  className="grid grid-cols-12 gap-2 items-start"
                >
                  <div className="col-span-5">
                    <Select
                      value={line.accountId}
                      onValueChange={(v) => updateLine(line.id, 'accountId', v)}
                    >
                      <SelectTrigger
                        className={cn(
                          'text-sm',
                          errors[`line-${index}-account`] && 'border-red-500',
                        )}
                      >
                        <SelectValue placeholder="Select account" />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {(
                          [
                            'asset',
                            'liability',
                            'equity',
                            'revenue',
                            'expense',
                          ] as const
                        ).map((type) => (
                          <div key={type}>
                            <div
                              className={cn(
                                'px-2 py-1 text-xs font-semibold',
                                ACCOUNT_TYPE_INFO[type].color,
                              )}
                            >
                              {ACCOUNT_TYPE_INFO[type].label}s
                            </div>
                            {activeAccounts
                              .filter((a) => a.type === type)
                              .map((acc) => (
                                <SelectItem
                                  key={acc.id}
                                  value={acc.id}
                                  className="text-sm"
                                >
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
                    {account && (
                      <p className="text-[10px] text-slate-400 mt-1 px-1">
                        Normal: {ACCOUNT_TYPE_INFO[account.type].normalBalance}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debit}
                      onChange={(e) =>
                        updateLine(line.id, 'debit', e.target.value)
                      }
                      placeholder="0.00"
                      className={cn(
                        'text-right font-mono text-sm',
                        line.debit && 'bg-amber-50 border-amber-200',
                        errors[`line-${index}-amount`] && 'border-red-500',
                      )}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.credit}
                      onChange={(e) =>
                        updateLine(line.id, 'credit', e.target.value)
                      }
                      placeholder="0.00"
                      className={cn(
                        'text-right font-mono text-sm',
                        line.credit && 'bg-emerald-50 border-emerald-200',
                        errors[`line-${index}-amount`] && 'border-red-500',
                      )}
                    />
                  </div>
                  <div className="col-span-2">
                    <Input
                      value={line.description}
                      onChange={(e) =>
                        updateLine(line.id, 'description', e.target.value)
                      }
                      placeholder="Optional"
                      className="text-sm"
                    />
                  </div>
                  <div className="col-span-1 flex justify-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeLine(line.id)}
                      className="text-slate-400 hover:text-red-500"
                      disabled={lines.length <= 2}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Totals */}
          <div className="border-t border-slate-200 pt-4">
            <div className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-5 text-right font-medium text-slate-700">
                Totals:
              </div>
              <div
                className={cn(
                  'col-span-2 text-right font-mono font-semibold',
                  'text-amber-600',
                )}
              >
                {formatCurrency(totalDebits)}
              </div>
              <div
                className={cn(
                  'col-span-2 text-right font-mono font-semibold',
                  'text-emerald-600',
                )}
              >
                {formatCurrency(totalCredits)}
              </div>
              <div className="col-span-3"></div>
            </div>

            {/* Balance Status */}
            <div
              className={cn(
                'mt-3 p-3 rounded-lg flex items-center gap-2',
                isBalanced
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-amber-50 text-amber-700',
              )}
            >
              {isBalanced ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Transaction is balanced</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5" />
                  <span className="font-medium">
                    {totalDebits === 0 && totalCredits === 0
                      ? 'Enter amounts to balance'
                      : `Out of balance by ${formatCurrency(difference)}`}
                  </span>
                  {difference > 0 && (
                    <span className="text-sm ml-2">
                      (
                      {totalDebits > totalCredits
                        ? 'need more credits'
                        : 'need more debits'}
                      )
                    </span>
                  )}
                </>
              )}
            </div>

            {errors.balance && (
              <p className="text-sm text-red-500 mt-2">{errors.balance}</p>
            )}
          </div>

          {/* Quick Entry Helper */}
          <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
            <p className="font-medium mb-2">Double-Entry Reminder:</p>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-medium text-amber-600 mb-1">
                  Debits increase:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>Assets</li>
                  <li>Expenses</li>
                </ul>
              </div>
              <div>
                <p className="font-medium text-emerald-600 mb-1">
                  Credits increase:
                </p>
                <ul className="list-disc list-inside space-y-0.5 text-slate-500">
                  <li>Liabilities</li>
                  <li>Equity</li>
                  <li>Revenue</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!isBalanced}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <ArrowRight className="w-4 h-4 mr-2" />
            Post Transaction
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

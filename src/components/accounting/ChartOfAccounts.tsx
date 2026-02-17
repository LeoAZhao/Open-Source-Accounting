'use client'

import { useState } from 'react'
import { useAccounting } from './AccountingContext'
import {
  Account,
  AccountType,
  AccountSubtype,
  ACCOUNT_TYPE_INFO,
} from './types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'

const SUBTYPE_OPTIONS: Record<
  AccountType,
  { value: AccountSubtype; label: string }[]
> = {
  asset: [
    { value: 'cash', label: 'Cash' },
    { value: 'bank', label: 'Bank Account' },
    { value: 'accounts_receivable', label: 'Accounts Receivable' },
    { value: 'inventory', label: 'Inventory' },
    { value: 'prepaid', label: 'Prepaid Expense' },
    { value: 'fixed_asset', label: 'Fixed Asset' },
    { value: 'other_asset', label: 'Other Asset' },
  ],
  liability: [
    { value: 'accounts_payable', label: 'Accounts Payable' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'current_liability', label: 'Current Liability' },
    { value: 'long_term_liability', label: 'Long-term Liability' },
    { value: 'other_liability', label: 'Other Liability' },
  ],
  equity: [
    { value: 'owner_equity', label: "Owner's Equity" },
    { value: 'retained_earnings', label: 'Retained Earnings' },
    { value: 'common_stock', label: 'Common Stock' },
    { value: 'other_equity', label: 'Other Equity' },
  ],
  revenue: [
    { value: 'sales', label: 'Sales' },
    { value: 'service_revenue', label: 'Service Revenue' },
    { value: 'other_income', label: 'Other Income' },
  ],
  expense: [
    { value: 'cost_of_goods', label: 'Cost of Goods Sold' },
    { value: 'operating_expense', label: 'Operating Expense' },
    { value: 'payroll', label: 'Payroll' },
    { value: 'tax_expense', label: 'Tax Expense' },
    { value: 'other_expense', label: 'Other Expense' },
  ],
}

export function ChartOfAccounts() {
  const { accounts, addAccount, updateAccount, deleteAccount } = useAccounting()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedTypes, setExpandedTypes] = useState<Set<AccountType>>(
    new Set(['asset', 'liability', 'equity', 'revenue', 'expense']),
  )
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<Account | null>(null)

  const filteredAccounts = accounts.filter(
    (acc) =>
      acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      acc.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const groupedAccounts = (
    ['asset', 'liability', 'equity', 'revenue', 'expense'] as AccountType[]
  ).map((type) => ({
    type,
    accounts: filteredAccounts
      .filter((acc) => acc.type === type)
      .sort((a, b) => a.code.localeCompare(b.code)),
  }))

  const toggleType = (type: AccountType) => {
    const newExpanded = new Set(expandedTypes)
    if (newExpanded.has(type)) {
      newExpanded.delete(type)
    } else {
      newExpanded.add(type)
    }
    setExpandedTypes(newExpanded)
  }

  const handleDelete = (account: Account) => {
    const result = deleteAccount(account.id)
    if (result.success) {
      toast.success('Account deleted')
      setDeleteConfirm(null)
    } else {
      toast.error(result.error)
    }
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 font-mono">
            Chart of Accounts
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {accounts.length} accounts •{' '}
            {accounts.filter((a) => a.isActive).length} active
          </p>
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Account
        </Button>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search accounts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 bg-white border-slate-200"
        />
      </div>

      {/* Account List */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {groupedAccounts.map(({ type, accounts: typeAccounts }) => (
          <div
            key={type}
            className="border border-slate-200 rounded-lg overflow-hidden bg-white"
          >
            <button
              onClick={() => toggleType(type)}
              className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                {expandedTypes.has(type) ? (
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
                <span
                  className={cn(
                    'font-semibold text-sm',
                    ACCOUNT_TYPE_INFO[type].color,
                  )}
                >
                  {ACCOUNT_TYPE_INFO[type].label}s
                </span>
                <Badge variant="secondary" className="text-xs">
                  {typeAccounts.length}
                </Badge>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                Normal: {ACCOUNT_TYPE_INFO[type].normalBalance.toUpperCase()}
              </span>
            </button>

            {expandedTypes.has(type) && typeAccounts.length > 0 && (
              <div className="divide-y divide-slate-100">
                {typeAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors',
                      !account.isActive && 'opacity-50',
                    )}
                  >
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm text-slate-600 w-16">
                        {account.code}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900">
                          {account.name}
                        </p>
                        <p className="text-xs text-slate-500">
                          {account.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!account.isActive && (
                        <Badge
                          variant="outline"
                          className="text-xs text-slate-400"
                        >
                          Inactive
                        </Badge>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAccount(account)}
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteConfirm(account)}
                        className="text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {expandedTypes.has(type) && typeAccounts.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-slate-400">
                No {type} accounts found
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add/Edit Dialog */}
      <AccountDialog
        open={showAddDialog || !!editingAccount}
        onOpenChange={(open) => {
          if (!open) {
            setShowAddDialog(false)
            setEditingAccount(null)
          }
        }}
        account={editingAccount}
        onSave={(data) => {
          if (editingAccount) {
            updateAccount(editingAccount.id, data)
            toast.success('Account updated')
          } else {
            addAccount(data as Omit<Account, 'id' | 'createdAt' | 'updatedAt'>)
            toast.success('Account created')
          }
          setShowAddDialog(false)
          setEditingAccount(null)
        }}
      />

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={() => setDeleteConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-500" />
              Delete Account
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{' '}
              <strong>{deleteConfirm?.name}</strong>? This action cannot be
              undone. If this account has transactions, consider deactivating it
              instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function AccountDialog({
  open,
  onOpenChange,
  account,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: Account | null
  onSave: (data: Partial<Account>) => void
}) {
  const [code, setCode] = useState(account?.code || '')
  const [name, setName] = useState(account?.name || '')
  const [type, setType] = useState<AccountType>(account?.type || 'asset')
  const [subtype, setSubtype] = useState<AccountSubtype>(
    account?.subtype || 'cash',
  )
  const [description, setDescription] = useState(account?.description || '')
  const [isActive, setIsActive] = useState(account?.isActive ?? true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Reset form when dialog opens/closes or account changes
  useState(() => {
    if (open) {
      setCode(account?.code || '')
      setName(account?.name || '')
      setType(account?.type || 'asset')
      setSubtype(account?.subtype || 'cash')
      setDescription(account?.description || '')
      setIsActive(account?.isActive ?? true)
      setErrors({})
    }
  })

  const validate = () => {
    const newErrors: Record<string, string> = {}
    if (!code.trim()) newErrors.code = 'Account code is required'
    if (!name.trim()) newErrors.name = 'Account name is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (!validate()) return
    onSave({
      code: code.trim(),
      name: name.trim(),
      type,
      subtype,
      description: description.trim(),
      isActive,
      parentId: null,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{account ? 'Edit Account' : 'Add Account'}</DialogTitle>
          <DialogDescription>
            {account
              ? 'Update account details'
              : 'Create a new account in your chart of accounts'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="code">Account Code</Label>
              <Input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g., 1000"
                className={cn(errors.code && 'border-red-500')}
              />
              {errors.code && (
                <p className="text-xs text-red-500">{errors.code}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              <Select
                value={type}
                onValueChange={(v: AccountType) => {
                  setType(v)
                  setSubtype(SUBTYPE_OPTIONS[v][0].value)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      'asset',
                      'liability',
                      'equity',
                      'revenue',
                      'expense',
                    ] as AccountType[]
                  ).map((t) => (
                    <SelectItem key={t} value={t}>
                      {ACCOUNT_TYPE_INFO[t].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Account Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Cash on Hand"
              className={cn(errors.name && 'border-red-500')}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="subtype">Subtype</Label>
            <Select
              value={subtype}
              onValueChange={(v: AccountSubtype) => setSubtype(v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUBTYPE_OPTIONS[type].map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this account"
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="active">Active</Label>
              <p className="text-xs text-slate-500">
                Inactive accounts won't appear in transaction forms
              </p>
            </div>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {account ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

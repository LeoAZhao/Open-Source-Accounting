'use client'

import { useState } from 'react'
import { useAccounting } from './AccountingContext'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
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
import {
  Settings as SettingsIcon,
  Percent,
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  RotateCcw,
  Download,
  Database,
} from 'lucide-react'
import { toast } from 'sonner'

export function Settings() {
  const {
    taxRates,
    addTaxRate,
    updateTaxRate,
    deleteTaxRate,
    exportToCSV,
    resetToDefaults,
    accounts,
    transactions,
  } = useAccounting()

  const [showAddTaxRate, setShowAddTaxRate] = useState(false)
  const [editingTaxRate, setEditingTaxRate] = useState<
    (typeof taxRates)[0] | null
  >(null)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  // Tax rate form state
  const [taxName, setTaxName] = useState('')
  const [taxRateValue, setTaxRateValue] = useState('')
  const [taxDescription, setTaxDescription] = useState('')
  const [taxIsActive, setTaxIsActive] = useState(true)

  const resetTaxForm = () => {
    setTaxName('')
    setTaxRateValue('')
    setTaxDescription('')
    setTaxIsActive(true)
  }

  const handleSaveTaxRate = () => {
    if (!taxName.trim()) {
      toast.error('Tax name is required')
      return
    }
    const rate = parseFloat(taxRateValue)
    if (isNaN(rate) || rate < 0) {
      toast.error('Please enter a valid tax rate')
      return
    }

    if (editingTaxRate) {
      updateTaxRate(editingTaxRate.id, {
        name: taxName.trim(),
        rate,
        description: taxDescription.trim(),
        isActive: taxIsActive,
      })
      toast.success('Tax rate updated')
    } else {
      addTaxRate({
        name: taxName.trim(),
        rate,
        description: taxDescription.trim(),
        isActive: taxIsActive,
      })
      toast.success('Tax rate created')
    }

    setShowAddTaxRate(false)
    setEditingTaxRate(null)
    resetTaxForm()
  }

  const handleEditTaxRate = (taxRate: (typeof taxRates)[0]) => {
    setEditingTaxRate(taxRate)
    setTaxName(taxRate.name)
    setTaxRateValue(taxRate.rate.toString())
    setTaxDescription(taxRate.description)
    setTaxIsActive(taxRate.isActive)
    setShowAddTaxRate(true)
  }

  const handleDeleteTaxRate = (id: string) => {
    deleteTaxRate(id)
    toast.success('Tax rate deleted')
  }

  const handleExportAll = () => {
    // Export accounts
    const accountsCsv = exportToCSV('accounts')
    const accountsBlob = new Blob([accountsCsv], { type: 'text/csv' })
    const accountsUrl = URL.createObjectURL(accountsBlob)
    const accountsLink = document.createElement('a')
    accountsLink.href = accountsUrl
    accountsLink.download = `accounts-${new Date().toISOString().split('T')[0]}.csv`
    accountsLink.click()
    URL.revokeObjectURL(accountsUrl)

    // Export transactions
    const transactionsCsv = exportToCSV('transactions')
    const transactionsBlob = new Blob([transactionsCsv], { type: 'text/csv' })
    const transactionsUrl = URL.createObjectURL(transactionsBlob)
    const transactionsLink = document.createElement('a')
    transactionsLink.href = transactionsUrl
    transactionsLink.download = `transactions-${new Date().toISOString().split('T')[0]}.csv`
    transactionsLink.click()
    URL.revokeObjectURL(transactionsUrl)

    toast.success('Data exported')
  }

  const handleReset = () => {
    resetToDefaults()
    setShowResetConfirm(false)
    toast.success('Data reset to defaults')
  }

  return (
    <div className="h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
          <SettingsIcon className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 font-mono">
            Settings
          </h2>
          <p className="text-sm text-slate-500">
            Configure your accounting system
          </p>
        </div>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* Tax Rates */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="w-5 h-5" />
                  Tax Rates
                </CardTitle>
                <CardDescription>
                  Configure tax rates for your jurisdiction
                </CardDescription>
              </div>
              <Button
                onClick={() => {
                  resetTaxForm()
                  setEditingTaxRate(null)
                  setShowAddTaxRate(true)
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Tax Rate
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {taxRates.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">
                No tax rates configured
              </p>
            ) : (
              <div className="space-y-2">
                {taxRates.map((rate) => (
                  <div
                    key={rate.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border',
                      rate.isActive
                        ? 'bg-white border-slate-200'
                        : 'bg-slate-50 border-slate-100 opacity-60',
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {rate.name}
                        </span>
                        <span className="font-mono text-sm text-emerald-600">
                          {rate.rate}%
                        </span>
                        {!rate.isActive && (
                          <span className="text-xs text-slate-400">
                            (Inactive)
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {rate.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditTaxRate(rate)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTaxRate(rate.id)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Data Management
            </CardTitle>
            <CardDescription>
              Export or reset your accounting data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-900">Export All Data</p>
                <p className="text-sm text-slate-500">
                  Download accounts and transactions as CSV files
                </p>
              </div>
              <Button variant="outline" onClick={handleExportAll}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>

            <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-100">
              <div>
                <p className="font-medium text-red-900">Reset to Defaults</p>
                <p className="text-sm text-red-600">
                  Delete all data and restore default chart of accounts
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowResetConfirm(true)}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* System Info */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
            <CardDescription>Current data statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-mono font-bold text-slate-900">
                  {accounts.length}
                </p>
                <p className="text-sm text-slate-500">Accounts</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-mono font-bold text-slate-900">
                  {transactions.length}
                </p>
                <p className="text-sm text-slate-500">Transactions</p>
              </div>
              <div className="p-4 bg-slate-50 rounded-lg text-center">
                <p className="text-2xl font-mono font-bold text-slate-900">
                  {taxRates.length}
                </p>
                <p className="text-sm text-slate-500">Tax Rates</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-4 text-center">
              Data is stored locally in your browser's localStorage
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Tax Rate Dialog */}
      <Dialog
        open={showAddTaxRate}
        onOpenChange={(open) => {
          setShowAddTaxRate(open)
          if (!open) {
            setEditingTaxRate(null)
            resetTaxForm()
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTaxRate ? 'Edit Tax Rate' : 'Add Tax Rate'}
            </DialogTitle>
            <DialogDescription>
              Configure a tax rate for your transactions
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="tax-name">Name</Label>
              <Input
                id="tax-name"
                value={taxName}
                onChange={(e) => setTaxName(e.target.value)}
                placeholder="e.g., HST (13%)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-rate">Rate (%)</Label>
              <Input
                id="tax-rate"
                type="number"
                step="0.01"
                min="0"
                value={taxRateValue}
                onChange={(e) => setTaxRateValue(e.target.value)}
                placeholder="e.g., 13"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tax-description">Description</Label>
              <Input
                id="tax-description"
                value={taxDescription}
                onChange={(e) => setTaxDescription(e.target.value)}
                placeholder="e.g., Harmonized Sales Tax - Ontario"
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="tax-active">Active</Label>
                <p className="text-xs text-slate-500">
                  Inactive rates won't appear in forms
                </p>
              </div>
              <Switch
                id="tax-active"
                checked={taxIsActive}
                onCheckedChange={setTaxIsActive}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTaxRate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTaxRate}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {editingTaxRate ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Confirmation */}
      <AlertDialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              Reset All Data
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your accounts, transactions, and
              settings. The default chart of accounts will be restored. This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReset}
              className="bg-red-600 hover:bg-red-700"
            >
              Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

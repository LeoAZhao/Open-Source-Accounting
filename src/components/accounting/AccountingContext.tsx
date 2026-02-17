'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react'
import {
  Account,
  Transaction,
  TaxRate,
  JournalEntryLine,
  DEFAULT_ACCOUNTS,
  generateId,
  generateTransactionNumber,
  validateTransaction,
  calculateAccountBalance,
  AccountBalance,
  BalanceSheetData,
  IncomeStatementData,
  GeneralLedgerEntry,
  TransactionStatus,
} from './types'

interface AccountingState {
  accounts: Account[]
  transactions: Transaction[]
  taxRates: TaxRate[]
  isLoaded: boolean
  /** Bumped whenever transactions/accounts change so reports re-render with fresh data */
  dataVersion: number
}

interface AccountingContextType extends AccountingState {
  // Account operations
  addAccount: (
    account: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Account
  updateAccount: (id: string, updates: Partial<Account>) => void
  deleteAccount: (id: string) => { success: boolean; error?: string }
  getAccount: (id: string) => Account | undefined
  getAccountsByType: (type: Account['type']) => Account[]

  // Transaction operations
  addTransaction: (
    transaction: Omit<
      Transaction,
      | 'id'
      | 'transactionNumber'
      | 'entryDate'
      | 'status'
      | 'voidedAt'
      | 'voidedReason'
      | 'reversedByTransactionId'
      | 'reversesTransactionId'
      | 'createdAt'
      | 'updatedAt'
    >,
    options?: { status?: TransactionStatus },
  ) => { success: boolean; transaction?: Transaction; error?: string }
  addBulkTransactions: (
    transactions: Array<{
      description: string
      transactionDate: string
      lines: Array<{
        accountId: string
        debit: number
        credit: number
        description?: string
      }>
    }>,
  ) => { success: boolean; added: number; errors?: string[] }
  postTransaction: (id: string) => { success: boolean; error?: string }
  postBulkTransactions: (
    ids: string[],
  ) => { success: boolean; posted: number; errors?: string[] }
  voidTransaction: (
    id: string,
    reason: string,
  ) => { success: boolean; error?: string }
  reverseTransaction: (
    id: string,
    reason: string,
  ) => { success: boolean; transaction?: Transaction; error?: string }
  getTransaction: (id: string) => Transaction | undefined

  // Tax rate operations
  addTaxRate: (taxRate: Omit<TaxRate, 'id' | 'createdAt'>) => TaxRate
  updateTaxRate: (id: string, updates: Partial<TaxRate>) => void
  deleteTaxRate: (id: string) => void

  // Reports
  getBalanceSheet: (asOf: string) => BalanceSheetData
  getIncomeStatement: (
    startDate: string,
    endDate: string,
  ) => IncomeStatementData
  getGeneralLedger: (
    accountId: string,
    startDate?: string,
    endDate?: string,
  ) => GeneralLedgerEntry[]
  getTrialBalance: (
    asOf: string,
  ) => { account: Account; debit: number; credit: number }[]

  // Export
  exportToCSV: (
    type: 'transactions' | 'accounts' | 'general-ledger',
    options?: { accountId?: string; startDate?: string; endDate?: string },
  ) => string

  // Reset
  resetToDefaults: () => void
}

const STORAGE_KEY = 'localhost-accounting-data'

const AccountingContext = createContext<AccountingContextType | null>(null)

export function AccountingProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<AccountingState>({
    accounts: [],
    transactions: [],
    taxRates: [],
    isLoaded: false,
    dataVersion: 0,
  })

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setState({
          accounts: parsed.accounts || [],
          transactions: parsed.transactions || [],
          taxRates: parsed.taxRates || [],
          isLoaded: true,
          dataVersion: parsed.dataVersion ?? 0,
        })
      } catch {
        // Initialize with defaults if parse fails
        initializeDefaults()
      }
    } else {
      initializeDefaults()
    }
  }, [])

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (state.isLoaded) {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          accounts: state.accounts,
          transactions: state.transactions,
          taxRates: state.taxRates,
          dataVersion: state.dataVersion,
        }),
      )
    }
  }, [state])

  function initializeDefaults() {
    const now = new Date().toISOString()
    const accounts: Account[] = DEFAULT_ACCOUNTS.map((acc) => ({
      ...acc,
      id: generateId(),
      createdAt: now,
      updatedAt: now,
    }))

    const taxRates: TaxRate[] = [
      {
        id: generateId(),
        name: 'No Tax',
        rate: 0,
        description: 'No tax applied',
        isActive: true,
        createdAt: now,
      },
      {
        id: generateId(),
        name: 'HST (13%)',
        rate: 13,
        description: 'Harmonized Sales Tax - Ontario',
        isActive: true,
        createdAt: now,
      },
      {
        id: generateId(),
        name: 'GST (5%)',
        rate: 5,
        description: 'Goods and Services Tax',
        isActive: true,
        createdAt: now,
      },
      {
        id: generateId(),
        name: 'PST (7%)',
        rate: 7,
        description: 'Provincial Sales Tax - BC',
        isActive: true,
        createdAt: now,
      },
    ]

    setState({
      accounts,
      transactions: [],
      taxRates,
      isLoaded: true,
      dataVersion: 0,
    })
  }

  // Account operations
  const addAccount = useCallback(
    (accountData: Omit<Account, 'id' | 'createdAt' | 'updatedAt'>): Account => {
      const now = new Date().toISOString()
      const account: Account = {
        ...accountData,
        id: generateId(),
        createdAt: now,
        updatedAt: now,
      }
      setState((prev) => ({ ...prev, accounts: [...prev.accounts, account] }))
      return account
    },
    [],
  )

  const updateAccount = useCallback((id: string, updates: Partial<Account>) => {
    setState((prev) => ({
      ...prev,
      accounts: prev.accounts.map((acc) =>
        acc.id === id
          ? { ...acc, ...updates, updatedAt: new Date().toISOString() }
          : acc,
      ),
    }))
  }, [])

  const deleteAccount = useCallback(
    (id: string): { success: boolean; error?: string } => {
      // Check if account is used in any transactions
      const isUsed = state.transactions.some((txn) =>
        txn.lines.some((line) => line.accountId === id),
      )
      if (isUsed) {
        return {
          success: false,
          error:
            'Cannot delete account that has transactions. Deactivate it instead.',
        }
      }
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.filter((acc) => acc.id !== id),
      }))
      return { success: true }
    },
    [state.transactions],
  )

  const getAccount = useCallback(
    (id: string): Account | undefined => {
      return state.accounts.find((acc) => acc.id === id)
    },
    [state.accounts],
  )

  const getAccountsByType = useCallback(
    (type: Account['type']): Account[] => {
      return state.accounts.filter((acc) => acc.type === type && acc.isActive)
    },
    [state.accounts],
  )

  // Transaction operations
  const addTransaction = useCallback(
    (
      transactionData: Omit<
        Transaction,
        | 'id'
        | 'transactionNumber'
        | 'entryDate'
        | 'status'
        | 'voidedAt'
        | 'voidedReason'
        | 'reversedByTransactionId'
        | 'reversesTransactionId'
        | 'createdAt'
        | 'updatedAt'
      >,
      options?: { status?: TransactionStatus },
    ): { success: boolean; transaction?: Transaction; error?: string } => {
      const validation = validateTransaction(transactionData.lines)
      if (!validation.valid) {
        return { success: false, error: validation.error }
      }

      const now = new Date().toISOString()
      const status = options?.status ?? 'posted'
      const transaction: Transaction = {
        ...transactionData,
        id: generateId(),
        transactionNumber: generateTransactionNumber(state.transactions.length),
        entryDate: now,
        status,
        voidedAt: null,
        voidedReason: null,
        reversedByTransactionId: null,
        reversesTransactionId: null,
        createdAt: now,
        updatedAt: now,
      }

      setState((prev) => ({
        ...prev,
        transactions: [...prev.transactions, transaction],
        dataVersion: prev.dataVersion + 1,
      }))
      return { success: true, transaction }
    },
    [state.transactions.length],
  )

  const addBulkTransactions = useCallback(
    (
      bulkData: Array<{
        description: string
        transactionDate: string
        lines: Array<{
          accountId: string
          debit: number
          credit: number
          description?: string
        }>
      }>,
    ): { success: boolean; added: number; errors?: string[] } => {
      const errors: string[] = []
      let added = 0
      let nextLength = state.transactions.length
      const newTransactions: Transaction[] = []

      for (const t of bulkData) {
        const lines: JournalEntryLine[] = t.lines.map((line) => ({
          id: generateId(),
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description ?? t.description,
        }))
        const validation = validateTransaction(lines)
        if (!validation.valid) {
          errors.push(`${t.description}: ${validation.error}`)
          continue
        }
        const now = new Date().toISOString()
        newTransactions.push({
          id: generateId(),
          transactionNumber: generateTransactionNumber(nextLength),
          transactionDate: t.transactionDate,
          entryDate: now,
          description: t.description,
          lines,
          status: 'draft' as TransactionStatus,
          voidedAt: null,
          voidedReason: null,
          reversedByTransactionId: null,
          reversesTransactionId: null,
          createdAt: now,
          updatedAt: now,
        })
        nextLength++
        added++
      }

      if (newTransactions.length > 0) {
        setState((prev) => ({
          ...prev,
          transactions: [...prev.transactions, ...newTransactions],
          dataVersion: prev.dataVersion + 1,
        }))
      }
      return {
        success: added > 0,
        added,
        errors: errors.length > 0 ? errors : undefined,
      }
    },
    [state.transactions.length],
  )

  const postTransaction = useCallback(
    (id: string): { success: boolean; error?: string } => {
      const transaction = state.transactions.find((t) => t.id === id)
      if (!transaction) {
        return { success: false, error: 'Transaction not found' }
      }
      if (transaction.status !== 'draft') {
        return {
          success: false,
          error: 'Only draft transactions can be posted',
        }
      }
      const now = new Date().toISOString()
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((txn) =>
          txn.id === id
            ? {
                ...txn,
                status: 'posted' as TransactionStatus,
                updatedAt: now,
              }
            : txn,
        ),
        dataVersion: prev.dataVersion + 1,
      }))
      return { success: true }
    },
    [state.transactions],
  )

  const postBulkTransactions = useCallback(
    (
      ids: string[],
    ): { success: boolean; posted: number; errors?: string[] } => {
      const errors: string[] = []
      let posted = 0
      const now = new Date().toISOString()
      setState((prev) => {
        const idSet = new Set(ids)
        const nextTransactions = prev.transactions.map((txn) => {
          if (!idSet.has(txn.id)) return txn
          if (txn.status !== 'draft') {
            errors.push(
              `${txn.transactionNumber}: only draft transactions can be posted`,
            )
            return txn
          }
          posted++
          return {
            ...txn,
            status: 'posted' as TransactionStatus,
            updatedAt: now,
          }
        })
        return {
          ...prev,
          transactions: nextTransactions,
          dataVersion: prev.dataVersion + (posted > 0 ? 1 : 0),
        }
      })
      return {
        success: posted > 0,
        posted,
        errors: errors.length > 0 ? errors : undefined,
      }
    },
    [],
  )

  const voidTransaction = useCallback(
    (id: string, reason: string): { success: boolean; error?: string } => {
      const transaction = state.transactions.find((t) => t.id === id)
      if (!transaction) {
        return { success: false, error: 'Transaction not found' }
      }
      if (transaction.status !== 'posted') {
        return {
          success: false,
          error: 'Only posted transactions can be voided',
        }
      }
      if (!reason.trim()) {
        return { success: false, error: 'Void reason is required' }
      }

      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((txn) =>
          txn.id === id
            ? {
                ...txn,
                status: 'voided' as TransactionStatus,
                voidedAt: new Date().toISOString(),
                voidedReason: reason,
                updatedAt: new Date().toISOString(),
              }
            : txn,
        ),
        dataVersion: prev.dataVersion + 1,
      }))
      return { success: true }
    },
    [state.transactions],
  )

  const reverseTransaction = useCallback(
    (
      id: string,
      reason: string,
    ): { success: boolean; transaction?: Transaction; error?: string } => {
      const original = state.transactions.find((t) => t.id === id)
      if (!original) {
        return { success: false, error: 'Transaction not found' }
      }
      if (original.status !== 'posted') {
        return {
          success: false,
          error: 'Only posted transactions can be reversed',
        }
      }
      if (!reason.trim()) {
        return { success: false, error: 'Reversal reason is required' }
      }

      const now = new Date().toISOString()

      // Create reversal transaction (swap debits and credits)
      const reversalLines: JournalEntryLine[] = original.lines.map((line) => ({
        ...line,
        id: generateId(),
        debit: line.credit,
        credit: line.debit,
        description: `Reversal: ${line.description}`,
      }))

      const reversalTransaction: Transaction = {
        id: generateId(),
        transactionNumber: generateTransactionNumber(state.transactions.length),
        transactionDate: now.split('T')[0],
        entryDate: now,
        description: `Reversal of ${original.transactionNumber}: ${reason}`,
        lines: reversalLines,
        status: 'posted',
        voidedAt: null,
        voidedReason: null,
        reversedByTransactionId: null,
        reversesTransactionId: original.id,
        createdAt: now,
        updatedAt: now,
      }

      setState((prev) => ({
        ...prev,
        transactions: prev.transactions
          .map((txn) =>
            txn.id === id
              ? {
                  ...txn,
                  status: 'reversed' as TransactionStatus,
                  reversedByTransactionId: reversalTransaction.id,
                  updatedAt: now,
                }
              : txn,
          )
          .concat(reversalTransaction),
        dataVersion: prev.dataVersion + 1,
      }))

      return { success: true, transaction: reversalTransaction }
    },
    [state.transactions],
  )

  const getTransaction = useCallback(
    (id: string): Transaction | undefined => {
      return state.transactions.find((t) => t.id === id)
    },
    [state.transactions],
  )

  // Tax rate operations
  const addTaxRate = useCallback(
    (taxRateData: Omit<TaxRate, 'id' | 'createdAt'>): TaxRate => {
      const taxRate: TaxRate = {
        ...taxRateData,
        id: generateId(),
        createdAt: new Date().toISOString(),
      }
      setState((prev) => ({ ...prev, taxRates: [...prev.taxRates, taxRate] }))
      return taxRate
    },
    [],
  )

  const updateTaxRate = useCallback((id: string, updates: Partial<TaxRate>) => {
    setState((prev) => ({
      ...prev,
      taxRates: prev.taxRates.map((rate) =>
        rate.id === id ? { ...rate, ...updates } : rate,
      ),
    }))
  }, [])

  const deleteTaxRate = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      taxRates: prev.taxRates.filter((rate) => rate.id !== id),
    }))
  }, [])

  // Reports
  const getBalanceSheet = useCallback(
    (asOf: string): BalanceSheetData => {
      const relevantTransactions = state.transactions.filter(
        (txn) =>
          txn.transactionDate <= asOf &&
          txn.status !== 'voided' &&
          txn.status !== 'draft',
      )

      const assets: AccountBalance[] = []
      const liabilities: AccountBalance[] = []
      const equity: AccountBalance[] = []

      for (const account of state.accounts) {
        if (!account.isActive) continue
        const balance = calculateAccountBalance(account, relevantTransactions)
        if (balance === 0) continue

        const entry = { account, balance }
        switch (account.type) {
          case 'asset':
            assets.push(entry)
            break
          case 'liability':
            liabilities.push(entry)
            break
          case 'equity':
            equity.push(entry)
            break
        }
      }

      // Calculate retained earnings from revenue and expenses
      let retainedEarnings = 0
      for (const account of state.accounts) {
        if (account.type === 'revenue' || account.type === 'expense') {
          retainedEarnings +=
            calculateAccountBalance(account, relevantTransactions) *
            (account.type === 'revenue' ? 1 : -1)
        }
      }

      const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0)
      const totalLiabilities = liabilities.reduce(
        (sum, l) => sum + l.balance,
        0,
      )
      const totalEquity =
        equity.reduce((sum, e) => sum + e.balance, 0) + retainedEarnings

      return {
        asOf,
        assets,
        liabilities,
        equity,
        totalAssets,
        totalLiabilities,
        totalEquity,
      }
    },
    [state.accounts, state.transactions],
  )

  const getIncomeStatement = useCallback(
    (startDate: string, endDate: string): IncomeStatementData => {
      const relevantTransactions = state.transactions.filter(
        (txn) =>
          txn.transactionDate >= startDate &&
          txn.transactionDate <= endDate &&
          txn.status !== 'voided' &&
          txn.status !== 'draft',
      )

      const revenue: AccountBalance[] = []
      const expenses: AccountBalance[] = []

      for (const account of state.accounts) {
        if (!account.isActive) continue
        const balance = calculateAccountBalance(account, relevantTransactions)
        if (balance === 0) continue

        const entry = { account, balance }
        if (account.type === 'revenue') {
          revenue.push(entry)
        } else if (account.type === 'expense') {
          expenses.push(entry)
        }
      }

      const totalRevenue = revenue.reduce((sum, r) => sum + r.balance, 0)
      const totalExpenses = expenses.reduce((sum, e) => sum + e.balance, 0)

      return {
        startDate,
        endDate,
        revenue,
        expenses,
        totalRevenue,
        totalExpenses,
        netIncome: totalRevenue - totalExpenses,
      }
    },
    [state.accounts, state.transactions],
  )

  const getGeneralLedger = useCallback(
    (
      accountId: string,
      startDate?: string,
      endDate?: string,
    ): GeneralLedgerEntry[] => {
      const account = state.accounts.find((a) => a.id === accountId)
      if (!account) return []

      const entries: GeneralLedgerEntry[] = []
      let runningBalance = 0

      const sortedTransactions = [...state.transactions]
        .filter((txn) => {
          if (txn.status === 'voided' || txn.status === 'draft') return false
          if (startDate && txn.transactionDate < startDate) return false
          if (endDate && txn.transactionDate > endDate) return false
          return txn.lines.some((line) => line.accountId === accountId)
        })
        .sort(
          (a, b) =>
            a.transactionDate.localeCompare(b.transactionDate) ||
            a.entryDate.localeCompare(b.entryDate),
        )

      for (const txn of sortedTransactions) {
        for (const line of txn.lines) {
          if (line.accountId === accountId) {
            const normalBalance =
              account.type === 'asset' || account.type === 'expense'
                ? 'debit'
                : 'credit'
            if (normalBalance === 'debit') {
              runningBalance += line.debit - line.credit
            } else {
              runningBalance += line.credit - line.debit
            }
            entries.push({
              transaction: txn,
              line,
              runningBalance: Math.round(runningBalance * 100) / 100,
            })
          }
        }
      }

      return entries
    },
    [state.accounts, state.transactions],
  )

  const getTrialBalance = useCallback(
    (asOf: string): { account: Account; debit: number; credit: number }[] => {
      const relevantTransactions = state.transactions.filter(
        (txn) =>
          txn.transactionDate <= asOf &&
          txn.status !== 'voided' &&
          txn.status !== 'draft',
      )

      const result: { account: Account; debit: number; credit: number }[] = []

      for (const account of state.accounts) {
        if (!account.isActive) continue
        const balance = calculateAccountBalance(account, relevantTransactions)
        if (balance === 0) continue

        const normalBalance =
          account.type === 'asset' || account.type === 'expense'
            ? 'debit'
            : 'credit'
        result.push({
          account,
          debit: normalBalance === 'debit' ? Math.abs(balance) : 0,
          credit: normalBalance === 'credit' ? Math.abs(balance) : 0,
        })
      }

      return result.sort((a, b) => a.account.code.localeCompare(b.account.code))
    },
    [state.accounts, state.transactions],
  )

  // Export
  const exportToCSV = useCallback(
    (
      type: 'transactions' | 'accounts' | 'general-ledger',
      options?: { accountId?: string; startDate?: string; endDate?: string },
    ): string => {
      let csv = ''

      if (type === 'accounts') {
        csv = 'Code,Name,Type,Subtype,Description,Active\n'
        for (const acc of state.accounts) {
          csv += `"${acc.code}","${acc.name}","${acc.type}","${acc.subtype}","${acc.description}","${acc.isActive}"\n`
        }
      } else if (type === 'transactions') {
        csv =
          'Transaction #,Date,Entry Date,Description,Status,Account Code,Account Name,Debit,Credit\n'
        for (const txn of state.transactions) {
          for (const line of txn.lines) {
            const account = state.accounts.find((a) => a.id === line.accountId)
            csv += `"${txn.transactionNumber}","${txn.transactionDate}","${txn.entryDate}","${txn.description}","${txn.status}","${account?.code || ''}","${account?.name || ''}","${line.debit || ''}","${line.credit || ''}"\n`
          }
        }
      } else if (type === 'general-ledger' && options?.accountId) {
        const entries = getGeneralLedger(
          options.accountId,
          options.startDate,
          options.endDate,
        )
        const account = state.accounts.find((a) => a.id === options.accountId)
        csv = `General Ledger - ${account?.code} ${account?.name}\n`
        csv += 'Date,Transaction #,Description,Debit,Credit,Balance\n'
        for (const entry of entries) {
          csv += `"${entry.transaction.transactionDate}","${entry.transaction.transactionNumber}","${entry.line.description}","${entry.line.debit || ''}","${entry.line.credit || ''}","${entry.runningBalance}"\n`
        }
      }

      return csv
    },
    [state.accounts, state.transactions, getGeneralLedger],
  )

  const resetToDefaults = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    initializeDefaults()
  }, [])

  const value: AccountingContextType = {
    ...state,
    addAccount,
    updateAccount,
    deleteAccount,
    getAccount,
    getAccountsByType,
    addTransaction,
    addBulkTransactions,
    postTransaction,
    postBulkTransactions,
    voidTransaction,
    reverseTransaction,
    getTransaction,
    addTaxRate,
    updateTaxRate,
    deleteTaxRate,
    getBalanceSheet,
    getIncomeStatement,
    getGeneralLedger,
    getTrialBalance,
    exportToCSV,
    resetToDefaults,
  }

  return (
    <AccountingContext.Provider value={value}>
      {children}
    </AccountingContext.Provider>
  )
}

export function useAccounting() {
  const context = useContext(AccountingContext)
  if (!context) {
    throw new Error('useAccounting must be used within an AccountingProvider')
  }
  return context
}

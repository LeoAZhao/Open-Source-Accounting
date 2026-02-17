// Core accounting types for double-entry bookkeeping

export type AccountType =
  | 'asset'
  | 'liability'
  | 'equity'
  | 'revenue'
  | 'expense'

export type AccountSubtype =
  // Assets
  | 'cash'
  | 'bank'
  | 'accounts_receivable'
  | 'inventory'
  | 'prepaid'
  | 'fixed_asset'
  | 'other_asset'
  // Liabilities
  | 'accounts_payable'
  | 'credit_card'
  | 'current_liability'
  | 'long_term_liability'
  | 'other_liability'
  // Equity
  | 'owner_equity'
  | 'retained_earnings'
  | 'common_stock'
  | 'other_equity'
  // Revenue
  | 'sales'
  | 'service_revenue'
  | 'other_income'
  // Expenses
  | 'cost_of_goods'
  | 'operating_expense'
  | 'payroll'
  | 'tax_expense'
  | 'other_expense'

export interface Account {
  id: string
  code: string // Account number (e.g., "1000", "2100")
  name: string
  type: AccountType
  subtype: AccountSubtype
  description: string
  isActive: boolean
  parentId: string | null
  createdAt: string
  updatedAt: string
}

export interface JournalEntryLine {
  id: string
  accountId: string
  debit: number // Always positive or 0
  credit: number // Always positive or 0
  description: string
}

export type TransactionStatus = 'posted' | 'voided' | 'reversed' | 'draft'

export interface Transaction {
  id: string
  transactionNumber: string // Auto-generated reference number
  transactionDate: string // When the transaction occurred
  entryDate: string // When it was entered into the system
  description: string
  lines: JournalEntryLine[]
  status: TransactionStatus
  voidedAt: string | null
  voidedReason: string | null
  reversedByTransactionId: string | null
  reversesTransactionId: string | null
  createdAt: string
  updatedAt: string
}

export interface TaxRate {
  id: string
  name: string
  rate: number // Percentage (e.g., 13 for 13%)
  description: string
  isActive: boolean
  createdAt: string
}

// Report types
export interface BalanceSheetData {
  asOf: string
  assets: AccountBalance[]
  liabilities: AccountBalance[]
  equity: AccountBalance[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
}

export interface AccountBalance {
  account: Account
  balance: number
}

export interface IncomeStatementData {
  startDate: string
  endDate: string
  revenue: AccountBalance[]
  expenses: AccountBalance[]
  totalRevenue: number
  totalExpenses: number
  netIncome: number
}

export interface GeneralLedgerEntry {
  transaction: Transaction
  line: JournalEntryLine
  runningBalance: number
}

// Default chart of accounts
export const DEFAULT_ACCOUNTS: Omit<
  Account,
  'id' | 'createdAt' | 'updatedAt'
>[] = [
  // Assets (1000-1999)
  {
    code: '1000',
    name: 'Cash',
    type: 'asset',
    subtype: 'cash',
    description: 'Cash on hand',
    isActive: true,
    parentId: null,
  },
  {
    code: '1010',
    name: 'Checking Account',
    type: 'asset',
    subtype: 'bank',
    description: 'Primary checking account',
    isActive: true,
    parentId: null,
  },
  {
    code: '1020',
    name: 'Savings Account',
    type: 'asset',
    subtype: 'bank',
    description: 'Savings account',
    isActive: true,
    parentId: null,
  },
  {
    code: '1100',
    name: 'Accounts Receivable',
    type: 'asset',
    subtype: 'accounts_receivable',
    description: 'Money owed by customers',
    isActive: true,
    parentId: null,
  },
  {
    code: '1200',
    name: 'Inventory',
    type: 'asset',
    subtype: 'inventory',
    description: 'Goods for sale',
    isActive: true,
    parentId: null,
  },
  {
    code: '1300',
    name: 'Prepaid Expenses',
    type: 'asset',
    subtype: 'prepaid',
    description: 'Expenses paid in advance',
    isActive: true,
    parentId: null,
  },
  {
    code: '1500',
    name: 'Equipment',
    type: 'asset',
    subtype: 'fixed_asset',
    description: 'Office and business equipment',
    isActive: true,
    parentId: null,
  },
  {
    code: '1510',
    name: 'Accumulated Depreciation - Equipment',
    type: 'asset',
    subtype: 'fixed_asset',
    description: 'Accumulated depreciation on equipment',
    isActive: true,
    parentId: null,
  },

  // Liabilities (2000-2999)
  {
    code: '2000',
    name: 'Accounts Payable',
    type: 'liability',
    subtype: 'accounts_payable',
    description: 'Money owed to suppliers',
    isActive: true,
    parentId: null,
  },
  {
    code: '2100',
    name: 'Credit Card Payable',
    type: 'liability',
    subtype: 'credit_card',
    description: 'Credit card balances',
    isActive: true,
    parentId: null,
  },
  {
    code: '2200',
    name: 'Accrued Expenses',
    type: 'liability',
    subtype: 'current_liability',
    description: 'Expenses incurred but not yet paid',
    isActive: true,
    parentId: null,
  },
  {
    code: '2300',
    name: 'Sales Tax Payable',
    type: 'liability',
    subtype: 'current_liability',
    description: 'Sales tax collected to be remitted',
    isActive: true,
    parentId: null,
  },
  {
    code: '2400',
    name: 'Payroll Liabilities',
    type: 'liability',
    subtype: 'current_liability',
    description: 'Wages and payroll taxes owed',
    isActive: true,
    parentId: null,
  },
  {
    code: '2500',
    name: 'Loan Payable',
    type: 'liability',
    subtype: 'long_term_liability',
    description: 'Long-term loans',
    isActive: true,
    parentId: null,
  },

  // Equity (3000-3999)
  {
    code: '3000',
    name: "Owner's Equity",
    type: 'equity',
    subtype: 'owner_equity',
    description: "Owner's investment in the business",
    isActive: true,
    parentId: null,
  },
  {
    code: '3100',
    name: 'Retained Earnings',
    type: 'equity',
    subtype: 'retained_earnings',
    description: 'Accumulated profits',
    isActive: true,
    parentId: null,
  },
  {
    code: '3200',
    name: "Owner's Draws",
    type: 'equity',
    subtype: 'owner_equity',
    description: 'Owner withdrawals',
    isActive: true,
    parentId: null,
  },

  // Revenue (4000-4999)
  {
    code: '4000',
    name: 'Sales Revenue',
    type: 'revenue',
    subtype: 'sales',
    description: 'Revenue from product sales',
    isActive: true,
    parentId: null,
  },
  {
    code: '4100',
    name: 'Service Revenue',
    type: 'revenue',
    subtype: 'service_revenue',
    description: 'Revenue from services',
    isActive: true,
    parentId: null,
  },
  {
    code: '4200',
    name: 'Interest Income',
    type: 'revenue',
    subtype: 'other_income',
    description: 'Interest earned',
    isActive: true,
    parentId: null,
  },
  {
    code: '4300',
    name: 'Other Income',
    type: 'revenue',
    subtype: 'other_income',
    description: 'Miscellaneous income',
    isActive: true,
    parentId: null,
  },

  // Expenses (5000-6999)
  {
    code: '5000',
    name: 'Cost of Goods Sold',
    type: 'expense',
    subtype: 'cost_of_goods',
    description: 'Direct cost of products sold',
    isActive: true,
    parentId: null,
  },
  {
    code: '5100',
    name: 'Purchases',
    type: 'expense',
    subtype: 'cost_of_goods',
    description: 'Inventory purchases',
    isActive: true,
    parentId: null,
  },
  {
    code: '6000',
    name: 'Advertising & Marketing',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Marketing expenses',
    isActive: true,
    parentId: null,
  },
  {
    code: '6100',
    name: 'Bank Charges',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Bank fees and charges',
    isActive: true,
    parentId: null,
  },
  {
    code: '6200',
    name: 'Insurance',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Business insurance',
    isActive: true,
    parentId: null,
  },
  {
    code: '6300',
    name: 'Office Supplies',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Office supplies and materials',
    isActive: true,
    parentId: null,
  },
  {
    code: '6400',
    name: 'Professional Fees',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Legal, accounting, consulting fees',
    isActive: true,
    parentId: null,
  },
  {
    code: '6500',
    name: 'Rent Expense',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Office or facility rent',
    isActive: true,
    parentId: null,
  },
  {
    code: '6600',
    name: 'Repairs & Maintenance',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Equipment and facility repairs',
    isActive: true,
    parentId: null,
  },
  {
    code: '6700',
    name: 'Telephone & Internet',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Communication expenses',
    isActive: true,
    parentId: null,
  },
  {
    code: '6800',
    name: 'Travel & Entertainment',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Business travel and meals',
    isActive: true,
    parentId: null,
  },
  {
    code: '6900',
    name: 'Utilities',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Electricity, water, gas',
    isActive: true,
    parentId: null,
  },
  {
    code: '7000',
    name: 'Wages & Salaries',
    type: 'expense',
    subtype: 'payroll',
    description: 'Employee wages',
    isActive: true,
    parentId: null,
  },
  {
    code: '7100',
    name: 'Payroll Taxes',
    type: 'expense',
    subtype: 'payroll',
    description: 'Employer payroll taxes',
    isActive: true,
    parentId: null,
  },
  {
    code: '7200',
    name: 'Employee Benefits',
    type: 'expense',
    subtype: 'payroll',
    description: 'Health insurance, retirement, etc.',
    isActive: true,
    parentId: null,
  },
  {
    code: '7500',
    name: 'Depreciation Expense',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Depreciation of fixed assets',
    isActive: true,
    parentId: null,
  },
  {
    code: '7600',
    name: 'Interest Expense',
    type: 'expense',
    subtype: 'operating_expense',
    description: 'Interest on loans',
    isActive: true,
    parentId: null,
  },
  {
    code: '7700',
    name: 'Income Tax Expense',
    type: 'expense',
    subtype: 'tax_expense',
    description: 'Income taxes',
    isActive: true,
    parentId: null,
  },
  {
    code: '7800',
    name: 'Miscellaneous Expense',
    type: 'expense',
    subtype: 'other_expense',
    description: 'Other expenses',
    isActive: true,
    parentId: null,
  },
]

// Helper to get account type display info
export const ACCOUNT_TYPE_INFO: Record<
  AccountType,
  { label: string; normalBalance: 'debit' | 'credit'; color: string }
> = {
  asset: { label: 'Asset', normalBalance: 'debit', color: 'text-blue-600' },
  liability: {
    label: 'Liability',
    normalBalance: 'credit',
    color: 'text-purple-600',
  },
  equity: {
    label: 'Equity',
    normalBalance: 'credit',
    color: 'text-indigo-600',
  },
  revenue: {
    label: 'Revenue',
    normalBalance: 'credit',
    color: 'text-emerald-600',
  },
  expense: {
    label: 'Expense',
    normalBalance: 'debit',
    color: 'text-amber-600',
  },
}

// Utility functions
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

export function generateTransactionNumber(existingCount: number): string {
  return `TXN-${String(existingCount + 1).padStart(6, '0')}`
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function validateTransaction(lines: JournalEntryLine[]): {
  valid: boolean
  error?: string
} {
  if (lines.length < 2) {
    return { valid: false, error: 'A transaction must have at least 2 lines' }
  }

  const totalDebits = lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredits = lines.reduce((sum, line) => sum + line.credit, 0)

  // Round to 2 decimal places to avoid floating point issues
  const roundedDebits = Math.round(totalDebits * 100) / 100
  const roundedCredits = Math.round(totalCredits * 100) / 100

  if (roundedDebits !== roundedCredits) {
    return {
      valid: false,
      error: `Transaction does not balance. Debits: ${formatCurrency(roundedDebits)}, Credits: ${formatCurrency(roundedCredits)}`,
    }
  }

  if (roundedDebits === 0) {
    return { valid: false, error: 'Transaction must have a non-zero amount' }
  }

  // Check each line has either debit or credit, not both
  for (const line of lines) {
    if (line.debit > 0 && line.credit > 0) {
      return {
        valid: false,
        error: 'A line cannot have both debit and credit amounts',
      }
    }
    if (line.debit === 0 && line.credit === 0) {
      return {
        valid: false,
        error: 'Each line must have either a debit or credit amount',
      }
    }
  }

  return { valid: true }
}

// Calculate account balance based on account type and transactions
export function calculateAccountBalance(
  account: Account,
  transactions: Transaction[],
): number {
  let balance = 0
  const normalBalance = ACCOUNT_TYPE_INFO[account.type].normalBalance

  for (const txn of transactions) {
    if (txn.status === 'voided') continue

    for (const line of txn.lines) {
      if (line.accountId === account.id) {
        if (normalBalance === 'debit') {
          balance += line.debit - line.credit
        } else {
          balance += line.credit - line.debit
        }
      }
    }
  }

  return Math.round(balance * 100) / 100
}

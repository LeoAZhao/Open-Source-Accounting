'use client'

import { useState } from 'react'
import { AccountingProvider } from './AccountingContext'
import { Nav, NavSection } from './Nav'
import { Dashboard } from './Dashboard'
import { ChartOfAccounts } from './ChartOfAccounts'
import { TransactionList } from './TransactionList'
import { TransactionForm } from './TransactionForm'
import { GeneralLedger } from './GeneralLedger'
import { BalanceSheet } from './BalanceSheet'
import { IncomeStatement } from './IncomeStatement'
import { Settings } from './Settings'

function AccountingAppContent() {
  const [activeSection, setActiveSection] = useState<NavSection>('dashboard')
  const [showNewTransaction, setShowNewTransaction] = useState(false)

  const handleNavigate = (section: NavSection) => {
    setActiveSection(section)
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <Dashboard
            onNavigate={handleNavigate}
            onNewTransaction={() => setShowNewTransaction(true)}
          />
        )
      case 'accounts':
        return <ChartOfAccounts />
      case 'transactions':
        return <TransactionList />
      case 'general-ledger':
        return <GeneralLedger />
      case 'balance-sheet':
        return <BalanceSheet />
      case 'income-statement':
        return <IncomeStatement />
      case 'settings':
        return <Settings />
      default:
        return (
          <Dashboard
            onNavigate={handleNavigate}
            onNewTransaction={() => setShowNewTransaction(true)}
          />
        )
    }
  }

  return (
    <div className="flex h-screen bg-slate-100">
      <Nav activeSection={activeSection} onNavigate={handleNavigate} />
      <main className="flex-1 overflow-hidden p-6">
        <div className="h-full bg-white rounded-xl shadow-sm border border-slate-200 p-6 overflow-hidden">
          {renderContent()}
        </div>
      </main>

      {/* Global New Transaction Form */}
      <TransactionForm
        open={showNewTransaction}
        onOpenChange={setShowNewTransaction}
      />
    </div>
  )
}

export function AccountingApp() {
  return (
    <AccountingProvider>
      <AccountingAppContent />
    </AccountingProvider>
  )
}

'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  BookOpen,
  Receipt,
  FileText,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Database,
  Scale,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

export type NavSection =
  | 'dashboard'
  | 'accounts'
  | 'transactions'
  | 'general-ledger'
  | 'balance-sheet'
  | 'income-statement'
  | 'settings'

interface NavProps {
  activeSection: NavSection
  onNavigate: (section: NavSection) => void
}

const navItems: {
  id: NavSection
  label: string
  icon: React.ElementType
  group: string
}[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
  { id: 'accounts', label: 'Chart of Accounts', icon: BookOpen, group: 'main' },
  { id: 'transactions', label: 'Transactions', icon: Receipt, group: 'main' },
  {
    id: 'general-ledger',
    label: 'General Ledger',
    icon: Database,
    group: 'reports',
  },
  {
    id: 'balance-sheet',
    label: 'Balance Sheet',
    icon: Scale,
    group: 'reports',
  },
  {
    id: 'income-statement',
    label: 'Income Statement',
    icon: BarChart3,
    group: 'reports',
  },
  { id: 'settings', label: 'Settings', icon: Settings, group: 'system' },
]

export function Nav({ activeSection, onNavigate }: NavProps) {
  const [collapsed, setCollapsed] = useState(false)

  const mainItems = navItems.filter((item) => item.group === 'main')
  const reportItems = navItems.filter((item) => item.group === 'reports')
  const systemItems = navItems.filter((item) => item.group === 'system')

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col h-screen bg-slate-900 text-slate-100 transition-all duration-300 border-r border-slate-800',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {/* Header */}
        <div
          className={cn(
            'flex items-center h-16 px-4 border-b border-slate-800',
            collapsed ? 'justify-center' : 'justify-between',
          )}
        >
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-sm tracking-tight font-mono">
                  LocalHost
                </h1>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest">
                  Accounting
                </p>
              </div>
            </div>
          )}
          {collapsed && (
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <FileText className="w-5 h-5 text-white" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4">
          {/* Main */}
          <div className="px-3 mb-6">
            {!collapsed && (
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2 px-2">
                Main
              </p>
            )}
            <ul className="space-y-1">
              {mainItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={activeSection === item.id}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </ul>
          </div>

          {/* Reports */}
          <div className="px-3 mb-6">
            {!collapsed && (
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2 px-2">
                Reports
              </p>
            )}
            <ul className="space-y-1">
              {reportItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={activeSection === item.id}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </ul>
          </div>

          {/* System */}
          <div className="px-3">
            {!collapsed && (
              <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mb-2 px-2">
                System
              </p>
            )}
            <ul className="space-y-1">
              {systemItems.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  active={activeSection === item.id}
                  collapsed={collapsed}
                  onClick={() => onNavigate(item.id)}
                />
              ))}
            </ul>
          </div>
        </nav>

        {/* Collapse Toggle */}
        <div className="p-3 border-t border-slate-800">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              'w-full text-slate-400 hover:text-slate-100 hover:bg-slate-800',
              collapsed ? 'justify-center' : 'justify-start',
            )}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4 mr-2" />
                <span className="text-xs">Collapse</span>
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}

function NavItem({
  item,
  active,
  collapsed,
  onClick,
}: {
  item: { id: NavSection; label: string; icon: React.ElementType }
  active: boolean
  collapsed: boolean
  onClick: () => void
}) {
  const Icon = item.icon

  const button = (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
          : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800',
        collapsed && 'justify-center px-2',
      )}
    >
      <Icon
        className={cn('w-5 h-5 flex-shrink-0', active && 'text-emerald-400')}
      />
      {!collapsed && <span>{item.label}</span>}
    </button>
  )

  if (collapsed) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-slate-800 text-slate-100 border-slate-700"
          >
            {item.label}
          </TooltipContent>
        </Tooltip>
      </li>
    )
  }

  return <li>{button}</li>
}

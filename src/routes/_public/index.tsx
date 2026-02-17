import { AccountingApp } from '@/components/accounting'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_public/')({
  component: Index,
})

function Index() {
  return <AccountingApp />
}

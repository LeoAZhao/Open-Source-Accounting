import { createServerFn } from '@tanstack/react-start'
import { writeFile, unlink, mkdir } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { execSync } from 'child_process'
import z from 'zod'

const SCAN_TIMEOUT_MS = 30_000

export type ScanPdfLine = { account: string; debit: number; credit: number }
export type ScanPdfTransaction = {
  description: string
  date: string
  lines: ScanPdfLine[]
}

const scanPdfInputSchema = z.object({
  pdfBase64: z.string().min(1).max(50_000_000),
})
type ScanPdfInput = z.infer<typeof scanPdfInputSchema>

function splitCSVRow(row: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < row.length; i++) {
    const c = row[i]
    if (c === '"') {
      inQuotes = !inQuotes
    } else if ((c === ',' && !inQuotes) || (c === '\r' && !inQuotes)) {
      cells.push(current.trim().replace(/^"|"$/g, ''))
      current = ''
    } else if (c !== '\r') {
      current += c
    }
  }
  cells.push(current.trim().replace(/^"|"$/g, ''))
  return cells
}

function parseCSV(csvText: string): ScanPdfLine[] {
  const lines: ScanPdfLine[] = []
  const rows = csvText.trim().split(/\n/)
  if (rows.length < 2) return lines
  const headerCells = splitCSVRow(rows[0])
  const accountCol = 0
  let debitCol = 1
  let creditCol = 2
  let netCol = 3
  headerCells.forEach((h, i) => {
    const lower = h.toLowerCase()
    if (lower.includes('debit')) debitCol = i
    else if (lower.includes('credit')) creditCol = i
    else if (lower.includes('net')) netCol = i
  })

  const parseNum = (s: string): number => {
    const cleaned = String(s ?? '').replace(/,/g, '').replace(/\$/g, '').trim()
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : 0
  }

  const parseRow = (row: string): ScanPdfLine | null => {
    const cells = splitCSVRow(row)
    if (cells.length < 2) return null
    const account = (cells[accountCol] ?? '').trim()
    if (!account) return null
    let debit = parseNum(cells[debitCol] ?? '0')
    let credit = parseNum(cells[creditCol] ?? '0')
    const net = parseNum(cells[netCol] ?? '0')
    if (debit === 0 && credit === 0 && net !== 0) {
      if (net > 0) debit = net
      else credit = Math.abs(net)
    }
    if (debit > 0 || credit > 0) {
      return { account, debit, credit }
    }
    return null
  }

  for (let i = 1; i < rows.length; i++) {
    const line = parseRow(rows[i])
    if (line) lines.push(line)
  }
  return lines
}

function groupLinesIntoTransactions(lines: ScanPdfLine[]): ScanPdfTransaction[] {
  const transactions: ScanPdfTransaction[] = []
  const today = new Date().toISOString().slice(0, 10)
  let group: ScanPdfLine[] = []
  let groupDebit = 0
  let groupCredit = 0

  for (const line of lines) {
    group.push(line)
    groupDebit += line.debit
    groupCredit += line.credit
    const roundedDebit = Math.round(groupDebit * 100) / 100
    const roundedCredit = Math.round(groupCredit * 100) / 100
    if (roundedDebit === roundedCredit && roundedDebit > 0) {
      transactions.push({
        description: `PDF Import: ${group.map((l) => l.account).join(', ')}`,
        date: today,
        lines: [...group],
      })
      group = []
      groupDebit = 0
      groupCredit = 0
    }
  }

  if (group.length > 0) {
    const totalDebit = group.reduce((s, l) => s + l.debit, 0)
    const totalCredit = group.reduce((s, l) => s + l.credit, 0)
    const diff = Math.round((totalDebit - totalCredit) * 100) / 100
    if (diff !== 0) {
      group.push({
        account: 'Uncategorized',
        debit: diff > 0 ? 0 : Math.abs(diff),
        credit: diff > 0 ? Math.abs(diff) : 0,
      })
    }
    if (group.some((l) => l.debit > 0 || l.credit > 0)) {
      transactions.push({
        description: `PDF Import: ${group.map((l) => l.account).join(', ')}`,
        date: today,
        lines: group,
      })
    }
  }
  return transactions
}

export const scanPdfFn = createServerFn({ method: 'POST' })
  .inputValidator(scanPdfInputSchema)
  .handler(async ({ data }: { data: ScanPdfInput }): Promise<{
    success: boolean
    transactions?: ScanPdfTransaction[]
    count?: number
    error?: string
  }> => {
    const { pdfBase64 } = data
    let tempPath: string | null = null
    try {
      const buf = Buffer.from(pdfBase64, 'base64')
      const tempDir = join(tmpdir(), 'scan-pdf')
      await mkdir(tempDir, { recursive: true })
      tempPath = join(tempDir, `scan-${Date.now()}.pdf`)
      await writeFile(tempPath, buf)

      const scriptPath = join(process.cwd(), 'Scanner.py')
      const pathForScript: string = tempPath
      let stdout: string
      try {
        stdout = execSync(`python "${scriptPath}" "${pathForScript}"`, {
          encoding: 'utf-8',
          timeout: SCAN_TIMEOUT_MS,
          maxBuffer: 10 * 1024 * 1024,
        })
      } catch (execErr: unknown) {
        const err = execErr as { stderr?: Buffer | string; message?: string }
        const stderr =
          typeof err.stderr === 'string'
            ? err.stderr
            : err.stderr?.toString?.() ?? err.message ?? String(execErr)
        return { success: false, error: stderr }
      }

      const csvLines = parseCSV(stdout)
      const transactions = groupLinesIntoTransactions(csvLines)
      if (transactions.length === 0) {
        return { success: true, transactions: [], count: 0 }
      }
      return {
        success: true,
        transactions,
        count: transactions.length,
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { success: false, error: message }
    } finally {
      if (tempPath) {
        try {
          await unlink(tempPath)
        } catch {
          // ignore cleanup errors
        }
      }
    }
  })

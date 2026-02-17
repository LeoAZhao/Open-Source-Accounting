// app/api/scan-pdf/route.ts (Next.js App Router)
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { parse } from 'csv-parse/sync';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('pdf') as File;
    
    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No PDF uploaded' }, { status: 400 });
    }

    // Temp file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.mkdir(tempDir, { recursive: true });
    const tempPath = path.join(tempDir, `scan-${Date.now()}-${file.name}`);
    
    await fs.writeFile(tempPath, buffer);

    // Run YOUR Scanner.py (extracts CSV)
    const scannerPath = path.join(process.cwd(), 'Scanner.py'); // Copy to project root
    const result = await new Promise<{ stdout: string; stderr: string }>((resolve) => {
      exec(`python "${scannerPath}" "${tempPath}"`, (err, stdout, stderr) => {
        resolve({ stdout: stdout || '', stderr: stderr || '' });
      });
    });

    // Cleanup
    await fs.unlink(tempPath).catch(() => {});

    if (result.stderr && !result.stdout.trim()) {
      return NextResponse.json({ error: 'Scanner failed', stderr: result.stderr }, { status: 500 });
    }

    // Parse CSV output → Transactions
    const transactions = parseScannerOutput(result.stdout);
    
    return NextResponse.json({ 
      success: true, 
      transactions,
      raw: result.stdout,
      count: transactions.length 
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: error }, { status: 500 });
  }
}

// Parse your Scanner.py CSV output
function parseScannerOutput(csv: string): any[] {
  try {
    const records = parse(csv, { 
      columns: true, 
      skip_empty_lines: true,
      trim: true 
    });
    
    return records.map((row: any) => ({
      description: row['Account Name/ID'] || 'PDF Scan',
      date: new Date().toISOString().split('T')[0],
      totalAmount: parseFloat(row['Net Change']?.replace(/[$,+]/g, '') || 0),
      lines: [{
        account: row['Account Name/ID'],
        debit: parseFloat(row['Total Debit (Gains)']?.replace(/[$,]/g, '') || 0),
        credit: parseFloat(row['Total Credit (Losses)']?.replace(/[$,]/g, '') || 0),
        description: row['Account Name/ID']
      }]
    }));
  } catch {
    return [];
  }
}

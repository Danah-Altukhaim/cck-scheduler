// Equivalency - Courses List.xlsx
// Two sheets: 'CCK' (117 rows) and 'PAAET' (355 rows). This is transfer-credit
// reference data — out of scope for the V0 scheduler, but we read shape +
// counts so the orchestrator can flag if the file ever drifts.

import xlsx from 'xlsx'
import type { IngestReport } from '../model/types.js'

export function loadEquivalencies(path: string): {
  cckRows: number
  paaetRows: number
  report: IngestReport
} {
  const report: IngestReport = {
    source: 'Equivalency - Courses List.xlsx',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: ['Read shape only; not integrated into scheduler logic in V0.'],
  }
  const wb = xlsx.readFile(path)
  let cckRows = 0
  let paaetRows = 0
  for (const s of wb.SheetNames) {
    const sheet = wb.Sheets[s]!
    const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
    const dataRows = data.filter((r) => Array.isArray(r) && (r as unknown[]).some((c) => c != null))
      .length - 1 // minus header
    if (s.toUpperCase().includes('CCK')) cckRows = dataRows
    if (s.toUpperCase().includes('PAAET')) paaetRows = dataRows
  }
  report.rows_in = cckRows + paaetRows
  report.rows_out = report.rows_in
  return { cckRows, paaetRows, report }
}

// Merged Courses.xlsx → MergedGroup[].
// The file has one row per code, but the third column ('Merged') contains the
// full group string like 'BUMG3110+BUMG3015' or 'ACC2214+BUAC3120+ACC2233'.
// We deduplicate groups by sorting member codes.

import xlsx from 'xlsx'
import type { IngestReport, MergedGroup } from '../model/types.js'
import { cellStr, warn } from '../lib/util.js'

export function loadMerged(path: string): { merged: MergedGroup[]; report: IngestReport } {
  const report: IngestReport = {
    source: 'Merged Courses.xlsx',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: [
      "Group string parsed on '+' (whitespace-tolerant) and uppercased.",
      'Duplicate groups (same member set) collapsed into one MergedGroup.',
    ],
  }

  const wb = xlsx.readFile(path)
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) {
    report.warnings.push(warn('error', 'MERGED_SHEET_MISSING', 'Sheet1 missing'))
    return { merged: [], report }
  }
  const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

  const groupKeys = new Map<string, string[]>() // key = sorted member list, value = members

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[]
    const mergedStr = cellStr(row[2])
    if (!mergedStr) continue
    report.rows_in++
    const members = mergedStr
      .split('+')
      .map((s) => s.trim().toUpperCase().replace(/\s+/g, ''))
      .filter((s) => /^[A-Z]{2,4}\d{4}/.test(s))
    if (members.length < 2) {
      report.warnings.push(
        warn(
          'warn',
          'MERGED_TOO_FEW',
          `Merged string '${mergedStr}' yielded <2 codes`,
          undefined,
          i + 1,
        ),
      )
      continue
    }
    const key = [...new Set(members)].sort().join('+')
    if (!groupKeys.has(key)) groupKeys.set(key, [...new Set(members)])
  }

  const merged: MergedGroup[] = []
  for (const [key, members] of groupKeys) {
    merged.push({
      id: `merge-${members.join('-')}`,
      course_codes: [...members].sort(),
      rationale: `Source row group: ${key}`,
    })
  }
  report.rows_out = merged.length
  return { merged, report }
}

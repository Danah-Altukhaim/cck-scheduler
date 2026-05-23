// Instructor → course certifications, derived from "List With Offered Courses By Staff.xlsx".
// The file has staff name + course NAME only (no code), so we have to join by
// course name → course code. Name matching is lossy: we fold whitespace, drop
// commas, lowercase, and try suffix variants.

import xlsx from 'xlsx'
import type { Course, IngestReport, Instructor } from '../model/types.js'
import { cellStr, nameKey, warn } from '../lib/util.js'

function courseNameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/[\.\,]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function loadCertifications(args: {
  path: string
  instructors: Instructor[]
  courses: Course[]
  instructorNameIndex: Map<string, string>
}): { report: IngestReport; certs: Map<string, Set<string>> } {
  // certs: instructorId → Set<courseCode>
  const certs = new Map<string, Set<string>>()
  const report: IngestReport = {
    source: 'List With Offered Courses By Staff.xlsx',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: [
      'Course names matched to codes via normalized lowercase keys.',
      'Rows where either the instructor or the course name fail to resolve are dropped with a warning.',
    ],
  }

  // Build course-name → code index
  const courseByName = new Map<string, string>()
  for (const c of args.courses) {
    courseByName.set(courseNameKey(c.name_en), c.code)
  }

  const wb = xlsx.readFile(args.path)
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) {
    report.warnings.push(warn('error', 'CERT_SHEET_MISSING', 'Sheet1 missing'))
    return { report, certs }
  }
  const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[]
    const staffRaw = cellStr(row[0])
    const courseNameRaw = cellStr(row[1])
    if (!staffRaw || !courseNameRaw) continue
    report.rows_in++
    const instructorId = args.instructorNameIndex.get(nameKey(staffRaw))
    if (!instructorId) {
      report.warnings.push(
        warn(
          'warn',
          'CERT_STAFF_UNRESOLVED',
          `Could not resolve instructor '${staffRaw}' to roster.`,
          undefined,
          i + 1,
        ),
      )
      continue
    }
    const cnk = courseNameKey(courseNameRaw)
    let code = courseByName.get(cnk)
    if (!code) {
      // Try a relaxed lookup: drop trailing roman-numeral suffixes.
      const relaxed = cnk
        .replace(/\b(i|ii|iii|iv|v|vi)\b$/, '')
        .replace(/\s+/g, ' ')
        .trim()
      for (const [k, v] of courseByName) {
        if (k.startsWith(relaxed) && relaxed.length > 6) {
          code = v
          break
        }
      }
    }
    if (!code) {
      report.warnings.push(
        warn(
          'info',
          'CERT_COURSE_UNRESOLVED',
          `Course '${courseNameRaw}' not in catalog (instructor '${staffRaw}').`,
          undefined,
          i + 1,
        ),
      )
      continue
    }
    let s = certs.get(instructorId)
    if (!s) {
      s = new Set()
      certs.set(instructorId, s)
    }
    s.add(code)
    report.rows_out++
  }

  // Mutate instructors with their certifications.
  for (const inst of args.instructors) {
    const s = certs.get(inst.id)
    if (s) inst.certifications = [...s].sort()
  }
  // Mutate courses with their certified instructors.
  for (const c of args.courses) {
    const ids: string[] = []
    for (const [iid, s] of certs) if (s.has(c.code)) ids.push(iid)
    c.certified_instructors = ids
  }

  return { report, certs }
}

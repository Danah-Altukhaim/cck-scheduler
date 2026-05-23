// Unified instructor roster.
// Two source files disagree on names; both miss the 6 active part-timers who
// appear in past schedules. We merge all three sources into one canonical
// roster, tracking provenance per instructor.

import xlsx from 'xlsx'
import type {
  Instructor,
  IngestReport,
  Rank,
  EmploymentType,
  IngestWarning,
} from '../model/types.js'
import { cellStr, cellNum, nameKey, nameToId, normalizeName, warn } from '../lib/util.js'

// Weekly cap by rank (from Per-instructor Availability.xlsx).
const RANK_CAPS: Record<Rank, number> = {
  Professor: 15,
  'Associate Professor': 20,
  'Assistant Professor': 20,
  'Senior Lecturer': 25,
  Lecturer: 25,
  'Assistant Lecturer': 25,
  'Senior Instructor': 30,
  Instructor: 30,
  'Assistant Instructor': 30,
  Unknown: 25,
}

function parseRank(raw: string | null): Rank {
  if (!raw) return 'Unknown'
  const s = raw.toLowerCase().replace(/\s*[-–]\s*part\s*time/, '').trim()
  if (s.includes('associate prof')) return 'Associate Professor'
  if (s.includes('assistant prof')) return 'Assistant Professor'
  if (s === 'professor' || s.startsWith('professor')) return 'Professor'
  if (s.includes('senior lecturer')) return 'Senior Lecturer'
  if (s.includes('assistant lecturer') || s.includes('assisstant lecturer'))
    return 'Assistant Lecturer'
  if (s.includes('lecturer')) return 'Lecturer'
  if (s.includes('senior instructor')) return 'Senior Instructor'
  if (s.includes('assistant instructor') || s.includes('assisstant instructor'))
    return 'Assistant Instructor'
  if (s.includes('instructor')) return 'Instructor'
  return 'Unknown'
}

function parseEmployment(typeRaw: string | null, qualif: string | null): EmploymentType {
  const s = (typeRaw || '').toLowerCase()
  if (s.includes('hod') || s.includes('head of department')) return 'HOD'
  if (s.includes('part') || s === 'p/t' || s === 'pt') return 'part-time'
  if (s.includes('full') || s === 'ft') return 'full-time'
  // Acadamic Staff sheet has 'Assistant Professor – Part time' in job-title cell;
  // catch this via qualif/job-title combo.
  if (qualif && qualif.toLowerCase().includes('part')) return 'part-time'
  return 'full-time'
}

interface RawRow {
  name: string
  rank: Rank
  department: string
  employment: EmploymentType
  source: Instructor['source'][number]
  email?: string
  load?: number
}

// Parse Instructor Lists.xlsx — has emails + departments + Type column (HOD/FT/PT).
function parseInstructorList(path: string, report: IngestReport): RawRow[] {
  const wb = xlsx.readFile(path)
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) return []
  const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
  const out: RawRow[] = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[]
    const name = cellStr(row[0])
    if (!name) continue
    report.rows_in++
    const dept = cellStr(row[1]) || ''
    const rankRaw = cellStr(row[2])
    const email = cellStr(row[3]) || undefined
    const typeRaw = cellStr(row[4])
    const cleaned = normalizeName(name)
    const r: RawRow = {
      name: cleaned,
      rank: parseRank(rankRaw),
      department: dept,
      employment: parseEmployment(typeRaw, rankRaw),
      source: 'instructor-list',
    }
    if (email) r.email = email.replace(/[><]/g, '').trim()
    out.push(r)
  }
  return out
}

// Parse Acadamic Staff Data.xlsx — has qualification + load (PT only).
function parseAcademicStaff(path: string, report: IngestReport): RawRow[] {
  const wb = xlsx.readFile(path)
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) return []
  const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
  const out: RawRow[] = []
  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[]
    const name = cellStr(row[0])
    if (!name) continue
    report.rows_in++
    const jobTitle = cellStr(row[1])
    const qualif = cellStr(row[2])
    const faculty = cellStr(row[3]) || ''
    const ftpt = cellStr(row[4])
    const load = cellNum(row[5])
    const remarks = cellStr(row[6])
    const r: RawRow = {
      name: normalizeName(name),
      rank: parseRank(jobTitle),
      department: faculty.trim(),
      employment: parseEmployment(ftpt, jobTitle),
      source: 'academic-staff',
    }
    if (remarks && remarks.toLowerCase().includes('head of department')) r.employment = 'HOD'
    if (load != null) r.load = load
    if (qualif) {
      // not stored as a separate field — left for future use
    }
    out.push(r)
  }
  return out
}

export interface LoadInstructorsArgs {
  instructorListPath: string
  academicStaffPath: string
  // Names observed in past schedules — used to surface missing-from-roster instructors.
  scheduleNames: Set<string>
}

export function loadInstructors(args: LoadInstructorsArgs): {
  instructors: Instructor[]
  report: IngestReport
  // Map: nameKey → instructor.id — used by schedule ingester to look up.
  nameIndex: Map<string, string>
} {
  const report: IngestReport = {
    source: 'Instructor Lists.xlsx + Acadamic Staff Data.xlsx + past schedules',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: [
      "Names normalized: honorifics stripped, &apos; → ', curly apostrophes folded.",
      'Two source rosters merged on nameKey; conflicting fields prefer Acadamic Staff Data (richer).',
      'Instructors found in past schedules but absent from both rosters are flagged status=missing-from-roster.',
    ],
  }

  const fromList = parseInstructorList(args.instructorListPath, report)
  const fromStaff = parseAcademicStaff(args.academicStaffPath, report)

  // Merge by nameKey. Start with academic-staff (richer) then merge instructor-list.
  const byKey = new Map<string, { rec: Instructor; raw: RawRow[] }>()

  function upsert(raw: RawRow) {
    const key = nameKey(raw.name)
    if (!key) return
    let entry = byKey.get(key)
    if (!entry) {
      const inst: Instructor = {
        id: nameToId(raw.name),
        name: raw.name,
        name_aliases: [raw.name],
        rank: raw.rank,
        department: raw.department,
        employment: raw.employment,
        weekly_cap_hours: raw.employment === 'HOD' ? 12 : RANK_CAPS[raw.rank],
        daily_cap_hours: 6, // §6 H8: 6h/day cap universal
        certifications: [],
        availability_windows: [],
        source: [raw.source],
        status: 'active',
      }
      entry = { rec: inst, raw: [raw] }
      byKey.set(key, entry)
    } else {
      entry.raw.push(raw)
      if (!entry.rec.source.includes(raw.source)) entry.rec.source.push(raw.source)
      if (!entry.rec.name_aliases.includes(raw.name)) entry.rec.name_aliases.push(raw.name)
      // Prefer the academic-staff record for rank/employment when both present.
      if (raw.source === 'academic-staff') {
        if (entry.rec.rank === 'Unknown') entry.rec.rank = raw.rank
        if (raw.employment === 'HOD' || entry.rec.employment !== 'HOD')
          entry.rec.employment = raw.employment
        entry.rec.department = raw.department || entry.rec.department
        entry.rec.weekly_cap_hours =
          entry.rec.employment === 'HOD' ? 12 : RANK_CAPS[entry.rec.rank]
      }
      if (raw.email && !entry.rec.email) entry.rec.email = raw.email
      if (raw.load != null) entry.rec.load_spring_25_26 = raw.load
    }
  }

  for (const r of fromStaff) upsert(r)
  for (const r of fromList) upsert(r)

  // Detect schedule-only names. Past-schedules pass nameKeys directly.
  for (const rawSchedName of args.scheduleNames) {
    const key = nameKey(rawSchedName)
    if (!key) continue
    if (byKey.has(key)) {
      const entry = byKey.get(key)!
      if (!entry.rec.source.includes('past-schedule'))
        entry.rec.source.push('past-schedule')
      if (!entry.rec.name_aliases.includes(rawSchedName))
        entry.rec.name_aliases.push(rawSchedName)
      continue
    }
    // Not found — synthesize a ghost instructor.
    const clean = normalizeName(rawSchedName)
    const inst: Instructor = {
      id: nameToId(clean),
      name: clean,
      name_aliases: [rawSchedName, clean],
      rank: 'Unknown',
      department: 'Unknown',
      employment: 'part-time',
      weekly_cap_hours: 25,
      daily_cap_hours: 6,
      certifications: [],
      availability_windows: [],
      source: ['past-schedule'],
      status: 'missing-from-roster',
    }
    byKey.set(key, { rec: inst, raw: [] })
    report.warnings.push(
      warn(
        'warn',
        'INSTRUCTOR_GHOST',
        `Instructor '${clean}' appears in past schedules but is absent from both rosters — added as missing-from-roster.`,
        'past-schedule',
      ),
    )
  }

  const instructors = [...byKey.values()].map((e) => e.rec)
  const nameIndex = new Map<string, string>()
  for (const i of instructors) {
    for (const alias of i.name_aliases) {
      const k = nameKey(alias)
      if (k && !nameIndex.has(k)) nameIndex.set(k, i.id)
    }
  }

  // Final cross-check: ranks the staff sheet was vague on.
  for (const i of instructors) {
    if (i.rank === 'Unknown' && i.status === 'active') {
      report.warnings.push(
        warn(
          'info',
          'RANK_UNKNOWN',
          `Could not derive rank for '${i.name}'; defaulting weekly cap to 25h.`,
        ),
      )
    }
  }

  report.rows_out = instructors.length
  return { instructors, report, nameIndex }
}

// Re-export the rank cap table so callers can show it in the AI explainer.
export const RANK_WEEKLY_CAPS: Readonly<Record<Rank, number>> = RANK_CAPS

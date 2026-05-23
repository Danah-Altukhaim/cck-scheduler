// Normalize past SIS schedule files into the canonical Assignment shape.
// Used as: (a) regression baseline for the solver, and (b) source of truth for
// the 6 instructors who are active but missing from both rosters.
//
// Dirty data we handle:
//   - Duplicate day codes ('M,Th,Th' → ['M','Th'], with a warning).
//   - 5-day-week rows that are almost certainly typos — flagged.
//   - Three room-naming conventions resolved via the room registry.
//   - 'Teaching Method' column has stray ENL/ICT/MAT — flagged as data errors.
//   - 'Study Language' column is universally 'ALL' in Fall (broken at source).

import xlsx from 'xlsx'
import type {
  Assignment,
  IngestReport,
  Room,
  Day,
} from '../model/types.js'
import { cellStr, nameKey, normalizeName, parseDays, parseSlot, warn } from '../lib/util.js'
import { resolveRoom } from './rooms.js'

const VALID_DURATIONS = new Set([50, 75, 100, 120]) // per H9; allow 100 (2x50 lab) too
const NEAR_VALID_DURATIONS = new Set([50, 60, 65, 70, 75, 80, 90, 100, 105, 110, 120, 150])

export interface PastScheduleResult {
  assignments: Assignment[]
  // Names exactly as they appeared in the file — fed into the instructor merger.
  instructorNamesRaw: Set<string>
  report: IngestReport
}

export function loadPastSchedule(args: {
  path: string
  label: string // 'Fall 25-26' | 'Spring 25-26'
  rooms: Room[]
  // After instructors are loaded, the runner re-maps assignment instructor_ids
  // by passing the nameIndex back through this function via `instructorNameIndex`.
  instructorNameIndex?: Map<string, string>
}): PastScheduleResult {
  const report: IngestReport = {
    source: args.path,
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: [
      'Each schedule row may have multi-day pattern; expanded into one Assignment per day.',
      'Slots with non-canonical durations (anything outside {50,75,100,120}) are kept but flagged.',
    ],
  }

  const wb = xlsx.readFile(args.path)
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) {
    report.warnings.push(warn('error', 'PAST_SHEET_MISSING', 'Sheet1 missing'))
    return { assignments: [], instructorNamesRaw: new Set(), report }
  }
  const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

  const assignments: Assignment[] = []
  const instructorNamesRaw = new Set<string>()

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[]
    const courseCode = cellStr(row[0])
    const teachingMethod = cellStr(row[2])
    const staffName = cellStr(row[3])
    const section = cellStr(row[4])
    const dayRaw = cellStr(row[5])
    const slotRaw = cellStr(row[6])
    const roomRaw = cellStr(row[7])
    if (!courseCode) continue
    report.rows_in++

    // Validate teaching method
    if (teachingMethod && !['Lecture', 'Lab'].includes(teachingMethod)) {
      report.warnings.push(
        warn(
          'warn',
          'METHOD_STRAY',
          `Teaching Method = '${teachingMethod}' (expected Lecture|Lab) row ${i + 1}`,
          args.label,
          i + 1,
        ),
      )
    }

    // Parse day(s)
    if (!dayRaw) {
      report.warnings.push(
        warn('warn', 'DAY_MISSING', `Day column empty for ${courseCode}`, args.label, i + 1),
      )
      continue
    }
    const { days, warnings: dayWarns } = parseDays(dayRaw)
    for (const w of dayWarns) {
      report.warnings.push(warn('warn', w.code, w.message, args.label, i + 1))
    }
    // Reject Saturday in non-Saturday terms — flag, don't drop.
    if (days.includes('Sa')) {
      report.warnings.push(
        warn(
          'warn',
          'DAY_SATURDAY',
          `Saturday encountered in ${args.label} for ${courseCode}; will be kept but flagged.`,
          args.label,
          i + 1,
        ),
      )
    }
    if (days.length >= 5) {
      report.warnings.push(
        warn(
          'warn',
          'DAY_FIVE_DAYS',
          `Implausible 5+ day week for ${courseCode} (raw='${dayRaw}') — likely SIS typo.`,
          args.label,
          i + 1,
        ),
      )
    }
    if (days.length === 0) continue

    // Parse slot
    if (!slotRaw) {
      report.warnings.push(
        warn(
          'warn',
          'SLOT_MISSING',
          `Slot empty for ${courseCode} row ${i + 1}`,
          args.label,
          i + 1,
        ),
      )
      continue
    }
    const slot = parseSlot(slotRaw)
    if (!slot) {
      report.warnings.push(
        warn(
          'warn',
          'SLOT_PARSE_FAIL',
          `Slot '${slotRaw}' did not parse`,
          args.label,
          i + 1,
        ),
      )
      continue
    }
    const dur = slot.end_min - slot.start_min
    if (!VALID_DURATIONS.has(dur)) {
      const code = NEAR_VALID_DURATIONS.has(dur) ? 'DURATION_DEVIATION' : 'DURATION_INVALID'
      report.warnings.push(
        warn(
          'info',
          code,
          `Duration ${dur}min for ${courseCode} not in canonical {50,75,100,120}`,
          args.label,
          i + 1,
        ),
      )
    }

    // Resolve room
    let roomCode = ''
    if (roomRaw) {
      const cleaned = roomRaw.replace(/^Building\s+one\s*\/\s*/i, '')
      const r = resolveRoom(args.rooms, cleaned)
      if (r) {
        roomCode = r.code
      } else {
        report.warnings.push(
          warn(
            'warn',
            'ROOM_UNKNOWN',
            `Could not resolve room '${roomRaw}' to registry`,
            args.label,
            i + 1,
          ),
        )
      }
    }

    // Resolve instructor (deferred — we just record the raw name, then re-map after merging rosters)
    let instructorId = ''
    if (staffName) {
      instructorNamesRaw.add(staffName)
      if (args.instructorNameIndex) {
        const id = args.instructorNameIndex.get(nameKey(staffName))
        if (id) instructorId = id
      }
    }

    const sectionKey = section ? String(section).trim().toLowerCase() : '1'
    const isIndp = /^(indp|independent)$/i.test(sectionKey)
    const baseId = `${courseCode.toUpperCase()}-${normalizeName(staffName || 'tba')
      .toLowerCase()
      .replace(/\s+/g, '-')}-${sectionKey}`

    for (const d of days as Day[]) {
      assignments.push({
        section_id: `${baseId}-${d}`,
        day: d,
        start_min: slot.start_min,
        end_min: slot.end_min,
        room_code: roomCode,
        instructor_id: instructorId,
        pinned: isIndp, // independents are essentially pinned
        source: 'past-schedule',
      })
      report.rows_out++
    }
  }

  return { assignments, instructorNamesRaw, report }
}

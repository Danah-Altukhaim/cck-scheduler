// Export the current solver schedule to an SIS-compatible xlsx workbook.
//
// Column shape from CCK Scheduler Docs/Fall Schedule 25-26 - SIS version.xlsx:
//   Course Code | Course Name | Teaching Method | Staff Name | Section
//   | Day | Slot | Building/Room | Study Language
//
// Multi-day sections are emitted as ONE row (day pattern = "M,W"), matching
// SIS conventions. The script reads from data/schedule.json + data/term-plan.json
// and writes data/cck-schedule-export.xlsx.

import { readFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as XLSX from 'xlsx'
import type {
  Assignment,
  Course,
  Instructor,
  Room,
  Section,
  TermPlan,
  Day,
} from '../src/model/types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// The schedule folder to export is passed as the first argument.
const scheduleDirArg = process.argv[2]
if (!scheduleDirArg) {
  console.error('usage: export-sis.ts <scheduleDir>')
  process.exit(2)
}
const DATA = resolve(scheduleDirArg)
mkdirSync(DATA, { recursive: true })

const plan = JSON.parse(readFileSync(join(DATA, 'term-plan.json'), 'utf8')) as TermPlan
const sched = JSON.parse(readFileSync(join(DATA, 'schedule.json'), 'utf8')) as {
  assignments: Assignment[]
}

const rooms = new Map<string, Room>(plan.rooms.map((r) => [r.code, r]))
const insts = new Map<string, Instructor>(plan.instructors.map((i) => [i.id, i]))
const courses = new Map<string, Course>(plan.courses.map((c) => [c.code, c]))
const sections = new Map<string, Section>((plan.sections || []).map((s) => [s.id, s]))

// Group assignments by section so day-meetings collapse into one row.
const grouped = new Map<string, Assignment[]>()
for (const a of sched.assignments) {
  if (!grouped.has(a.section_id)) grouped.set(a.section_id, [])
  grouped.get(a.section_id)!.push(a)
}

const dayOrder: Day[] = ['Su', 'M', 'T', 'W', 'Th', 'Sa']

function fmtSlot(start: number, end: number): string {
  const h = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
  return `${h(start)}-${h(end)}`
}

function buildingFromRoom(roomCode: string): string {
  // Heuristic: rooms starting with B1 → Building one, B2 → Building two, A2 → Maple Leaf, etc.
  if (roomCode.startsWith('B1')) return 'Building one'
  if (roomCode.startsWith('B2')) return 'Building two'
  if (roomCode.startsWith('A2')) return 'Maple Leaf'
  if (roomCode.startsWith('LAB')) return 'Building one'
  return ''
}

function langForExport(lang: string): string {
  if (lang === 'en') return 'English'
  if (lang === 'ar') return 'Arabic'
  return 'ALL'
}

function teachingMethod(course?: Course): string {
  if (!course) return 'Lecture'
  if (course.type === 'lab') return 'Lab'
  return 'Lecture'
}

// Per-section sequential number within course.
const sectionNumMap = new Map<string, number>()
const courseCounter = new Map<string, number>()
for (const s of plan.sections || []) {
  const n = (courseCounter.get(s.course_code) || 0) + 1
  courseCounter.set(s.course_code, n)
  sectionNumMap.set(s.id, n)
}

const header = [
  'Course Code',
  'Course Name',
  'Teaching Method',
  'Staff Name',
  'Section',
  'Day',
  'Slot',
  'Building/Room',
  'Study Language',
]

const rowsOut: (string | number)[][] = [header]

// Sort sections by course code then by section id for stable output.
const sortedSecIds = [...grouped.keys()].sort()

for (const secId of sortedSecIds) {
  const ass = grouped.get(secId)!
  const sec = sections.get(secId)
  const course = sec ? courses.get(sec.course_code) : undefined
  const inst = insts.get(ass[0]!.instructor_id)
  // Day pattern (collapse): sort unique days in canonical order.
  const days = [...new Set(ass.map((a) => a.day))].sort(
    (a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b),
  )
  const dayStr = days.join(',')
  // All same time across days (solver guarantees this).
  const slot = fmtSlot(ass[0]!.start_min, ass[0]!.end_min)
  const room = rooms.get(ass[0]!.room_code)
  const roomStr = `${buildingFromRoom(ass[0]!.room_code)}/${ass[0]!.room_code}`
  rowsOut.push([
    sec?.course_code || '',
    course?.name_en || '',
    teachingMethod(course),
    inst?.name || ass[0]!.instructor_id,
    sectionNumMap.get(secId) ?? 1,
    dayStr,
    slot,
    roomStr,
    langForExport(sec?.language || 'both'),
  ])
}

// Append unplaced sections at the bottom with empty slot/room (for visibility).
const placedSecIds = new Set(sortedSecIds)
const unplaced = (plan.sections || []).filter((s) => !placedSecIds.has(s.id))
for (const s of unplaced) {
  const course = courses.get(s.course_code)
  rowsOut.push([
    s.course_code,
    course?.name_en || '',
    teachingMethod(course),
    '[UNPLACED]',
    sectionNumMap.get(s.id) ?? 1,
    '',
    '',
    '',
    langForExport(s.language),
  ])
}

const ws = XLSX.utils.aoa_to_sheet(rowsOut)
// Column widths for legibility
ws['!cols'] = [
  { wch: 12 }, // Course Code
  { wch: 45 }, // Course Name
  { wch: 14 }, // Teaching Method
  { wch: 40 }, // Staff Name
  { wch: 10 }, // Section
  { wch: 14 }, // Day
  { wch: 14 }, // Slot
  { wch: 24 }, // Building/Room
  { wch: 14 }, // Study Language
]
const wb = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(wb, ws, `${plan.term.season}-${plan.term.year}`)
const outPath = join(DATA, 'cck-schedule-export.xlsx')
XLSX.writeFile(wb, outPath)

console.log(`Wrote ${outPath}`)
console.log(`  Placed sections: ${sortedSecIds.length}`)
console.log(`  Unplaced sections (in output as [UNPLACED]): ${unplaced.length}`)
console.log(`  Total rows: ${rowsOut.length - 1}`)

// Server-side JSON loader. Reads ../data/*.json relative to this app dir.
// Loaded once per request in dev; in prod (next build) the files are inlined
// in the build via Next's outputFileTracingIncludes hint.

import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { scheduleDir } from './paths'

// Re-export client-safe types and helpers so existing imports keep working.
export {
  OPERATING_DAYS,
  DAY_LABEL,
  minToHHMM,
  durationMin,
  courseClass,
} from './format'
export type { Day, TimeBucket } from './format'

import type { Day, TimeBucket } from './format'

export interface Room {
  code: string
  display_name: string
  aliases: string[]
  type: 'lecture' | 'lab' | 'special'
  floor: 'ground' | 'first' | 'second' | 'unknown'
  capacity: number
}

export interface Instructor {
  id: string
  name: string
  rank: string
  department: string
  employment: 'full-time' | 'part-time' | 'HOD'
  weekly_cap_hours: number
  daily_cap_hours: number
  certifications: string[]
  status: 'active' | 'missing-from-roster'
  email?: string
}

export interface Course {
  code: string
  name_en: string
  name_ar?: string
  credits: number
  teaching_hours?: number
  type: 'lecture' | 'lab' | 'lecture+lab'
  lecture_pattern: string
  certified_instructors: string[]
  offered_languages: string[]
  programs: string[]
}

export interface Section {
  id: string
  course_code: string
  language: string
  time_bucket: TimeBucket
  enrollment_cap: number
  working_student_flag: boolean
  pattern: string
}

export interface Assignment {
  section_id: string
  day: Day
  start_min: number
  end_min: number
  room_code: string
  instructor_id: string
  pinned: boolean
  source: string
}

export interface MajorSheet {
  program_code: string
  name: string
  level: string
  semester_blocks: { semester: number; required_courses: string[] }[]
}

export interface MergedGroup {
  id: string
  course_codes: string[]
  rationale?: string
}

export interface EnrollmentRecord {
  id: string
  major: string
  language: string
  working_student: boolean
  puc: boolean
  count: number
}

export interface IngestReport {
  source: string
  rows_in: number
  rows_out: number
  warnings: { severity: string; code: string; message: string; file?: string; row?: number | string }[]
  notes: string[]
}

export interface ManualSection {
  id: string
  course_code: string
  language: 'en' | 'ar' | 'both'
  enrollment_cap: number
  reason?: string
  day: Day
  start_min: number
  end_min: number
  room_code: string
  instructor_id: string
}

export interface TermPlan {
  generated_at: string
  term: { year: number; season: string; operating_days: Day[]; operating_window: { start_min: number; end_min: number } }
  rooms: Room[]
  instructors: Instructor[]
  courses: Course[]
  majors: MajorSheet[]
  merged_groups: MergedGroup[]
  sections: Section[]
  enrollment?: EnrollmentRecord[]
  baseline_assignments: Assignment[]
  reports: IngestReport[]
  // Independent / customized sections added manually by the registrar. The
  // solver carries these through as pinned assignments without re-allocating.
  manual_sections?: ManualSection[]
}

export interface Schedule {
  term: TermPlan['term']
  assignments: Assignment[]
}

// ---- loader (per schedule) ------------------------------------------------

const termPlanCache = new Map<string, TermPlan>()
const scheduleCache = new Map<string, Schedule>()

export function getTermPlan(scheduleId: string): TermPlan {
  let p = termPlanCache.get(scheduleId)
  if (!p) {
    const raw = readFileSync(join(scheduleDir(scheduleId), 'term-plan.json'), 'utf8')
    p = JSON.parse(raw) as TermPlan
    termPlanCache.set(scheduleId, p)
  }
  return p
}

export function getSchedule(scheduleId: string): Schedule {
  let s = scheduleCache.get(scheduleId)
  if (!s) {
    try {
      s = JSON.parse(
        readFileSync(join(scheduleDir(scheduleId), 'schedule.json'), 'utf8'),
      ) as Schedule
    } catch {
      // Not solved yet — return an empty schedule.
      s = { term: getTermPlan(scheduleId).term, assignments: [] }
    }
    scheduleCache.set(scheduleId, s)
  }
  return s
}

export function getScheduleMtime(scheduleId: string): Date | null {
  try {
    return statSync(join(scheduleDir(scheduleId), 'schedule.json')).mtime
  } catch {
    return null
  }
}

// Drop in-process caches so the next request re-reads from disk. Called after
// the solver or an edit rewrites a schedule's JSON.
export function clearDataCache(scheduleId?: string): void {
  if (scheduleId) {
    termPlanCache.delete(scheduleId)
    scheduleCache.delete(scheduleId)
  } else {
    termPlanCache.clear()
    scheduleCache.clear()
  }
}

export function getSolveReport(scheduleId: string): string {
  try {
    return readFileSync(join(scheduleDir(scheduleId), 'solve-report.md'), 'utf8')
  } catch {
    return ''
  }
}

export function getIngestReport(scheduleId: string): string {
  try {
    return readFileSync(join(scheduleDir(scheduleId), 'ingest-report.md'), 'utf8')
  } catch {
    return ''
  }
}


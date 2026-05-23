// Domain model for the CCK AI Scheduler.
// Every entity defined here is the canonical, post-ingestion shape — parsers
// are responsible for cleaning source data into these types before anything
// downstream (rules, solvers) ever sees it.

export type Season = 'Fall' | 'Spring'
export type Day = 'Sa' | 'Su' | 'M' | 'T' | 'W' | 'Th'
export type Language = 'en' | 'ar' | 'both'
export type TimeBucket = 'morning' | 'midday' | 'evening'
export type SectionType = 'lecture' | 'lab' | 'lecture+lab'
export type RoomType = 'lecture' | 'lab' | 'special'
export type InstructorStatus = 'active' | 'missing-from-roster'
export type EmploymentType = 'full-time' | 'part-time' | 'HOD'
export type Rank =
  | 'Professor'
  | 'Associate Professor'
  | 'Assistant Professor'
  | 'Senior Lecturer'
  | 'Lecturer'
  | 'Assistant Lecturer'
  | 'Senior Instructor'
  | 'Instructor'
  | 'Assistant Instructor'
  | 'Unknown'

// 'lab+lecture' covers the special CP/IAWD 4-credit split: 2h lecture + 2h lab.
// '3x50', '2x75' apply to 3-credit; '3x75', '2x120' apply to 4-credit.
export type LecturePattern = '3x50' | '2x75' | '3x75' | '2x120' | 'lab+lecture' | 'irregular'

export interface Term {
  year: number
  season: Season
  operating_days: Day[] // typically Su–Th, Sa only if explicitly enabled
  operating_window: { start_min: number; end_min: number } // minutes since 00:00
}

export interface Room {
  code: string // canonical, e.g. 'B2-004', 'LAB-031', 'A2-147'
  display_name: string // human-friendly, e.g. 'Maple Leaf (A2-147)'
  aliases: string[] // every spelling we've seen in source data
  type: RoomType
  floor: 'ground' | 'first' | 'second' | 'unknown'
  capacity: number
}

export interface AvailabilityWindow {
  days: Day[]
  start_min: number
  end_min: number
}

export interface Instructor {
  id: string // slug from canonical name
  name: string // canonical display name
  name_aliases: string[] // all spellings encountered across rosters and schedules
  rank: Rank
  department: string
  employment: EmploymentType
  weekly_cap_hours: number // derived from rank (per Per-instructor Availability.xlsx)
  daily_cap_hours: number // 6h universal, 12h for HOD per H10/§6
  certifications: string[] // course codes this instructor can teach
  availability_windows: AvailabilityWindow[] // empty = unconstrained
  source: ('instructor-list' | 'academic-staff' | 'past-schedule')[]
  status: InstructorStatus
  email?: string
  load_spring_25_26?: number // total teaching hrs reported (PT only)
}

export interface Course {
  code: string
  name_en: string
  name_ar?: string
  credits: number
  // Actual weekly teaching hours. For most courses this equals `credits`; the
  // doc calls out that some have teaching hours that diverge from credits, so
  // we keep it as an explicit override field.
  teaching_hours?: number
  type: SectionType
  lecture_pattern: LecturePattern
  requires_lab: boolean
  certified_instructors: string[] // instructor ids
  offered_languages: Language[]
  // Programs this course appears under; cohort no-conflict uses this transitively
  // through MajorSheet.semester_blocks, but we keep the raw mapping for debugging.
  programs: string[]
}

export interface SemesterBlock {
  semester: number // 1..8
  required_courses: string[]
}

export interface MajorSheet {
  program_code: string // slug, e.g. 'DIPLOMA-ACCOUNTING'
  name: string // full title from sheet
  level: 'Diploma' | 'Bachelor'
  semester_blocks: SemesterBlock[]
}

export interface MergedGroup {
  id: string // synthesized, e.g. 'merge-ACC0014-BUAC3100'
  course_codes: string[]
  rationale?: string
}

// A cell of projected student demand: how many students of a given profile
// are enrolling in a major this term. Drives Stage 1 when present.
export interface EnrollmentRecord {
  id: string // synthesized
  major: string // MajorSheet.program_code
  language: Language
  working_student: boolean
  puc: boolean // PUC-funded vs self-funded
  count: number
}

export interface Section {
  id: string // synthesized: <COURSE>-<LANG>-<BUCKET>-<N>
  course_code: string
  language: Language
  time_bucket: TimeBucket
  enrollment_cap: number
  working_student_flag: boolean
  merged_group_id?: string
  // Independent sections from past schedules carry a tag so we can carry them
  // through without forcing them through the same allocator.
  is_independent?: boolean
  pattern: LecturePattern // inherits from course; can be overridden
}

export interface Assignment {
  section_id: string
  day: Day
  start_min: number
  end_min: number
  room_code: string
  instructor_id: string
  pinned: boolean
  source: 'solver' | 'manual' | 'past-schedule' | 'ai'
}

// A schedule is a list of Assignments + the inputs that produced it.
export interface Schedule {
  term: Term
  assignments: Assignment[]
}

// ----- Rules -----------------------------------------------------------------

export type RuleKind = 'hard' | 'soft'

export interface RuleContext {
  rooms: Map<string, Room>
  instructors: Map<string, Instructor>
  courses: Map<string, Course>
  sections: Map<string, Section>
  merged: MergedGroup[]
  majors: MajorSheet[]
  term: Term
}

export interface RuleCheckResult {
  ok: boolean
  violation?: string
}

export interface Rule {
  id: string // 'H1', 'S1', etc
  name: string
  description: string
  kind: RuleKind
  weight: number
  // For schedule-level checks, the proposed assignment is the one currently being
  // evaluated and `schedule` is the partial schedule before it was added.
  check: (
    proposed: Assignment,
    schedule: Assignment[],
    ctx: RuleContext,
  ) => RuleCheckResult
}

// ----- Ingestion report shape -----------------------------------------------

export interface IngestWarning {
  severity: 'info' | 'warn' | 'error'
  code: string // e.g. 'DAY_DUPLICATE', 'ROOM_UNKNOWN'
  message: string
  file?: string
  row?: number | string
}

export interface IngestReport {
  source: string
  rows_in: number
  rows_out: number
  warnings: IngestWarning[]
  notes: string[]
}

// ----- Full normalized term plan written to disk ----------------------------

export interface TermPlan {
  generated_at: string
  term: Term
  rooms: Room[]
  instructors: Instructor[]
  courses: Course[]
  majors: MajorSheet[]
  merged_groups: MergedGroup[]
  sections: Section[] // optional — Stage 1 fills these
  enrollment?: EnrollmentRecord[] // projected demand entered by the registrar
  baseline_assignments: Assignment[] // past-term schedule normalized, regression baseline
  rule_doc_snippets: Record<string, string> // rules_doc.ts output
  equivalencies_summary: { cck_rows: number; paaet_rows: number; note: string }
  reports: IngestReport[]
}

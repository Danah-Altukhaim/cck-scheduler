// CP problem exporter.
//
// Turns a RuleContext + Stage-1 sections into a flat, JSON-serialisable
// "CP problem" that the Python OR-Tools CP-SAT solver (solver/cp_solve.py)
// consumes. We do all the domain work here — certification augmentation,
// room/instructor compatibility, day-pattern + start enumeration — so the
// Python side only has to build and solve the model.
//
// Hard rules and where they are enforced:
//   H3 capacity, H4 lab-room, H13 cert, H14 language → baked into each unit's
//     room_indices / instructor_indices (incompatible options never generated)
//   H9 duration → per_meeting_min derived from the lecture pattern
//   H7 Monday block, H12 operating window → baked into option generation
//   H1/H2 no double-booking, H8/H10 caps, H6 cohort → modelled in Python
//   H5 merged co-scheduling → merged sections collapsed into one unit here
//   H11 → registration-layer no-op

import type { Assignment, Day, LecturePattern, RuleContext, Section, Term } from '../model/types.js'
import { augmentCertifications } from './stage2_timetable.js'
import type { SolverConfig, CustomRule } from './config.js'

export interface CpOption {
  days: Day[]
  start_min: number
  end_min: number
  soft_penalty: number
}

export interface CpUnit {
  id: string
  member_section_ids: string[]
  course_code: string
  per_meeting_min: number
  n_meetings: number
  weekly_min: number
  options: CpOption[]
  room_indices: number[]
  instructor_indices: number[]
}

export interface CpHint {
  unit_id: string
  option: number
  room: number
  instructor: number
}

export interface CpProblem {
  term: Term
  rooms: { code: string; capacity: number }[]
  instructors: { id: string; weekly_cap_min: number; daily_cap_min: number }[]
  units: CpUnit[]
  cohort_pairs: [string, string][]
  hints: CpHint[]
  custom_rules: CustomRule[]
}

function patternMeetings(pat: LecturePattern): { perWeek: number; durationMin: number } {
  switch (pat) {
    case '3x50':
      return { perWeek: 3, durationMin: 50 }
    case '2x75':
      return { perWeek: 2, durationMin: 75 }
    case '3x75':
      return { perWeek: 3, durationMin: 75 }
    case '2x120':
      return { perWeek: 2, durationMin: 120 }
    case 'lab+lecture':
      return { perWeek: 2, durationMin: 120 }
    case 'irregular':
      return { perWeek: 2, durationMin: 75 }
  }
}

function dayChoices(perWeek: number): Day[][] {
  if (perWeek === 1) return [['Su'], ['M'], ['T'], ['W'], ['Th']]
  if (perWeek === 2)
    return [
      ['M', 'W'],
      ['Su', 'T'],
      ['T', 'Th'],
      ['Su', 'W'],
      ['Su', 'Th'],
      ['M', 'Th'],
    ]
  if (perWeek === 3)
    return [
      ['Su', 'T', 'Th'],
      ['M', 'W', 'Th'],
      ['Su', 'M', 'W'],
      ['M', 'T', 'Th'],
    ]
  return [['Su', 'M', 'T', 'W', 'Th']]
}

const GRID = 30
const GE_RE = /^(GED|GEN|GE|ENL|GEEC|GEPH|GECU)/

// Build the slot options (day-pattern × start) for a unit, each tagged with an
// option-local soft penalty. Options are generated within the bucket plus some
// spill into neighbouring hours (keeps the CP model from enumerating the whole
// day for every section); placing a section outside its strict Stage-1 bucket
// window is allowed but penalised.
function buildOptions(
  perWeek: number,
  dur: number,
  bucket: 'morning' | 'midday' | 'evening',
  isGeneral: boolean,
  workingStudent: boolean,
  config: SolverConfig,
): CpOption[] {
  const out: CpOption[] = []
  const strict = config.buckets[bucket]
  const bStart = strict.startMin
  const bEnd = strict.endMin
  const op = config.operatingWindow
  const gStart = Math.max(op.startMin, bStart - 120)
  const gEnd = Math.min(op.endMin, bEnd + 240)
  const mb = config.mondayBlock
  for (const days of dayChoices(perWeek)) {
    if (!days.every((d) => config.operatingDays.includes(d))) continue
    for (let start = gStart; start + dur <= gEnd; start += GRID) {
      const end = start + dur
      // H7 — configured reserved block.
      if (
        mb.enabled &&
        days.includes(mb.day as Day) &&
        start < mb.endMin &&
        end > mb.startMin
      ) {
        continue
      }
      let penalty = 0
      if (start < bStart || end > bEnd) penalty += 6 // outside Stage-1 bucket
      if (isGeneral && (start < 9 * 60 || end > 14 * 60)) penalty += 3 // S4
      if (workingStudent && start < 17 * 60) penalty += 4 // S5
      out.push({ days: days.slice(), start_min: start, end_min: end, soft_penalty: penalty })
    }
  }
  return out
}

export function buildCpProblem(
  ctx: RuleContext,
  sections: Section[],
  baselineAssignments: Assignment[] | undefined,
  config: SolverConfig,
): { problem: CpProblem; augNote: string } {
  const aug = augmentCertifications(ctx, baselineAssignments)
  const augNote = `Certification augmentation: +${aug.pairsAdded} pairs (${aug.coursesGained} courses via baseline, ${aug.deptFallbackCourses} via department-prefix fallback).`

  const rooms = [...ctx.rooms.values()]
  const roomIndex = new Map<string, number>(rooms.map((r, i) => [r.code, i]))
  const instructors = [...ctx.instructors.values()]
  const instIndex = new Map<string, number>(instructors.map((i, idx) => [i.id, idx]))

  // Group sections by merged group; a merged group becomes one unit.
  const groups = new Map<string, Section[]>()
  const standalone: Section[] = []
  for (const s of sections) {
    if (s.merged_group_id) {
      if (!groups.has(s.merged_group_id)) groups.set(s.merged_group_id, [])
      groups.get(s.merged_group_id)!.push(s)
    } else {
      standalone.push(s)
    }
  }

  // unitOf maps a section id → its unit id, for cohort-pair computation.
  const unitOf = new Map<string, string>()
  const units: CpUnit[] = []

  const makeUnit = (id: string, members: Section[]): CpUnit | null => {
    const rep = members[0]!
    const course = ctx.courses.get(rep.course_code)
    if (!course) return null

    // H14 — section language must be offered by the course.
    for (const m of members) {
      if (
        m.language !== 'both' &&
        !course.offered_languages.includes(m.language) &&
        !course.offered_languages.includes('both')
      ) {
        return null
      }
    }

    const enrollment = members.reduce((sum, m) => sum + m.enrollment_cap, 0)
    const { perWeek, durationMin } = patternMeetings(rep.pattern)

    // Compatible rooms — H3 capacity + H4 lab-room. Keep at most the 12
    // smallest sufficient rooms: more than enough choice for the solver while
    // keeping the CP model compact.
    const ROOM_CAP = 12
    let compatible = rooms.filter((r) => {
      if (r.capacity < enrollment) return false
      if (course.type === 'lab' && r.type !== 'lab' && r.type !== 'special') return false
      if (course.type === 'lecture' && r.type === 'lab') return false
      return true
    })
    if (course.type === 'lab' && compatible.length === 0) {
      // Lab-room shortage fallback: special rooms have lab benches in practice.
      compatible = rooms.filter((r) => r.type === 'special' && r.capacity >= enrollment)
    }
    const roomIdx = compatible
      .slice()
      .sort((a, b) => a.capacity - b.capacity)
      .slice(0, ROOM_CAP)
      .map((r) => roomIndex.get(r.code)!)

    // Certified instructors — H13 (empty certs = unrestricted).
    let instIdx: number[] = []
    for (const inst of instructors) {
      if (inst.certifications.length > 0 && !inst.certifications.includes(course.code)) continue
      instIdx.push(instIndex.get(inst.id)!)
    }
    if (instIdx.length === 0) instIdx = instructors.map((_, i) => i)

    const isGeneral = GE_RE.test(course.code)
    const workingStudent = members.some((m) => m.working_student_flag)
    const options = buildOptions(
      perWeek,
      durationMin,
      rep.time_bucket,
      isGeneral,
      workingStudent,
      config,
    )

    return {
      id,
      member_section_ids: members.map((m) => m.id),
      course_code: rep.course_code,
      per_meeting_min: durationMin,
      n_meetings: perWeek,
      weekly_min: durationMin * perWeek,
      options,
      room_indices: roomIdx,
      instructor_indices: instIdx,
    }
  }

  for (const s of standalone) {
    const u = makeUnit(s.id, [s])
    if (u) {
      units.push(u)
      unitOf.set(s.id, u.id)
    }
  }
  for (const [gid, members] of groups) {
    const u = makeUnit(gid, members)
    if (u) {
      units.push(u)
      for (const m of members) unitOf.set(m.id, u.id)
    }
  }

  // Cohort pairs — H6. Two single-section courses sharing a major-sheet
  // semester block must not overlap in time. We only block when BOTH courses
  // are single-section (a multi-section course gives students an out).
  const sectionsPerCourse = new Map<string, number>()
  for (const s of sections)
    sectionsPerCourse.set(s.course_code, (sectionsPerCourse.get(s.course_code) ?? 0) + 1)
  const courseToUnit = new Map<string, string>()
  for (const u of units) {
    if (sectionsPerCourse.get(u.course_code) === 1) courseToUnit.set(u.course_code, u.id)
  }
  const pairSet = new Set<string>()
  const cohortPairs: [string, string][] = []
  for (const major of ctx.majors) {
    for (const block of major.semester_blocks) {
      const single = block.required_courses.filter((c) => courseToUnit.has(c))
      for (let i = 0; i < single.length; i++) {
        for (let j = i + 1; j < single.length; j++) {
          const a = courseToUnit.get(single[i]!)!
          const b = courseToUnit.get(single[j]!)!
          if (a === b) continue
          const key = a < b ? `${a}|${b}` : `${b}|${a}`
          if (pairSet.has(key)) continue
          pairSet.add(key)
          cohortPairs.push([a, b])
        }
      }
    }
  }

  const problem: CpProblem = {
    term: ctx.term,
    rooms: rooms.map((r) => ({ code: r.code, capacity: r.capacity })),
    instructors: instructors.map((i) => ({
      id: i.id,
      weekly_cap_min: i.weekly_cap_hours * 60,
      daily_cap_min: i.daily_cap_hours * 60,
    })),
    units,
    cohort_pairs: cohortPairs,
    hints: [],
    custom_rules: config.customRules.filter((r) => r.enabled),
  }
  return { problem, augNote }
}

// Convert a schedule (e.g. from the greedy solver) into CP-SAT hints. Each
// hint warm-starts a unit at the option/room/instructor the greedy solver
// chose, so CP-SAT begins from a known-good solution and only improves. Units
// whose greedy placement does not map onto a generated option are skipped —
// partial hints are fine.
export function buildHints(problem: CpProblem, assignments: Assignment[]): CpHint[] {
  const roomIdxByCode = new Map(problem.rooms.map((r, i) => [r.code, i]))
  const instIdxById = new Map(problem.instructors.map((ins, i) => [ins.id, i]))
  const bySection = new Map<string, Assignment[]>()
  for (const a of assignments) {
    if (!bySection.has(a.section_id)) bySection.set(a.section_id, [])
    bySection.get(a.section_id)!.push(a)
  }

  const hints: CpHint[] = []
  for (const u of problem.units) {
    const repId = u.member_section_ids[0]
    const repAssigns = repId ? bySection.get(repId) : undefined
    if (!repAssigns || repAssigns.length === 0) continue
    const first = repAssigns[0]!
    const dayKey = [...new Set(repAssigns.map((a) => a.day))].sort().join(',')

    const optIdx = u.options.findIndex(
      (o) => [...o.days].sort().join(',') === dayKey && o.start_min === first.start_min,
    )
    if (optIdx < 0) continue
    const roomI = roomIdxByCode.get(first.room_code)
    const instI = instIdxById.get(first.instructor_id)
    if (roomI === undefined || instI === undefined) continue
    if (!u.room_indices.includes(roomI) || !u.instructor_indices.includes(instI)) continue

    hints.push({ unit_id: u.id, option: optIdx, room: roomI, instructor: instI })
  }
  return hints
}

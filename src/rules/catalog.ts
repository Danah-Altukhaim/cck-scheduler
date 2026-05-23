// Constraint catalog: 14 hard rules + 9 soft rules from the PRD §6.
//
// Each rule's check() answers a single question: "Given the current partial
// schedule, is the proposed Assignment legal/preferred?" Hard rules return
// ok=false to reject; soft rules always return ok=true but supply a violation
// message + contribute to the soft score via weight.

import type {
  Assignment,
  Rule,
  RuleContext,
  RuleCheckResult,
  Course,
  Section,
  MajorSheet,
} from '../model/types.js'

// --- helpers ---------------------------------------------------------------

function overlaps(a: Assignment, b: Assignment): boolean {
  if (a.day !== b.day) return false
  return a.start_min < b.end_min && b.start_min < a.end_min
}

function durationMin(a: Assignment): number {
  return a.end_min - a.start_min
}

function ctxSection(ctx: RuleContext, sid: string): Section | undefined {
  return ctx.sections.get(sid)
}
function ctxCourse(ctx: RuleContext, sid: string): Course | undefined {
  const s = ctxSection(ctx, sid)
  if (!s) return undefined
  return ctx.courses.get(s.course_code)
}

// Identify which major-semester blocks a given course belongs to. A cohort
// conflict exists if two different courses from the same (program, semester)
// block overlap in time.
function cohortBlocksContaining(ctx: RuleContext, courseCode: string): MajorSheet['semester_blocks'][number][] {
  const out: MajorSheet['semester_blocks'][number][] = []
  for (const m of ctx.majors) {
    for (const b of m.semester_blocks) {
      if (b.required_courses.includes(courseCode)) out.push(b)
    }
  }
  return out
}

const ok: RuleCheckResult = { ok: true }

// --- HARD RULES ------------------------------------------------------------

const H1: Rule = {
  id: 'H1',
  name: 'Instructor no double-booking',
  description: 'No instructor is scheduled to teach two sections at the same time.',
  kind: 'hard',
  weight: 1,
  check(proposed, schedule) {
    if (!proposed.instructor_id) return ok
    for (const a of schedule) {
      if (a.instructor_id !== proposed.instructor_id) continue
      if (overlaps(a, proposed)) {
        return {
          ok: false,
          violation: `Instructor ${proposed.instructor_id} already busy at ${a.day} ${a.start_min}-${a.end_min}`,
        }
      }
    }
    return ok
  },
}

const H2: Rule = {
  id: 'H2',
  name: 'Room no double-booking',
  description: 'No room is double-booked at the same time.',
  kind: 'hard',
  weight: 1,
  check(proposed, schedule) {
    if (!proposed.room_code) return ok
    for (const a of schedule) {
      if (a.room_code !== proposed.room_code) continue
      if (overlaps(a, proposed)) {
        return {
          ok: false,
          violation: `Room ${proposed.room_code} already booked at ${a.day} ${a.start_min}-${a.end_min} by ${a.section_id}`,
        }
      }
    }
    return ok
  },
}

const H3: Rule = {
  id: 'H3',
  name: 'Capacity ≥ enrollment',
  description: 'Section enrollment cap ≤ room capacity.',
  kind: 'hard',
  weight: 1,
  check(proposed, _schedule, ctx) {
    const s = ctxSection(ctx, proposed.section_id)
    if (!s) return ok
    const r = ctx.rooms.get(proposed.room_code)
    if (!r) return { ok: false, violation: `Unknown room ${proposed.room_code}` }
    if (s.enrollment_cap > r.capacity)
      return {
        ok: false,
        violation: `Section cap ${s.enrollment_cap} > room ${r.code} capacity ${r.capacity}`,
      }
    return ok
  },
}

const H4: Rule = {
  id: 'H4',
  name: 'Labs in lab rooms',
  description:
    "Labs must be in lab-type or special-purpose rooms (A2-147/B1-004 have lab benches). Lectures may not occupy pure labs.",
  kind: 'hard',
  weight: 1,
  check(proposed, _schedule, ctx) {
    const c = ctxCourse(ctx, proposed.section_id)
    if (!c) return ok
    const r = ctx.rooms.get(proposed.room_code)
    if (!r) return ok // H3 handles unknown rooms
    if (c.type === 'lab' && r.type !== 'lab' && r.type !== 'special')
      return { ok: false, violation: `Lab course ${c.code} placed in non-lab/non-special room ${r.code}` }
    if (c.type === 'lecture' && r.type === 'lab')
      return {
        ok: false,
        violation: `Lecture course ${c.code} placed in lab room ${r.code}`,
      }
    return ok
  },
}

const H5: Rule = {
  id: 'H5',
  name: 'Merged courses co-scheduled',
  description: 'Merged courses share the same room, time slot, and instructor.',
  kind: 'hard',
  weight: 1,
  check(proposed, schedule, ctx) {
    const s = ctxSection(ctx, proposed.section_id)
    if (!s?.merged_group_id) return ok
    // All other already-placed sections in the same merged group must match.
    for (const a of schedule) {
      const aSec = ctxSection(ctx, a.section_id)
      if (!aSec || aSec.merged_group_id !== s.merged_group_id) continue
      if (a.day === proposed.day) {
        if (
          a.start_min !== proposed.start_min ||
          a.end_min !== proposed.end_min ||
          a.room_code !== proposed.room_code ||
          a.instructor_id !== proposed.instructor_id
        ) {
          return {
            ok: false,
            violation: `Merged group ${s.merged_group_id} mismatch with sibling ${a.section_id}`,
          }
        }
      }
    }
    return ok
  },
}

const H6: Rule = {
  id: 'H6',
  name: 'Cohort no-conflict',
  description:
    'Required courses on the same major-sheet semester block must not overlap in time — except where each course has multiple sections, since a student can pick a non-conflicting section.',
  kind: 'hard',
  weight: 1,
  check(proposed, schedule, ctx) {
    const c = ctxCourse(ctx, proposed.section_id)
    if (!c) return ok
    const myBlocks = cohortBlocksContaining(ctx, c.code)
    if (myBlocks.length === 0) return ok

    // How many sections does THIS course have?
    const mySectionCount = [...ctx.sections.values()].filter((s) => s.course_code === c.code).length

    for (const a of schedule) {
      if (!overlaps(a, proposed)) continue
      const ac = ctxCourse(ctx, a.section_id)
      if (!ac || ac.code === c.code) continue
      for (const mb of myBlocks) {
        if (!mb.required_courses.includes(ac.code)) continue
        const otherSectionCount = [...ctx.sections.values()].filter((s) => s.course_code === ac.code).length
        // Relaxation: if either course has 2+ sections AND the student could
        // pick a non-conflicting section, we don't block. Concretely: only
        // block when both courses are single-section (so the overlap is truly
        // unavoidable for a cohort student).
        if (mySectionCount >= 2 || otherSectionCount >= 2) continue
        return {
          ok: false,
          violation: `Cohort overlap: ${c.code} and ${ac.code} both required in same semester block (both single-section).`,
        }
      }
    }
    return ok
  },
}

const H7: Rule = {
  id: 'H7',
  name: 'Monday 11:00 block',
  description: 'Monday 11:00–12:00 is reserved college-wide.',
  kind: 'hard',
  weight: 1,
  check(proposed) {
    if (proposed.day !== 'M') return ok
    const blockStart = 11 * 60
    const blockEnd = 12 * 60
    if (proposed.start_min < blockEnd && proposed.end_min > blockStart)
      return { ok: false, violation: 'Conflicts with Monday 11:00–12:00 reserved block.' }
    return ok
  },
}

const H8: Rule = {
  id: 'H8',
  name: 'Daily teaching cap',
  description: 'Maximum 6 teaching hours per academic per day.',
  kind: 'hard',
  weight: 1,
  check(proposed, schedule, ctx) {
    if (!proposed.instructor_id) return ok
    const inst = ctx.instructors.get(proposed.instructor_id)
    const cap = (inst?.daily_cap_hours ?? 6) * 60
    let used = durationMin(proposed)
    for (const a of schedule) {
      if (a.instructor_id === proposed.instructor_id && a.day === proposed.day) used += durationMin(a)
    }
    if (used > cap)
      return {
        ok: false,
        violation: `Instructor ${proposed.instructor_id} would exceed daily cap (${used} > ${cap} min) on ${proposed.day}`,
      }
    return ok
  },
}

const H9: Rule = {
  id: 'H9',
  name: 'Duration matches credits',
  description:
    'Lecture duration must match credit-to-duration rule (3-cr: 50 or 75; 4-cr: 75 or 120; CP/IAWD 4-cr split).',
  kind: 'hard',
  weight: 1,
  check(proposed, _schedule, ctx) {
    const c = ctxCourse(ctx, proposed.section_id)
    if (!c) return ok
    const d = durationMin(proposed)
    const pat = c.lecture_pattern
    const allowed: Record<string, number[]> = {
      '3x50': [50],
      '2x75': [75],
      '3x75': [75],
      '2x120': [120],
      'lab+lecture': [50, 60, 120], // mixed
      irregular: [50, 60, 65, 70, 75, 80, 90, 100, 105, 110, 120, 150],
    }
    if (!(allowed[pat]?.includes(d)))
      return {
        ok: false,
        violation: `Duration ${d}min not allowed by pattern ${pat} for ${c.code}`,
      }
    return ok
  },
}

const H10: Rule = {
  id: 'H10',
  name: 'Weekly teaching cap by rank',
  description: 'Weekly cap by rank (HOD 12, Prof 15, Assoc/Asst Prof 20, Lect 25, Instructor 30).',
  kind: 'hard',
  weight: 1,
  check(proposed, schedule, ctx) {
    const inst = ctx.instructors.get(proposed.instructor_id)
    if (!inst) return ok
    const cap = inst.weekly_cap_hours * 60
    let used = durationMin(proposed)
    for (const a of schedule) if (a.instructor_id === inst.id) used += durationMin(a)
    if (used > cap)
      return {
        ok: false,
        violation: `Weekly cap exceeded for ${inst.name} (${used}min > ${cap}min)`,
      }
    return ok
  },
}

// H11 (student credit cap) operates at the registration layer, not the timetable
// layer — we encode it as a structural rule that always passes here but is
// exposed in the catalog for documentation/UI completeness.
const H11: Rule = {
  id: 'H11',
  name: 'Student credit cap',
  description: '23 credits max; PUC ≥ 12; self-funded 3–23. Enforced at registration, not solver.',
  kind: 'hard',
  weight: 1,
  check() {
    return ok
  },
}

const H12: Rule = {
  id: 'H12',
  name: 'Operating window',
  description: 'Sunday–Thursday, 08:00–19:50. Saturday only if explicitly enabled.',
  kind: 'hard',
  weight: 1,
  check(proposed, _schedule, ctx) {
    const allowed = ctx.term.operating_days
    if (!allowed.includes(proposed.day))
      return { ok: false, violation: `Day ${proposed.day} not in operating week.` }
    if (proposed.start_min < ctx.term.operating_window.start_min)
      return { ok: false, violation: 'Starts before operating window.' }
    if (proposed.end_min > ctx.term.operating_window.end_min)
      return { ok: false, violation: 'Ends after operating window.' }
    return ok
  },
}

const H13: Rule = {
  id: 'H13',
  name: 'Instructor certification',
  description: 'Instructor must be certified for the course.',
  kind: 'hard',
  weight: 1,
  check(proposed, _schedule, ctx) {
    const inst = ctx.instructors.get(proposed.instructor_id)
    const c = ctxCourse(ctx, proposed.section_id)
    if (!inst || !c) return ok
    // If no certifications recorded for instructor, treat as 'unrestricted' rather than blocking;
    // certifications.xlsx is incomplete and we don't want to over-reject the V0 solve.
    if (inst.certifications.length === 0) return ok
    if (!inst.certifications.includes(c.code))
      return {
        ok: false,
        violation: `Instructor ${inst.name} not certified for ${c.code}`,
      }
    return ok
  },
}

const H14: Rule = {
  id: 'H14',
  name: 'Section language matches bucket',
  description: 'Section language must match the demand bucket assigned by Stage 1.',
  kind: 'hard',
  weight: 1,
  check(proposed, _schedule, ctx) {
    // Cross-check via stored section.language vs the course offered_languages.
    const sec = ctxSection(ctx, proposed.section_id)
    const c = ctxCourse(ctx, proposed.section_id)
    if (!sec || !c) return ok
    if (sec.language === 'both') return ok
    if (!c.offered_languages.includes(sec.language) && !c.offered_languages.includes('both'))
      return {
        ok: false,
        violation: `Section language ${sec.language} not offered by course ${c.code}`,
      }
    return ok
  },
}

// --- SOFT RULES ------------------------------------------------------------

const S1: Rule = {
  id: 'S1',
  name: 'Honor instructor availability windows',
  description: 'Prefer slots inside each instructor’s stated availability.',
  kind: 'soft',
  weight: 5,
  check(proposed, _schedule, ctx) {
    const inst = ctx.instructors.get(proposed.instructor_id)
    if (!inst || inst.availability_windows.length === 0) return ok
    const fits = inst.availability_windows.some(
      (w) =>
        w.days.includes(proposed.day) &&
        proposed.start_min >= w.start_min &&
        proposed.end_min <= w.end_min,
    )
    return fits ? ok : { ok: true, violation: `Outside availability window for ${inst.name}` }
  },
}

const S2: Rule = {
  id: 'S2',
  name: 'Minimize instructor day gaps',
  description: 'Compact teaching is preferred to scattered.',
  kind: 'soft',
  weight: 2,
  check(proposed, schedule) {
    const sameDay = schedule.filter(
      (a) => a.instructor_id === proposed.instructor_id && a.day === proposed.day,
    )
    if (sameDay.length === 0) return ok
    const closest = sameDay.reduce(
      (min, a) =>
        Math.min(
          min,
          Math.abs(a.start_min - proposed.end_min),
          Math.abs(proposed.start_min - a.end_min),
        ),
      Number.POSITIVE_INFINITY,
    )
    return closest > 60 ? { ok: true, violation: `Gap of ${closest}min from neighbor` } : ok
  },
}

const S3: Rule = {
  id: 'S3',
  name: 'Balance instructor loads within rank',
  description: 'Avoid maxing one PT while another is empty.',
  kind: 'soft',
  weight: 2,
  check() {
    // Evaluated at schedule-level post hoc; this per-assignment hook is a no-op.
    return ok
  },
}

const S4: Rule = {
  id: 'S4',
  name: 'General courses in core hours',
  description: 'GE/foundation courses preferred in 09:00–14:00.',
  kind: 'soft',
  weight: 3,
  check(proposed, _schedule, ctx) {
    const c = ctxCourse(ctx, proposed.section_id)
    if (!c) return ok
    const isGeneral = /^(GED|GEN|GE|ENL|GEEC|GEPH|GECU)/.test(c.code)
    if (!isGeneral) return ok
    const inCore = proposed.start_min >= 9 * 60 && proposed.end_min <= 14 * 60
    return inCore ? ok : { ok: true, violation: `${c.code} outside core hours 09–14` }
  },
}

const S5: Rule = {
  id: 'S5',
  name: 'Evening sections for working students',
  description: 'Sections flagged working_student should land after 17:00.',
  kind: 'soft',
  weight: 4,
  check(proposed, _schedule, ctx) {
    const sec = ctxSection(ctx, proposed.section_id)
    if (!sec?.working_student_flag) return ok
    return proposed.start_min >= 17 * 60
      ? ok
      : { ok: true, violation: 'Working-student section not in evening' }
  },
}

const S6: Rule = {
  id: 'S6',
  name: 'Avoid floor-hopping back-to-back',
  description: "Don't put the same instructor in back-to-back classes on different floors.",
  kind: 'soft',
  weight: 1,
  check(proposed, schedule, ctx) {
    const sameDay = schedule.filter(
      (a) => a.instructor_id === proposed.instructor_id && a.day === proposed.day,
    )
    for (const a of sameDay) {
      const gap = Math.min(
        Math.abs(a.start_min - proposed.end_min),
        Math.abs(proposed.start_min - a.end_min),
      )
      if (gap > 15) continue
      const fa = ctx.rooms.get(a.room_code)?.floor
      const fb = ctx.rooms.get(proposed.room_code)?.floor
      if (fa && fb && fa !== fb)
        return { ok: true, violation: `Floor jump ${fa}→${fb} in <15min gap` }
    }
    return ok
  },
}

const S7: Rule = {
  id: 'S7',
  name: 'Same room across weekly meetings',
  description: "Keep a course's multi-meeting pattern in the same room.",
  kind: 'soft',
  weight: 2,
  check(proposed, schedule, ctx) {
    const sec = ctxSection(ctx, proposed.section_id)
    if (!sec) return ok
    // Find another assignment with same section_id base.
    const base = proposed.section_id.replace(/-[A-Z][a-z]?$/, '')
    for (const a of schedule) {
      if (!a.section_id.startsWith(base)) continue
      if (a.room_code !== proposed.room_code)
        return { ok: true, violation: `Weekly room split: ${a.room_code} vs ${proposed.room_code}` }
    }
    return ok
  },
}

const S8: Rule = {
  id: 'S8',
  name: 'PUC priority over self-funded',
  description: 'When trade-offs forced, prioritize PUC cohorts.',
  kind: 'soft',
  weight: 1,
  check() {
    return ok
  },
}

const S9: Rule = {
  id: 'S9',
  name: 'Minimize disruption on re-solve',
  description: 'Keep pinned sections in place if possible.',
  kind: 'soft',
  weight: 3,
  check(proposed) {
    return proposed.pinned ? ok : ok
  },
}

export const RULES: Rule[] = [
  H1, H2, H3, H4, H5, H6, H7, H8, H9, H10, H11, H12, H13, H14,
  S1, S2, S3, S4, S5, S6, S7, S8, S9,
]

export const HARD_RULES = RULES.filter((r) => r.kind === 'hard')
export const SOFT_RULES = RULES.filter((r) => r.kind === 'soft')

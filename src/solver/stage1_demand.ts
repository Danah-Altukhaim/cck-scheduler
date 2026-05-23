// Stage 1: Demand planner.
// Given a per-course enrollment forecast (which we synthesize from past
// schedules in V0, because no real forecast file exists yet), output a
// Section roster — count, language, time-of-day bucket per section.
//
// Method: greedy bin-packing. For each course:
//   1. Determine forecast headcount per language.
//   2. Pick the largest compatible room as the cap (so we open as few sections as possible).
//   3. Open ⌈headcount / cap⌉ sections, distributed by language; place a fraction in 'evening'
//      bucket equal to the working-student share.
// Then a single hill-climbing pass merges low-utilization sections of the same
// (course, language, bucket) pair if combining them still respects the largest
// room.

import type {
  Course,
  Room,
  Section,
  Language,
  TimeBucket,
  MergedGroup,
  MajorSheet,
  EnrollmentRecord,
  Assignment,
} from '../model/types.js'

export interface DemandInput {
  // course code → expected enrollment per language
  forecast: Map<string, Partial<Record<Language, number>>>
  // Per-course flag: should we open evening sections for working students?
  workingStudentShare: number // 0..1 — default 0.20
  rooms: Room[]
  courses: Course[]
  merged: MergedGroup[]
}

export interface DemandReport {
  sectionsOpened: number
  bucketSplit: Record<TimeBucket, number>
  notes: string[]
}

// Compose a forecast from baseline assignments when no real forecast exists.
// We count unique sections per (course, language) seen last term.
export function synthesizeForecastFromBaseline(
  assignments: Assignment[],
  sections: Map<string, Section>,
  courses: Course[],
  defaultPerSection = 25,
): Map<string, Partial<Record<Language, number>>> {
  const out = new Map<string, Partial<Record<Language, number>>>()
  // Section ids in baseline are <COURSE>-<INST>-<SECTION>-<DAY> — one per meeting day.
  // We collapse to <COURSE>-<INST>-<SECTION> so a Su/T/Th section counts ONCE.
  const seenSectionBases = new Map<string, { course: string; lang: Language }>()
  for (const a of assignments) {
    const sid = a.section_id
    // Strip trailing -<Day> token.
    const base = sid.replace(/-(Sa|Su|M|T|W|Th)$/, '')
    if (seenSectionBases.has(base)) continue
    const m = /^([A-Z]{2,4}\d{4})/.exec(base)
    if (!m) continue
    const code = m[1]!
    // Language is unknown here (Fall says ALL); default to 'both'.
    seenSectionBases.set(base, { course: code, lang: 'both' })
  }
  for (const v of seenSectionBases.values()) {
    let cur = out.get(v.course)
    if (!cur) {
      cur = {}
      out.set(v.course, cur)
    }
    cur[v.lang] = (cur[v.lang] ?? 0) + defaultPerSection
  }
  // Ensure every catalog course gets a row, even if zero — Stage 1 may decide to skip.
  for (const c of courses) {
    if (!out.has(c.code)) out.set(c.code, { both: 0 })
  }
  return out
}

// Build a per-course forecast from registrar-entered enrollment records.
// Each record's student count is demand for every required course of its
// major; counts sum across majors and across records. Also returns the
// working-student share, derived from the records themselves.
export function forecastFromEnrollment(
  enrollment: EnrollmentRecord[],
  majors: MajorSheet[],
): { forecast: Map<string, Partial<Record<Language, number>>>; workingShare: number } {
  const majorCourses = new Map<string, string[]>()
  for (const m of majors) {
    const codes = new Set<string>()
    for (const b of m.semester_blocks) for (const c of b.required_courses) codes.add(c)
    majorCourses.set(m.program_code, [...codes])
  }

  const forecast = new Map<string, Partial<Record<Language, number>>>()
  let working = 0
  let total = 0
  for (const rec of enrollment) {
    total += rec.count
    if (rec.working_student) working += rec.count
    for (const code of majorCourses.get(rec.major) ?? []) {
      let cur = forecast.get(code)
      if (!cur) {
        cur = {}
        forecast.set(code, cur)
      }
      cur[rec.language] = (cur[rec.language] ?? 0) + rec.count
    }
  }
  return { forecast, workingShare: total > 0 ? working / total : 0.2 }
}

export function planDemand(input: DemandInput): {
  sections: Section[]
  report: DemandReport
} {
  const sections: Section[] = []
  const bucketSplit: Record<TimeBucket, number> = { morning: 0, midday: 0, evening: 0 }
  const notes: string[] = []

  // Build a quick max-cap-by-type lookup.
  const lectureCapMax = Math.max(
    ...input.rooms.filter((r) => r.type !== 'lab').map((r) => r.capacity),
  )
  const labCapMax = Math.max(...input.rooms.filter((r) => r.type === 'lab').map((r) => r.capacity))

  // Merged groups: any course in a merged group should only open ONE section pattern
  // shared by all member codes. We track which codes are 'owned' by a merged group.
  const mergedOwner = new Map<string, string>()
  for (const g of input.merged) {
    for (const code of g.course_codes) mergedOwner.set(code, g.id)
  }

  const handledMergedGroups = new Set<string>()

  for (const course of input.courses) {
    if (course.credits === 0) continue // skip catalog rows with missing credits
    const f = input.forecast.get(course.code) || {}
    const fEn = f.en ?? 0
    const fAr = f.ar ?? 0
    const fBoth = f.both ?? 0
    const total = fEn + fAr + fBoth
    if (total === 0) continue

    // Cap per section = largest compatible room capacity
    const capPerSection = course.requires_lab ? Math.min(labCapMax, 30) : Math.min(lectureCapMax, 35)
    const groupId = mergedOwner.get(course.code)
    if (groupId && handledMergedGroups.has(groupId)) continue

    // Decide language split. If forecast carries per-language counts, honor it;
    // otherwise emit 'both' sections sized at default.
    const langCounts: { lang: Language; n: number }[] = []
    if (fEn > 0) langCounts.push({ lang: 'en', n: fEn })
    if (fAr > 0) langCounts.push({ lang: 'ar', n: fAr })
    if (fBoth > 0) langCounts.push({ lang: 'both', n: fBoth })

    for (const { lang, n } of langCounts) {
      const count = Math.max(1, Math.ceil(n / capPerSection))
      const eveningSections = Math.round(count * input.workingStudentShare)
      for (let i = 0; i < count; i++) {
        const bucket: TimeBucket =
          i < eveningSections ? 'evening' : i % 2 === 0 ? 'morning' : 'midday'
        const sid = `${course.code}-${lang}-${bucket}-${i + 1}`
        const sec: Section = {
          id: sid,
          course_code: course.code,
          language: lang,
          time_bucket: bucket,
          enrollment_cap: Math.min(capPerSection, Math.ceil(n / count)),
          working_student_flag: bucket === 'evening',
          pattern: course.lecture_pattern,
        }
        if (groupId) sec.merged_group_id = groupId
        sections.push(sec)
        bucketSplit[bucket]++
      }
    }
    if (groupId) handledMergedGroups.add(groupId)
  }

  // Local-search refinement: collapse any (course, language, bucket) trio that has
  // 2+ sections both under 50% of cap.
  const grouped = new Map<string, Section[]>()
  for (const s of sections) {
    const k = `${s.course_code}|${s.language}|${s.time_bucket}`
    let arr = grouped.get(k)
    if (!arr) {
      arr = []
      grouped.set(k, arr)
    }
    arr.push(s)
  }
  const survivors: Section[] = []
  const mergeCounts = new Map<string, number>()
  for (const [key, arr] of grouped) {
    arr.sort((a, b) => a.enrollment_cap - b.enrollment_cap)
    let merged = 0
    while (arr.length >= 2) {
      const a = arr[0]!
      const b = arr[1]!
      const combined = a.enrollment_cap + b.enrollment_cap
      // Use lecture max as ceiling
      if (combined <= lectureCapMax) {
        arr.shift()
        arr.shift()
        a.enrollment_cap = combined
        arr.unshift(a)
        merged++
      } else break
    }
    if (merged > 0) mergeCounts.set(key, merged)
    survivors.push(...arr)
  }
  if (mergeCounts.size > 0) {
    const total = [...mergeCounts.values()].reduce((s, n) => s + n, 0)
    notes.push(`Collapsed ${total} undersized sections across ${mergeCounts.size} (course, lang, bucket) groups.`)
  }

  return {
    sections: survivors,
    report: {
      sectionsOpened: survivors.length,
      bucketSplit,
      notes,
    },
  }
}

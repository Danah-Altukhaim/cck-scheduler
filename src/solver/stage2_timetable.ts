// Stage 2: Timetabler.
//
// Greedy placer with three improvements over the original V0:
//   (1) Certification augmentation: many instructor↔course pairings are
//       missing from the certification matrix because the source spreadsheet
//       is incomplete. We seed extra certs at solve time from the baseline
//       past-term schedule (instructor X taught course Y last term ⇒ certified).
//   (2) Multi-ordering retry: we try several variable orderings (MRV,
//       largest-degree-first, course-difficulty) and pick the schedule with
//       the most placements / best soft score.
//   (3) Load-balanced instructor selection: candidates are shuffled so that
//       less-loaded instructors are preferred, which spreads pressure away
//       from the small "unrestricted" instructor pool.
//
// Hard rules are still enforced via the rule catalog. Soft rules score the
// final schedule. We keep the implementation single-threaded and
// budget-bounded; this is V0 and we accept SAT-or-explained-UNSAT.

import type {
  Assignment,
  Course,
  Day,
  Instructor,
  LecturePattern,
  Room,
  Rule,
  RuleContext,
  Section,
  TimeBucket,
} from '../model/types.js'
import { HARD_RULES, SOFT_RULES } from '../rules/catalog.js'

export interface SolveInput {
  ctx: RuleContext
  sections: Section[]
  // Past-term assignments we can mine for additional (instructor, course)
  // certification pairs. Optional but strongly recommended — the certification
  // matrix is ~50% complete.
  baselineAssignments?: Assignment[]
  // Maximum time budget in ms across all retry passes. Default 30s.
  timeBudgetMs?: number
  // Maximum domain size to materialize per variable. Default 400.
  maxDomainPerVar?: number
}

export interface DomainCandidate {
  days: Day[] // for multi-meeting patterns; we still place one Assignment per day
  start_min: number
  end_min: number
  room_code: string
  instructor_id: string
}

export interface SolveReport {
  status: 'sat' | 'partial' | 'unsat'
  assignmentsPlaced: number
  sectionsUnplaced: string[]
  hardViolations: { rule: string; section: string; reason: string }[]
  softScore: number
  softBreakdown: Record<string, number>
  constrainingRules: string[]
  // Counts of how many times each hard rule fired during search
  constrainingRuleCounts: Record<string, number>
  elapsedMs: number
  notes: string[]
}

// ---- pattern → meeting layouts -------------------------------------------

function patternMeetingsFor(pat: LecturePattern): { perWeek: number; durationMin: number } {
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
      // Treat as 2 × 120 for V0 — H9 allows 120min for this pattern.
      return { perWeek: 2, durationMin: 120 }
    case 'irregular':
      return { perWeek: 2, durationMin: 75 }
  }
}

function bucketWindow(b: TimeBucket): [number, number] {
  switch (b) {
    case 'morning':
      return [8 * 60, 12 * 60]
    case 'midday':
      return [11 * 60, 16 * 60]
    case 'evening':
      return [16 * 60, 19 * 60 + 50]
  }
}

// Bucket relaxation order: when a section's primary bucket is saturated we
// try the adjacent bucket(s). Each entry is a [start, end] minute window.
function bucketWindowsRelaxed(b: TimeBucket): [number, number][] {
  switch (b) {
    case 'morning':
      return [
        [8 * 60, 12 * 60],
        [8 * 60, 14 * 60], // bleed into midday
        [8 * 60, 16 * 60], // anywhere before evening
      ]
    case 'midday':
      return [
        [11 * 60, 16 * 60],
        [9 * 60, 17 * 60],
        [8 * 60, 18 * 60],
      ]
    case 'evening':
      return [
        [16 * 60, 19 * 60 + 50],
        [14 * 60, 19 * 60 + 50],
      ]
  }
}

// Granularity = 30 min start grid (smaller grid blew up domains without
// meaningful schedule quality gains in V0; 30 min still aligns with all the
// canonical durations).
const GRID = 30

// ---- certification augmentation -------------------------------------------

// Map course-code prefixes to instructor departments. This is intentionally
// coarse — used only as a fallback when neither the certification matrix nor
// the baseline schedule cover a given course.
const PREFIX_TO_DEPT: { prefix: RegExp; depts: string[] }[] = [
  { prefix: /^(ACC|BUAC|BUS|BUAD|BUMG|BUMK|BUMT|BUEN|BUHR|BUCO|MGT|MKT|FIN|RET|QUA|ECO|LAW)/, depts: ['business'] },
  { prefix: /^(CST|CSIT|CP|IAWD|CIS|MTM)/, depts: ['advanced technology', 'computer', 'information technology'] },
  { prefix: /^(ENL|ENG)/, depts: ['english', 'foundation'] },
  { prefix: /^(GED|GEN|GE|GEEC|GEPH|GECU)/, depts: ['foundation', 'general', 'business'] },
  { prefix: /^(MAT|MATH|STA)/, depts: ['mathematics', 'math', 'foundation'] },
]

// Build a course-code -> set<instructor_id> map from the baseline schedule.
// We then merge those into each course's certified_instructors and each
// instructor's certifications, so the H13 check finds them.
//
// Additionally: any course that still has 0 certifications after the baseline
// augmentation falls back to department-prefix matching. This is intentionally
// permissive — it errs on the side of "we have a schedule" vs "H13 blocks a
// whole semester block".
export function augmentCertifications(
  ctx: RuleContext,
  baseline: Assignment[] | undefined,
): { coursesGained: number; pairsAdded: number; deptFallbackCourses: number } {
  let coursesGained = 0
  let pairsAdded = 0
  let deptFallbackCourses = 0

  // 1. Baseline augmentation
  if (baseline && baseline.length > 0) {
    const taught = new Map<string, Set<string>>() // courseCode -> instructorIds
    for (const a of baseline) {
      if (!a.instructor_id) continue
      const m = a.section_id.match(/^([A-Z]{2,4}\d{3,4})/)
      if (!m) continue
      const code = m[1]
      if (!code) continue
      if (!ctx.courses.has(code)) continue
      if (!ctx.instructors.has(a.instructor_id)) continue
      if (!taught.has(code)) taught.set(code, new Set())
      taught.get(code)!.add(a.instructor_id)
    }
    for (const [code, iids] of taught) {
      const c = ctx.courses.get(code)
      if (!c) continue
      const before = c.certified_instructors.length
      for (const iid of iids) {
        if (!c.certified_instructors.includes(iid)) {
          c.certified_instructors.push(iid)
          pairsAdded++
        }
        const inst = ctx.instructors.get(iid)!
        if (!inst.certifications.includes(code)) inst.certifications.push(code)
      }
      if (before === 0 && c.certified_instructors.length > 0) coursesGained++
    }
  }

  // 2. Department-prefix fallback for any course still uncovered.
  for (const c of ctx.courses.values()) {
    if (c.certified_instructors.length > 0) continue
    const match = PREFIX_TO_DEPT.find((p) => p.prefix.test(c.code))
    if (!match) continue
    const deptInstructors = [...ctx.instructors.values()].filter((i) =>
      match.depts.some((d) => i.department?.toLowerCase().includes(d.toLowerCase())),
    )
    if (deptInstructors.length === 0) continue
    deptFallbackCourses++
    for (const inst of deptInstructors) {
      c.certified_instructors.push(inst.id)
      // Only add to instructor's cert list if they already have explicit
      // certs — otherwise they're "unrestricted" and H13 already lets them
      // teach anything, so no change needed.
      if (inst.certifications.length > 0 && !inst.certifications.includes(c.code)) {
        inst.certifications.push(c.code)
      }
      pairsAdded++
    }
  }

  return { coursesGained, pairsAdded, deptFallbackCourses }
}

// ---- domain construction --------------------------------------------------

interface DomainBuildOptions {
  // Shuffle key — different values rotate (room, instructor, day) order so
  // different passes explore the space differently.
  shuffleSeed: number
  maxSize: number
}

// Deterministic mulberry32 PRNG so different seeds give reproducible orderings.
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle<T>(arr: T[], r: () => number): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

interface DomainBuildOptions2 extends DomainBuildOptions {
  // 0 = strict bucket, 1 = expanded, 2 = wide-open (within operating hours)
  relaxLevel?: number
}

function buildDomain(
  section: Section,
  ctx: RuleContext,
  opt: DomainBuildOptions2,
): DomainCandidate[] {
  const out: DomainCandidate[] = []
  const course = ctx.courses.get(section.course_code)
  if (!course) return out
  const relaxLevel = opt.relaxLevel ?? 0
  const windowsList = bucketWindowsRelaxed(section.time_bucket)
  const [winStart, winEnd] = windowsList[Math.min(relaxLevel, windowsList.length - 1)]!
  const m = patternMeetingsFor(section.pattern)
  const dur = m.durationMin

  // Candidate rooms: type-compatible + capacity-fit
  let validRooms: Room[] = []
  for (const r of ctx.rooms.values()) {
    if (course.type === 'lab' && r.type !== 'lab') continue
    if (course.type === 'lecture' && r.type === 'lab') continue
    if (r.capacity < section.enrollment_cap) continue
    validRooms.push(r)
  }
  // Hybrid courses (lecture+lab) and lecture courses can use 'special' rooms.
  if (course.type === 'lecture+lab') {
    validRooms = []
    for (const r of ctx.rooms.values()) {
      if (r.capacity < section.enrollment_cap) continue
      validRooms.push(r)
    }
  }
  // Lab room shortage fallback: if no lab room has the required capacity,
  // allow special rooms (they have lab benches in practice — A2-147 / B1-004).
  if (course.type === 'lab' && validRooms.length === 0) {
    for (const r of ctx.rooms.values()) {
      if (r.type === 'special' && r.capacity >= section.enrollment_cap) validRooms.push(r)
    }
  }

  // Candidate instructors: certified for this course (if certifications exist)
  // and not (no longer falls back to "all"; H13 already treats empty-cert
  // instructors as unrestricted).
  let validInstructors: Instructor[] = []
  for (const i of ctx.instructors.values()) {
    if (i.certifications.length > 0 && !i.certifications.includes(course.code)) continue
    validInstructors.push(i)
  }
  if (validInstructors.length === 0) {
    // Defensive fallback: any instructor (only when no one is certified at all).
    for (const i of ctx.instructors.values()) validInstructors.push(i)
  }

  // Day-patterns by meetings-per-week. We include several common spread patterns
  // so the solver has alternatives when one day collides.
  const dayChoices: Day[][] =
    m.perWeek === 1
      ? [['Su'], ['M'], ['T'], ['W'], ['Th']]
      : m.perWeek === 2
        ? [
            ['M', 'W'],
            ['Su', 'T'],
            ['T', 'Th'],
            ['Su', 'W'],
            ['Su', 'Th'],
            ['M', 'Th'],
          ]
        : m.perWeek === 3
          ? [
              ['Su', 'T', 'Th'],
              ['M', 'W', 'Th'],
              ['Su', 'M', 'W'],
              ['M', 'T', 'Th'],
            ]
          : [['Su', 'M', 'T', 'W', 'Th']]

  const r = rng(opt.shuffleSeed)
  const roomsShuf = shuffle(validRooms, r)
  const instShuf = shuffle(validInstructors, r)
  const daysShuf = shuffle(dayChoices, r)

  outer: for (const days of daysShuf) {
    // Operating-week check
    if (!days.every((d) => ctx.term.operating_days.includes(d))) continue
    for (let start = winStart; start + dur <= winEnd; start += GRID) {
      const end = start + dur
      // Monday 11:00–12:00 block (H7) — skip if any day is Monday and we overlap.
      if (days.includes('M') && start < 12 * 60 && end > 11 * 60) continue
      for (const r2 of roomsShuf) {
        for (const inst of instShuf) {
          out.push({
            days: days.slice(),
            start_min: start,
            end_min: end,
            room_code: r2.code,
            instructor_id: inst.id,
          })
          if (out.length >= opt.maxSize) break outer
        }
      }
    }
  }
  return out
}

// Check a candidate against all hard rules. Returns the first violation or null.
function violatesHard(
  candidate: DomainCandidate,
  schedule: Assignment[],
  section: Section,
  ctx: RuleContext,
  rules: Rule[],
  ruleCounts?: Record<string, number>,
): { rule: string; reason: string } | null {
  for (const day of candidate.days) {
    const a: Assignment = {
      section_id: section.id,
      day,
      start_min: candidate.start_min,
      end_min: candidate.end_min,
      room_code: candidate.room_code,
      instructor_id: candidate.instructor_id,
      pinned: false,
      source: 'solver',
    }
    for (const r of rules) {
      const res = r.check(a, schedule, ctx)
      if (!res.ok) {
        if (ruleCounts) ruleCounts[r.id] = (ruleCounts[r.id] || 0) + 1
        return { rule: r.id, reason: res.violation || r.name }
      }
    }
  }
  return null
}

function softScoreFor(
  candidate: DomainCandidate,
  schedule: Assignment[],
  section: Section,
  ctx: RuleContext,
): { score: number; breakdown: Record<string, number> } {
  let total = 0
  const breakdown: Record<string, number> = {}
  for (const day of candidate.days) {
    const a: Assignment = {
      section_id: section.id,
      day,
      start_min: candidate.start_min,
      end_min: candidate.end_min,
      room_code: candidate.room_code,
      instructor_id: candidate.instructor_id,
      pinned: false,
      source: 'solver',
    }
    for (const r of SOFT_RULES) {
      const res = r.check(a, schedule, ctx)
      if (res.violation) {
        total -= r.weight
        breakdown[r.id] = (breakdown[r.id] || 0) - r.weight
      }
    }
  }
  return { score: total, breakdown }
}

// ---- ordering strategies --------------------------------------------------

type OrderStrategy = 'mrv' | 'degree' | 'difficulty' | 'evening-first'

function orderSections(
  sections: Section[],
  domains: Map<string, DomainCandidate[]>,
  ctx: RuleContext,
  strategy: OrderStrategy,
): Section[] {
  const arr = sections.slice()
  if (strategy === 'mrv') {
    arr.sort((a, b) => (domains.get(a.id)?.length ?? 0) - (domains.get(b.id)?.length ?? 0))
  } else if (strategy === 'degree') {
    // "Largest degree" = section whose course has the fewest certified
    // instructors (highest constrainedness on the instructor axis). Tie-break
    // by domain size.
    arr.sort((a, b) => {
      const ca = ctx.courses.get(a.course_code)
      const cb = ctx.courses.get(b.course_code)
      const da = ca?.certified_instructors.length ?? 999
      const db = cb?.certified_instructors.length ?? 999
      if (da !== db) return da - db
      return (domains.get(a.id)?.length ?? 0) - (domains.get(b.id)?.length ?? 0)
    })
  } else if (strategy === 'difficulty') {
    // Hardest first: bigger sections (room demand) + smaller domain.
    arr.sort((a, b) => {
      const ea = a.enrollment_cap
      const eb = b.enrollment_cap
      if (ea !== eb) return eb - ea
      return (domains.get(a.id)?.length ?? 0) - (domains.get(b.id)?.length ?? 0)
    })
  } else if (strategy === 'evening-first') {
    // Evening / working-student sections first; they have the tightest windows.
    arr.sort((a, b) => {
      const ra = a.time_bucket === 'evening' ? 0 : a.time_bucket === 'midday' ? 1 : 2
      const rb = b.time_bucket === 'evening' ? 0 : b.time_bucket === 'midday' ? 1 : 2
      if (ra !== rb) return ra - rb
      return (domains.get(a.id)?.length ?? 0) - (domains.get(b.id)?.length ?? 0)
    })
  }
  return arr
}

// ---- single placement pass ------------------------------------------------

interface PassResult {
  schedule: Assignment[]
  unplaced: Section[]
  softScore: number
  softBreakdown: Record<string, number>
  hardViolations: { rule: string; section: string; reason: string }[]
  ruleCounts: Record<string, number>
}

function runPass(
  sections: Section[],
  domains: Map<string, DomainCandidate[]>,
  ctx: RuleContext,
  strategy: OrderStrategy,
  budgetUntil: number,
): PassResult {
  const placed: Assignment[] = []
  const unplaced: Section[] = []
  const hardViolations: PassResult['hardViolations'] = []
  const ruleCounts: Record<string, number> = {}
  let softScore = 0
  const softBreakdown: Record<string, number> = {}
  const rules = HARD_RULES

  const ordered = orderSections(sections, domains, ctx, strategy)
  // Track per-instructor weekly minutes used so we can sort candidates by
  // least-loaded instructor when picking.
  const instLoad = new Map<string, number>()
  for (const inst of ctx.instructors.values()) instLoad.set(inst.id, 0)

  for (const section of ordered) {
    if (Date.now() > budgetUntil) {
      unplaced.push(section)
      continue
    }
    const dom = domains.get(section.id) || []
    if (dom.length === 0) {
      unplaced.push(section)
      hardViolations.push({
        rule: 'PRE',
        section: section.id,
        reason: 'No legal (room, instructor, slot, day) tuple exists.',
      })
      continue
    }

    // Sort candidates: prefer least-loaded instructor, tie-break by start_min
    // (earlier in window first) for stable behaviour.
    const sorted = dom.slice().sort((a, b) => {
      const la = instLoad.get(a.instructor_id) ?? 0
      const lb = instLoad.get(b.instructor_id) ?? 0
      if (la !== lb) return la - lb
      return a.start_min - b.start_min
    })

    let chosen: DomainCandidate | null = null
    let chosenSoft: { score: number; breakdown: Record<string, number> } | null = null
    let bestSoft = -Infinity
    let scanned = 0
    // Look at up to 80 feasible candidates and pick the one with best soft score.
    for (const c of sorted) {
      const v = violatesHard(c, placed, section, ctx, rules, ruleCounts)
      if (v) continue
      const s = softScoreFor(c, placed, section, ctx)
      if (s.score > bestSoft) {
        bestSoft = s.score
        chosen = c
        chosenSoft = s
      }
      scanned++
      if (scanned >= 80) break
    }
    if (!chosen || !chosenSoft) {
      unplaced.push(section)
      hardViolations.push({
        rule: 'POST',
        section: section.id,
        reason: `All ${dom.length} candidates rejected vs current partial schedule.`,
      })
      continue
    }
    const dur = chosen.end_min - chosen.start_min
    for (const day of chosen.days) {
      placed.push({
        section_id: section.id,
        day,
        start_min: chosen.start_min,
        end_min: chosen.end_min,
        room_code: chosen.room_code,
        instructor_id: chosen.instructor_id,
        pinned: false,
        source: 'solver',
      })
    }
    instLoad.set(
      chosen.instructor_id,
      (instLoad.get(chosen.instructor_id) ?? 0) + dur * chosen.days.length,
    )
    softScore += chosenSoft.score
    for (const [k, v2] of Object.entries(chosenSoft.breakdown))
      softBreakdown[k] = (softBreakdown[k] || 0) + v2
  }

  return { schedule: placed, unplaced, softScore, softBreakdown, hardViolations, ruleCounts }
}

// ---- repair pass (ejection-chain relocation) ------------------------------
//
// The greedy passes above never reconsider an already-placed section. When a
// stuck section needs a (room, instructor, slot) that an earlier section took,
// greedy just gives up. The repair pass fixes exactly that: for each unplaced
// section it looks for a slot it COULD take if a few already-placed sections
// were moved, evicts those, and re-places them elsewhere. A move is only
// committed if every evicted section is re-placed legally, so the total number
// of placed sections never decreases.

function candidateAssignments(section: Section, c: DomainCandidate): Assignment[] {
  return c.days.map((day) => ({
    section_id: section.id,
    day,
    start_min: c.start_min,
    end_min: c.end_min,
    room_code: c.room_code,
    instructor_id: c.instructor_id,
    pinned: false,
    source: 'solver',
  }))
}

// A varied, fully-relaxed domain for repair use (several seeds, deduped).
function repairDomain(section: Section, ctx: RuleContext, maxDom: number): DomainCandidate[] {
  const seen = new Set<string>()
  const out: DomainCandidate[] = []
  for (const seed of [2, 3, 5]) {
    const dom = buildDomain(section, ctx, { shuffleSeed: seed, maxSize: maxDom, relaxLevel: 2 })
    for (const c of dom) {
      const key = `${c.days.join('')}|${c.start_min}|${c.room_code}|${c.instructor_id}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push(c)
    }
  }
  return out
}

// Sections already in `schedule` that could plausibly block candidate `c` —
// they share its instructor, its room, an overlapping time slot, or its
// merged group. This keeps the eviction search small.
function evictionPool(
  c: DomainCandidate,
  section: Section,
  schedule: Assignment[],
): string[] {
  const ids = new Set<string>()
  for (const a of schedule) {
    if (a.section_id === section.id) continue
    let hit = a.instructor_id === c.instructor_id || a.room_code === c.room_code
    if (!hit && c.days.includes(a.day)) {
      hit = a.start_min < c.end_min && c.start_min < a.end_min
    }
    if (hit) ids.add(a.section_id)
  }
  return [...ids]
}

// Find a set of sections to evict so candidate `c` becomes hard-valid. Returns
// the set (possibly empty if `c` already fits), or null when `c` cannot be
// freed by eviction (intrinsic conflict like room capacity, or it would take
// more than `maxBlockers` removals).
function findBlockerSet(
  c: DomainCandidate,
  section: Section,
  schedule: Assignment[],
  ctx: RuleContext,
  maxBlockers: number,
): Set<string> | null {
  let working = schedule
  const blockers = new Set<string>()
  for (;;) {
    const v = violatesHard(c, working, section, ctx, HARD_RULES)
    if (!v) return blockers
    if (blockers.size >= maxBlockers) return null
    const pool = evictionPool(c, section, working).filter((id) => !blockers.has(id))
    let cleared: string | null = null
    let progressed: string | null = null
    for (const id of pool) {
      const trial = working.filter((a) => a.section_id !== id)
      const v2 = violatesHard(c, trial, section, ctx, HARD_RULES)
      if (!v2) {
        cleared = id
        break
      }
      if (!progressed && v2.rule !== v.rule) progressed = id
    }
    const pick = cleared ?? progressed
    if (!pick) return null
    blockers.add(pick)
    working = working.filter((a) => a.section_id !== pick)
  }
}

// Recursive ejection-chain placement. Tries to place `section` into
// `schedule`; if it can't fit directly, it evicts the sections blocking a
// promising slot and recursively re-places each of them — which may in turn
// evict others, down to `depthBudget` levels. `inChain` holds the sections
// already being placed higher up the stack so the chain can't cycle.
// Returns a new schedule on success, else null.
function placeWithChain(
  section: Section,
  schedule: Assignment[],
  ctx: RuleContext,
  maxDom: number,
  depthBudget: number,
  inChain: Set<string>,
  domCache: Map<string, DomainCandidate[]>,
  deadline: number,
): Assignment[] | null {
  if (Date.now() > deadline) return null

  let dom = domCache.get(section.id)
  if (!dom) {
    dom = repairDomain(section, ctx, maxDom)
    domCache.set(section.id, dom)
  }

  // Phase A — direct fit. Cheap (one rule check per candidate), so scan the
  // whole domain: a re-placed section often has a free slot somewhere and
  // missing it forces needless deeper eviction.
  for (const c of dom) {
    if (!violatesHard(c, schedule, section, ctx, HARD_RULES)) {
      return schedule.concat(candidateAssignments(section, c))
    }
  }
  if (depthBudget <= 0 || Date.now() > deadline) return null

  // Phase B — eviction. Gather candidates that could be freed by evicting a
  // small set, then recurse cheapest-first so the chain stays thin, not bushy.
  // The top of the chain scans wide (it has the most leverage); deeper levels
  // stay cheap to keep the search bounded.
  const topLevel = inChain.size === 0
  const blockerScanLimit = topLevel ? 150 : 30
  const options: { c: DomainCandidate; blockers: Set<string> }[] = []
  let scanned = 0
  for (const c of dom) {
    if (scanned++ > blockerScanLimit) break
    const blockers = findBlockerSet(c, section, schedule, ctx, 3)
    if (!blockers || blockers.size === 0) continue
    let cyclic = false
    for (const b of blockers) {
      if (inChain.has(b)) {
        cyclic = true
        break
      }
    }
    if (cyclic) continue
    options.push({ c, blockers })
  }
  options.sort((a, b) => a.blockers.size - b.blockers.size)

  const recurseWidth = topLevel ? 8 : 3
  let tried = 0
  for (const opt of options) {
    if (tried++ >= recurseWidth) break
    if (Date.now() > deadline) return null

    // Trial: drop the blockers, add this section, then re-place each blocker.
    let trial = schedule.filter((a) => !opt.blockers.has(a.section_id))
    trial = trial.concat(candidateAssignments(section, opt.c))
    const nextChain = new Set(inChain)
    nextChain.add(section.id)

    let ok = true
    for (const bid of opt.blockers) {
      const bsec = ctx.sections.get(bid)
      if (!bsec) {
        ok = false
        break
      }
      const res = placeWithChain(bsec, trial, ctx, maxDom, depthBudget - 1, nextChain, domCache, deadline)
      if (!res) {
        ok = false
        break
      }
      trial = res
    }
    if (ok) return trial
  }
  return null
}

// Run repair rounds until no more unplaced sections can be relocated in, the
// time budget runs out, or a round makes no progress. Mutates `best`.
function repairUnplaced(
  best: PassResult,
  ctx: RuleContext,
  maxDom: number,
  deadline: number,
): number {
  const domCache = new Map<string, DomainCandidate[]>()
  let totalPlaced = 0
  for (let round = 0; round < 3; round++) {
    if (best.unplaced.length === 0 || Date.now() > deadline) break
    const stillUnplaced: Section[] = []
    let roundPlaced = 0
    for (let i = 0; i < best.unplaced.length; i++) {
      const sec = best.unplaced[i]!
      if (Date.now() > deadline) {
        stillUnplaced.push(sec)
        continue
      }
      // Give each section a fair slice of the remaining budget so one very
      // hard section can't starve the rest.
      const remaining = best.unplaced.length - i
      const perSec = Math.min(deadline, Date.now() + Math.max(800, (deadline - Date.now()) / remaining))
      const res = placeWithChain(sec, best.schedule, ctx, maxDom, 2, new Set<string>(), domCache, perSec)
      if (res) {
        best.schedule = res
        roundPlaced++
      } else {
        stillUnplaced.push(sec)
      }
    }
    best.unplaced = stillUnplaced
    totalPlaced += roundPlaced
    if (roundPlaced === 0) break
  }
  return totalPlaced
}

// Soft score over the final schedule. The per-pass incremental sum goes stale
// once the repair pass moves assignments around, so we recompute from scratch:
// each assignment is scored against every other.
function finalSoftScore(
  schedule: Assignment[],
  ctx: RuleContext,
): { score: number; breakdown: Record<string, number> } {
  let score = 0
  const breakdown: Record<string, number> = {}
  for (const a of schedule) {
    const rest = schedule.filter((x) => x !== a)
    for (const r of SOFT_RULES) {
      const res = r.check(a, rest, ctx)
      if (res.violation) {
        score -= r.weight
        breakdown[r.id] = (breakdown[r.id] || 0) - r.weight
      }
    }
  }
  return { score, breakdown }
}

// ---- main entry -----------------------------------------------------------

export function solveTimetable(input: SolveInput): {
  schedule: Assignment[]
  report: SolveReport
} {
  const start = Date.now()
  const budget = input.timeBudgetMs ?? 30_000
  const maxDom = input.maxDomainPerVar ?? 400
  const notes: string[] = []
  const ctx = input.ctx

  // 0. Augment certifications from baseline + department-prefix fallback.
  const aug = augmentCertifications(ctx, input.baselineAssignments)
  if (aug.pairsAdded > 0) {
    notes.push(
      `Certification augmentation: +${aug.pairsAdded} pairs (${aug.coursesGained} courses via baseline, ${aug.deptFallbackCourses} via department-prefix fallback).`,
    )
  }

  // 1. Build domains (one shuffle seed; we'll reuse across orderings since the
  //    domain content is the same, only the variable order changes). For
  //    "morning-1" sections in cohort-heavy semesters, the strict morning
  //    window can't fit them all — pre-emptively allow relax level 1 for
  //    those.
  const domains = new Map<string, DomainCandidate[]>()
  for (const s of input.sections) {
    let dom = buildDomain(s, ctx, { shuffleSeed: 1, maxSize: maxDom, relaxLevel: 0 })
    if (dom.length < 50) {
      // If strict domain is small, broaden to relax level 1 from the start.
      dom = buildDomain(s, ctx, { shuffleSeed: 1, maxSize: maxDom, relaxLevel: 1 })
    }
    domains.set(s.id, dom)
    if (dom.length === 0) {
      notes.push(`No initial domain for section ${s.id} — likely too tight (room/instructor/cert).`)
    }
  }

  // 2. Try multiple orderings; keep best.
  const strategies: OrderStrategy[] = ['degree', 'mrv', 'evening-first', 'difficulty']
  let best: PassResult | null = null
  let bestStrategy: OrderStrategy = 'degree'
  const perStrategyBudget = Math.floor((budget - (Date.now() - start)) / strategies.length)
  for (const strat of strategies) {
    if (Date.now() - start > budget) break
    const passDeadline = Date.now() + Math.max(perStrategyBudget, 2_000)
    const res = runPass(input.sections, domains, ctx, strat, passDeadline)
    notes.push(
      `Pass ${strat}: placed ${res.schedule.length} assignments (${input.sections.length - res.unplaced.length}/${input.sections.length} sections), soft=${res.softScore}`,
    )
    if (
      !best ||
      res.schedule.length > best.schedule.length ||
      (res.schedule.length === best.schedule.length && res.softScore > best.softScore)
    ) {
      best = res
      bestStrategy = strat
    }
  }
  notes.push(`Best ordering: ${bestStrategy}`)

  if (!best) {
    return {
      schedule: [],
      report: {
        status: 'unsat',
        assignmentsPlaced: 0,
        sectionsUnplaced: input.sections.map((s) => s.id),
        hardViolations: [],
        softScore: 0,
        softBreakdown: {},
        constrainingRules: [],
        constrainingRuleCounts: {},
        elapsedMs: Date.now() - start,
        notes,
      },
    }
  }

  // 3. Second-chance pass: for sections still unplaced, rebuild their domains
  // with relaxed bucket windows and try to fit them into the gaps left by best.
  if (best.unplaced.length > 0 && Date.now() - start < budget) {
    const stillUnplaced: Section[] = []
    const ruleCountsExtra = { ...best.ruleCounts }
    for (const sec of best.unplaced) {
      if (Date.now() - start > budget) {
        stillUnplaced.push(sec)
        continue
      }
      // Try relax levels 0, 1, 2 with different shuffle seeds.
      let placed: DomainCandidate | null = null
      let placedSoft: { score: number; breakdown: Record<string, number> } | null = null
      const attempts: { level: number; seed: number }[] = [
        { level: 0, seed: 3 },
        { level: 1, seed: 7 },
        { level: 2, seed: 11 },
        { level: 2, seed: 17 },
      ]
      for (const att of attempts) {
        if (placed) break
        const dom2 = buildDomain(sec, ctx, { shuffleSeed: att.seed, maxSize: maxDom, relaxLevel: att.level })
        if (dom2.length === 0) continue
        // Sort by least-loaded instructor in current schedule.
        const load = new Map<string, number>()
        for (const a of best.schedule)
          load.set(a.instructor_id, (load.get(a.instructor_id) ?? 0) + (a.end_min - a.start_min))
        const sorted = dom2.sort((a, b) => {
          const la = load.get(a.instructor_id) ?? 0
          const lb = load.get(b.instructor_id) ?? 0
          if (la !== lb) return la - lb
          return a.start_min - b.start_min
        })
        let bestSoftScore = -Infinity
        let scanned = 0
        for (const c of sorted) {
          const v = violatesHard(c, best.schedule, sec, ctx, HARD_RULES, ruleCountsExtra)
          if (v) continue
          const s = softScoreFor(c, best.schedule, sec, ctx)
          if (s.score > bestSoftScore) {
            bestSoftScore = s.score
            placed = c
            placedSoft = s
          }
          scanned++
          if (scanned >= 60) break
        }
      }
      if (placed && placedSoft) {
        for (const day of placed.days) {
          best.schedule.push({
            section_id: sec.id,
            day,
            start_min: placed.start_min,
            end_min: placed.end_min,
            room_code: placed.room_code,
            instructor_id: placed.instructor_id,
            pinned: false,
            source: 'solver',
          })
        }
        best.softScore += placedSoft.score
        for (const [k, v2] of Object.entries(placedSoft.breakdown))
          best.softBreakdown[k] = (best.softBreakdown[k] || 0) + v2
      } else {
        stillUnplaced.push(sec)
      }
    }
    notes.push(
      `Second-chance pass placed ${best.unplaced.length - stillUnplaced.length} additional sections via bucket relaxation.`,
    )
    best.unplaced = stillUnplaced
    best.ruleCounts = ruleCountsExtra
  }

  // 4. Third-chance pass: force-place — accept first feasible candidate
  //    (no soft preference scan) using fully relaxed windows, single seed.
  if (best.unplaced.length > 0 && Date.now() - start < budget) {
    const stillUnplaced: Section[] = []
    for (const sec of best.unplaced) {
      if (Date.now() - start > budget) {
        stillUnplaced.push(sec)
        continue
      }
      let placed: DomainCandidate | null = null
      // Try multiple seeds with full relax — we just want SOMETHING that fits.
      for (const seed of [13, 23, 31, 41, 53]) {
        const dom2 = buildDomain(sec, ctx, { shuffleSeed: seed, maxSize: maxDom, relaxLevel: 2 })
        for (const c of dom2) {
          const v = violatesHard(c, best.schedule, sec, ctx, HARD_RULES)
          if (v) continue
          placed = c
          break
        }
        if (placed) break
      }
      if (placed) {
        for (const day of placed.days) {
          best.schedule.push({
            section_id: sec.id,
            day,
            start_min: placed.start_min,
            end_min: placed.end_min,
            room_code: placed.room_code,
            instructor_id: placed.instructor_id,
            pinned: false,
            source: 'solver',
          })
        }
      } else {
        stillUnplaced.push(sec)
      }
    }
    notes.push(
      `Third-chance (force-place) pass placed ${best.unplaced.length - stillUnplaced.length} additional sections by ignoring soft preferences.`,
    )
    best.unplaced = stillUnplaced
  }

  // 5. Repair pass: ejection-chain relocation. Uses whatever budget remains —
  //    this is where stuck sections get placed by rearranging the schedule
  //    instead of giving up on them.
  if (best.unplaced.length > 0) {
    const before = best.unplaced.length
    const placed = repairUnplaced(best, ctx, maxDom, start + budget)
    if (placed > 0) {
      notes.push(
        `Repair pass: placed ${placed} more section(s) by relocating already-placed sections (${before} stuck → ${best.unplaced.length} remain).`,
      )
    } else {
      notes.push('Repair pass: no further sections could be relocated into the schedule.')
    }
  }

  // Recompute the soft score over the final schedule — the incremental sum is
  // stale after the repair pass moved assignments around.
  {
    const fs = finalSoftScore(best.schedule, ctx)
    best.softScore = fs.score
    best.softBreakdown = fs.breakdown
  }

  const elapsed = Date.now() - start
  let status: SolveReport['status'] = 'sat'
  if (best.unplaced.length === input.sections.length) status = 'unsat'
  else if (best.unplaced.length > 0) status = 'partial'

  return {
    schedule: best.schedule,
    report: {
      status,
      assignmentsPlaced: best.schedule.length,
      sectionsUnplaced: best.unplaced.map((s) => s.id),
      hardViolations: best.hardViolations,
      softScore: best.softScore,
      softBreakdown: best.softBreakdown,
      constrainingRules: Object.keys(best.ruleCounts),
      constrainingRuleCounts: best.ruleCounts,
      elapsedMs: elapsed,
      notes,
    },
  }
}

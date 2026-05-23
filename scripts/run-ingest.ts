// Orchestrate ingestion: read every source, merge, write term-plan.json + ingest-report.md.

import { writeFileSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type {
  IngestReport,
  Section,
  Assignment,
  TermPlan,
  Term,
  IngestWarning,
} from '../src/model/types.js'
import { loadRooms } from '../src/ingest/rooms.js'
import { loadInstructors } from '../src/ingest/instructors.js'
import { loadCourses, loadCourseDescriptions } from '../src/ingest/courses.js'
import { loadCertifications } from '../src/ingest/certifications.js'
import { loadMajors } from '../src/ingest/majors.js'
import { loadMerged } from '../src/ingest/merged.js'
import { loadPastSchedule } from '../src/ingest/past_schedules.js'
import { loadEquivalencies } from '../src/ingest/equivalencies.js'
import { loadRulesDoc } from '../src/ingest/rules_doc.js'

// Resolve paths relative to the project root so this works whether we run from
// the user's machine (/Users/mac/CCK Scheduler/...) or the agent sandbox
// (/sessions/.../mnt/CCK Scheduler/...).
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..') // scheduler/
const REPO = resolve(ROOT, '..') // CCK Scheduler/
const DOCS = process.env.CCK_DOCS_DIR || join(REPO, 'CCK Scheduler Docs')
// Ingestion populates the reusable base template — new schedules copy from it.
const OUT_DATA = join(ROOT, 'data', 'base-template')
const OUT_REPORTS = OUT_DATA

mkdirSync(OUT_DATA, { recursive: true })

console.log('CCK Scheduler — ingestion run')
console.log('Source folder:', DOCS)
console.log()

// 1. Rooms
const { rooms, report: roomsReport } = loadRooms()
console.log(`[rooms]      ${rooms.length} canonical rooms loaded`)

// 2. Past schedules — pass 1, before instructors so we can gather schedule-only names.
const fallPass1 = loadPastSchedule({
  path: join(DOCS, 'Fall Schedule 25-26 - SIS version.xlsx'),
  label: 'Fall 25-26',
  rooms,
})
const springPass1 = loadPastSchedule({
  path: join(DOCS, 'Spring Schedule 25-26 - SIS version.xlsx'),
  label: 'Spring 25-26',
  rooms,
})
const scheduleNames = new Set<string>([
  ...fallPass1.instructorNamesRaw,
  ...springPass1.instructorNamesRaw,
])
console.log(`[past sched] ${fallPass1.assignments.length + springPass1.assignments.length} raw assignments`)
console.log(`[past sched] ${scheduleNames.size} distinct staff names seen`)

// 3. Instructors (merging rosters + schedule names for ghost detection)
const { instructors, report: instReport, nameIndex } = loadInstructors({
  instructorListPath: join(DOCS, 'Instructor Lists.xlsx'),
  academicStaffPath: join(DOCS, 'Acadamic Staff Data.xlsx'),
  scheduleNames,
})
console.log(`[instructors] ${instructors.length} total (${instructors.filter(i => i.status === 'missing-from-roster').length} missing-from-roster)`)

// 4. Courses
const { courses, report: courseReport } = loadCourses({
  coursesDetailsPath: join(DOCS, 'Courses Details.xlsx'),
  descriptionsPath: join(DOCS, 'Course Descriptions.docx'),
})
console.log(`[courses]    ${courses.length} unique courses`)

const { map: descMap, report: descReport } = await loadCourseDescriptions(
  join(DOCS, 'Course Descriptions.docx'),
)
console.log(`[descriptions] ${descMap.size} course descriptions indexed`)

// 5. Certifications
const { report: certReport } = loadCertifications({
  path: join(DOCS, 'List With Offered Courses By Staff.xlsx'),
  instructors,
  courses,
  instructorNameIndex: nameIndex,
})
const certCount = instructors.reduce((n, i) => n + i.certifications.length, 0)
console.log(`[certs]      ${certCount} instructor→course certifications resolved`)

// 6. Major sheets
const { majors, report: majorReport } = loadMajors(join(DOCS, 'Major Sheets.xlsx'))
console.log(`[majors]     ${majors.length} programs with ${majors.reduce((n, m) => n + m.semester_blocks.length, 0)} semester blocks`)

// 7. Merged groups
const { merged, report: mergedReport } = loadMerged(join(DOCS, 'Merged Courses.xlsx'))
console.log(`[merged]     ${merged.length} merged groups`)

// 8. Past schedules — pass 2, now we can resolve instructor ids.
const fallPass2 = loadPastSchedule({
  path: join(DOCS, 'Fall Schedule 25-26 - SIS version.xlsx'),
  label: 'Fall 25-26',
  rooms,
  instructorNameIndex: nameIndex,
})
const springPass2 = loadPastSchedule({
  path: join(DOCS, 'Spring Schedule 25-26 - SIS version.xlsx'),
  label: 'Spring 25-26',
  rooms,
  instructorNameIndex: nameIndex,
})
const baseline_assignments: Assignment[] = [
  ...fallPass2.assignments,
  ...springPass2.assignments,
]
console.log(`[baseline]   ${baseline_assignments.length} normalized assignments`)

// 9. Equivalencies (read shape only)
const { cckRows, paaetRows, report: equivReport } = loadEquivalencies(
  join(DOCS, 'Equivalency - Courses List.xlsx'),
)
console.log(`[equiv]      CCK=${cckRows} PAAET=${paaetRows} rows (reference only)`)

// 10. Rules doc snippets
const { snippets, report: ruleDocReport } = await loadRulesDoc(
  join(DOCS, 'Schedule Process and Rules.docx'),
)
console.log(`[rules doc]  ${Object.keys(snippets).length} prose snippets`)

// 11. Define the term (for V0 we target Fall 2026, the next term to plan)
const term: Term = {
  year: 2026,
  season: 'Fall',
  operating_days: ['Su', 'M', 'T', 'W', 'Th'],
  operating_window: { start_min: 8 * 60, end_min: 19 * 60 + 50 },
}

const sections: Section[] = [] // Stage 1 fills this — empty until run-solve runs.

const reports = [
  roomsReport,
  fallPass2.report,
  springPass2.report,
  instReport,
  courseReport,
  descReport,
  certReport,
  majorReport,
  mergedReport,
  equivReport,
  ruleDocReport,
]

const termPlan: TermPlan = {
  generated_at: new Date().toISOString(),
  term,
  rooms,
  instructors,
  courses,
  majors,
  merged_groups: merged,
  sections,
  baseline_assignments,
  rule_doc_snippets: snippets,
  equivalencies_summary: {
    cck_rows: cckRows,
    paaet_rows: paaetRows,
    note: 'Transfer-credit data; not used by V0 scheduler.',
  },
  reports,
}

// Write term plan
const dataPath = join(OUT_DATA, 'term-plan.json')
writeFileSync(dataPath, JSON.stringify(termPlan, mapReplacer, 2))
console.log()
console.log(`Wrote ${dataPath} (${(JSON.stringify(termPlan).length / 1024).toFixed(1)} KB)`)

// Build ingestion report
const lines: string[] = []
lines.push('# CCK Scheduler — Ingestion Report')
lines.push('')
lines.push(`Generated: ${termPlan.generated_at}`)
lines.push('')
lines.push('## Summary')
lines.push('')
lines.push(`| Source | Rows in | Rows out | Warnings |`)
lines.push(`| --- | ---: | ---: | ---: |`)
for (const r of reports) {
  lines.push(`| ${r.source} | ${r.rows_in} | ${r.rows_out} | ${r.warnings.length} |`)
}
lines.push('')
lines.push(`Rooms: **${rooms.length}** · Instructors: **${instructors.length}** (`)
lines.push(
  `${instructors.filter((i) => i.status === 'missing-from-roster').length} schedule-only`,
)
lines.push(`) · Courses: **${courses.length}** · Majors: **${majors.length}** ·`)
lines.push(`Merged groups: **${merged.length}** · Baseline assignments: **${baseline_assignments.length}**`)
lines.push('')

// Per-source detail
for (const r of reports) {
  lines.push(`## ${r.source}`)
  lines.push('')
  if (r.notes.length) {
    lines.push('Notes:')
    for (const n of r.notes) lines.push(`- ${n}`)
    lines.push('')
  }
  if (r.warnings.length) {
    lines.push(`Warnings (${r.warnings.length}):`)
    // Group by code
    const byCode = new Map<string, IngestWarning[]>()
    for (const w of r.warnings) {
      let arr = byCode.get(w.code)
      if (!arr) {
        arr = []
        byCode.set(w.code, arr)
      }
      arr.push(w)
    }
    for (const [code, ws] of byCode) {
      lines.push(`- **${code}** (${ws.length}):`)
      for (const w of ws.slice(0, 5)) {
        lines.push(`  - [${w.severity}] ${w.message}`)
      }
      if (ws.length > 5) lines.push(`  - ... and ${ws.length - 5} more`)
    }
    lines.push('')
  } else {
    lines.push('No warnings.')
    lines.push('')
  }
}

// Ghost instructors
const ghosts = instructors.filter((i) => i.status === 'missing-from-roster')
if (ghosts.length) {
  lines.push('## Schedule-only instructors (missing from both rosters)')
  lines.push('')
  for (const g of ghosts) lines.push(`- ${g.name}`)
  lines.push('')
}

writeFileSync(join(OUT_REPORTS, 'ingest-report.md'), lines.join('\n'))
console.log(`Wrote ${join(OUT_REPORTS, 'ingest-report.md')}`)

// ---- helpers --------------------------------------------------------------

function mapReplacer(_key: string, value: unknown) {
  if (value instanceof Map) return Object.fromEntries(value)
  if (value instanceof Set) return [...value]
  return value
}

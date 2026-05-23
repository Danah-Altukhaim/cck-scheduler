// Course catalog from Courses Details.xlsx.
// The same course can appear under multiple majors; we deduplicate by code.
// Course Descriptions.docx is read separately as reference material (NOT scheduler-critical).

import xlsx from 'xlsx'
import mammoth from 'mammoth'
import type {
  Course,
  IngestReport,
  Language,
  SectionType,
  LecturePattern,
} from '../model/types.js'
import { cellStr, cellNum, warn } from '../lib/util.js'

function parseLanguage(raw: string | null): Language[] {
  if (!raw) return ['both']
  const s = raw.toLowerCase().replace(/\s+/g, ' ').trim()
  if (s === '-' || s === 'all') return ['en', 'ar']
  if (s.includes('english') && s.includes('arabic')) return ['en', 'ar']
  if (s.includes('bilang')) return ['en', 'ar']
  if (s === 'english') return ['en']
  if (s === 'arabic') return ['ar']
  return ['en']
}

function parseType(raw: string | null): SectionType {
  if (!raw) return 'lecture'
  const s = raw.toLowerCase()
  if (s.includes('lecture') && s.includes('lab')) return 'lecture+lab'
  if (s === 'lab') return 'lab'
  return 'lecture'
}

// Derive the legal lecture pattern(s) from credit count + type. We pick a single
// canonical pattern here; the solver may override per-section.
function derivePattern(credits: number | null, type: SectionType, code: string): LecturePattern {
  if (type === 'lab') return '2x75' // labs typically run as 1×120; not really a 'pattern'. Filler.
  if (credits == null) return 'irregular'
  // CP / IAWD 4-credit split rule (H9 third clause).
  if (credits === 4 && (code.startsWith('CST') || code.startsWith('CP'))) return 'lab+lecture'
  if (credits === 3) return '2x75' // either 3x50 or 2x75; prefer 2x75 as default
  if (credits === 4) return '2x120'
  if (credits === 5) return 'irregular' // 5cr courses don't match the doc rule
  if (credits === 2 || credits === 1 || credits === 6) return 'irregular'
  return 'irregular'
}

export function loadCourses(args: {
  coursesDetailsPath: string
  descriptionsPath: string
}): { courses: Course[]; report: IngestReport; descriptions: Map<string, string> } {
  const report: IngestReport = {
    source: 'Courses Details.xlsx (+ Course Descriptions.docx as reference)',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: [
      'Course rows deduplicated by course code; programs concatenated.',
      'Lecture pattern derived from credits + course-code prefix; CST/CP 4-cr courses default to lab+lecture.',
      "Languages: 'Bilangual' (sic) and 'English & Arabic' both map to ['en','ar'].",
    ],
  }

  const wb = xlsx.readFile(args.coursesDetailsPath)
  const sheet = wb.Sheets[wb.SheetNames[0]!]
  if (!sheet) {
    report.warnings.push(warn('error', 'COURSE_SHEET_MISSING', 'Sheet1 not found'))
    return { courses: [], report, descriptions: new Map() }
  }
  const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })

  const byCode = new Map<string, Course>()

  for (let i = 1; i < data.length; i++) {
    const row = data[i] as unknown[]
    const code = cellStr(row[0])
    if (!code) continue
    report.rows_in++
    const name_en = cellStr(row[1]) || code
    const name_ar = cellStr(row[2]) || undefined
    const credits = cellNum(row[3])
    const typeRaw = cellStr(row[4])
    const langRaw = cellStr(row[5])
    const major = cellStr(row[6]) || 'Unknown'

    const codeUpper = code.trim().toUpperCase()
    const type = parseType(typeRaw)
    const langs = parseLanguage(langRaw)
    const pattern = derivePattern(credits, type, codeUpper)

    if (credits === null) {
      report.warnings.push(
        warn('warn', 'COURSE_CREDITS_MISSING', `Credits missing for ${codeUpper}`, undefined, i + 1),
      )
    }

    const existing = byCode.get(codeUpper)
    if (existing) {
      if (!existing.programs.includes(major)) existing.programs.push(major)
      // Merge offered_languages
      for (const l of langs)
        if (!existing.offered_languages.includes(l)) existing.offered_languages.push(l)
      continue
    }

    const course: Course = {
      code: codeUpper,
      name_en,
      credits: credits ?? 0,
      type,
      lecture_pattern: pattern,
      requires_lab: type !== 'lecture',
      certified_instructors: [],
      offered_languages: langs,
      programs: [major],
    }
    if (name_ar) course.name_ar = name_ar
    byCode.set(codeUpper, course)
  }

  // Pull descriptions for reference (used by AI explainer, not solver).
  const descriptions = new Map<string, string>()
  // mammoth is async; we'll let the caller load it via loadCourseDescriptions.
  // Here we return an empty map; the runner triggers description loading separately.

  report.rows_out = byCode.size
  return { courses: [...byCode.values()], report, descriptions }
}

// Read Course Descriptions.docx as raw text; index by course code where we can.
// Course code lines look like 'ACC2201 Financial Accounting I (5 credits)' interspersed
// in paragraphs. We index everything between two code matches.
export async function loadCourseDescriptions(
  path: string,
): Promise<{ map: Map<string, string>; report: IngestReport }> {
  const report: IngestReport = {
    source: 'Course Descriptions.docx',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: ['Reference text only; not used by the solver. Indexed by course code.'],
  }
  const map = new Map<string, string>()
  try {
    const { value: text } = await mammoth.extractRawText({ path })
    // Course code pattern: 3-4 uppercase letters + 4 digits, sometimes with trailing letter.
    const codeRe = /\b([A-Z]{2,4}\s?\d{4}[A-Z]?)\b/g
    const matches: { idx: number; code: string }[] = []
    let m: RegExpExecArray | null
    while ((m = codeRe.exec(text))) matches.push({ idx: m.index, code: m[1]!.replace(/\s/g, '') })
    report.rows_in = matches.length
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i]!
      const nextIdx = i + 1 < matches.length ? matches[i + 1]!.idx : text.length
      const slice = text.slice(cur.idx, nextIdx).trim()
      if (!map.has(cur.code) && slice.length > 20) {
        map.set(cur.code, slice.slice(0, 1500)) // cap per-entry size
      }
    }
    report.rows_out = map.size
  } catch (e) {
    report.warnings.push(
      warn('error', 'DESCRIPTIONS_READ_FAIL', `Failed to read descriptions: ${String(e)}`),
    )
  }
  return { map, report }
}

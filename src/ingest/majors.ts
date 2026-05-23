// Parse Major Sheets.xlsx — 8 sheets, each a visually-formatted plan-of-study grid.
// Common pattern: two semesters laid out side-by-side as columns.
//   - col 0..3: SEMESTER N (course, title, credits, prereq)
//   - col 4: spacer
//   - col 5..8: SEMESTER N+1
// We walk the rows top-to-bottom, tracking which semester header we last saw on each side.

import xlsx from 'xlsx'
import type { IngestReport, MajorSheet, SemesterBlock } from '../model/types.js'
import { cellStr, warn } from '../lib/util.js'

const SHEET_TO_LEVEL: Record<string, { name: string; level: MajorSheet['level'] }> = {
  'DIPLOMA-MAN. & ENTR.': {
    name: 'Diploma of Business - Management and Entrepreneurship',
    level: 'Diploma',
  },
  'DIPLOMA-MARKETING': { name: 'Diploma of Business - Marketing', level: 'Diploma' },
  'DIPLOMA-ACCOUNTING': { name: 'Diploma of Business - Accounting', level: 'Diploma' },
  'DIPLOMA-COMPUTER PROGRAMMING': { name: 'Diploma of Computer Programming', level: 'Diploma' },
  'DIPLOMA-IAWD': {
    name: 'Diploma of Internet Application and Web Development',
    level: 'Diploma',
  },
  'BACHELOR-BUSINESS MAN. & ENTR.': {
    name: 'Bachelor of Business Administration - Management and Entrepreneurship',
    level: 'Bachelor',
  },
  'BACHELOR-ACCOUNTING': {
    name: 'Bachelor of Business Administration - Accounting',
    level: 'Bachelor',
  },
  'BACHELOR-BME (MARKETING STREAM)': {
    name: 'Bachelor of Business Administration - Management & Entrepreneurship (Marketing)',
    level: 'Bachelor',
  },
}

// Programs we KNOW the source promises but the sheet file is missing.
const KNOWN_MISSING = [
  'Diploma of Interactive Media Design (IMD)',
  'Bachelor of Applied Science - Computer Science (Programming)',
]

const SEMESTER_RE = /^SEMESTER\s+(\d+)/i

export function loadMajors(path: string): { majors: MajorSheet[]; report: IngestReport } {
  const report: IngestReport = {
    source: 'Major Sheets.xlsx',
    rows_in: 0,
    rows_out: 0,
    warnings: [],
    notes: [
      'Each sheet parsed as two-column-pair layout (left semester, right semester).',
      'Course codes captured from the first column of each pair; titles from the second.',
      "Diploma sheets cover semesters 1–4; Bachelor sheets start at semester 5 (they assume a completed diploma).",
    ],
  }
  for (const m of KNOWN_MISSING) {
    report.warnings.push(
      warn('warn', 'MAJOR_MISSING', `Program '${m}' has no plan-of-study sheet in source.`),
    )
  }

  const wb = xlsx.readFile(path)
  const majors: MajorSheet[] = []

  for (const sheetName of wb.SheetNames) {
    const meta = SHEET_TO_LEVEL[sheetName.trim()]
    if (!meta) {
      report.warnings.push(
        warn('warn', 'MAJOR_SHEET_UNKNOWN', `Unrecognized sheet '${sheetName}' — skipping.`),
      )
      continue
    }
    const sheet = wb.Sheets[sheetName]!
    const data = xlsx.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null })
    report.rows_in += data.length

    // Walk rows, capturing semester-1 on left (cols 0..3) and semester-2 on right (cols 5..8).
    const blocks = new Map<number, Set<string>>()
    let curLeftSem = 0
    let curRightSem = 0

    for (const r of data) {
      const row = r as unknown[]
      const leftHeader = cellStr(row[0])
      const rightHeader = cellStr(row[5])
      if (leftHeader && SEMESTER_RE.test(leftHeader)) {
        curLeftSem = Number(SEMESTER_RE.exec(leftHeader)![1])
      }
      if (rightHeader && SEMESTER_RE.test(rightHeader)) {
        curRightSem = Number(SEMESTER_RE.exec(rightHeader)![1])
      }

      const leftCode = cellStr(row[0])
      const rightCode = cellStr(row[5])

      // Course-code rows (excluding headers and totals)
      if (
        leftCode &&
        /^[A-Z]{2,4}\s?\d{4}/.test(leftCode) &&
        curLeftSem > 0 &&
        leftCode.toLowerCase() !== 'course'
      ) {
        if (!blocks.has(curLeftSem)) blocks.set(curLeftSem, new Set())
        blocks.get(curLeftSem)!.add(leftCode.replace(/\s+/g, '').toUpperCase())
      }
      if (
        rightCode &&
        /^[A-Z]{2,4}\s?\d{4}/.test(rightCode) &&
        curRightSem > 0 &&
        rightCode.toLowerCase() !== 'course'
      ) {
        if (!blocks.has(curRightSem)) blocks.set(curRightSem, new Set())
        blocks.get(curRightSem)!.add(rightCode.replace(/\s+/g, '').toUpperCase())
      }
    }

    if (blocks.size === 0) {
      report.warnings.push(
        warn('warn', 'MAJOR_EMPTY', `Sheet '${sheetName}' yielded 0 semester blocks.`),
      )
      continue
    }

    const sem_blocks: SemesterBlock[] = [...blocks.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([s, set]) => ({ semester: s, required_courses: [...set].sort() }))

    majors.push({
      program_code: sheetName.trim(),
      name: meta.name,
      level: meta.level,
      semester_blocks: sem_blocks,
    })
  }

  report.rows_out = majors.length
  return { majors, report }
}

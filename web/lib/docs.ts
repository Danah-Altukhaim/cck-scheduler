// Reference-document inventory. The Schedule Process and Rules doc lists a
// handful of source documents ("attached"). They live in the sibling
// `CCK Scheduler Docs/` folder; this module is the single place the web app
// reads them.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export const DOCS_DIR = join(process.cwd(), '..', '..', 'CCK Scheduler Docs')

export interface RefDoc {
  // slug used in URLs; maps 1:1 to a file name
  slug: string
  // exact file name on disk
  file: string
  // human-friendly label
  label: string
  // which item in the policy doc this corresponds to
  policyHint: string
  // bytes
  size?: number
  exists: boolean
}

const REGISTRY: Omit<RefDoc, 'size' | 'exists'>[] = [
  {
    slug: 'schedule-process-and-rules',
    file: 'Schedule Process and Rules.pdf',
    label: 'Schedule Process and Rules (policy document)',
    policyHint: 'The full policy this site implements.',
  },
  {
    slug: 'major-sheets',
    file: 'Major Sheets.xlsx',
    label: 'Major sheet (programs and required courses)',
    policyHint: 'Major sheet (attached)',
  },
  {
    slug: 'lantiv-fall',
    file: 'Fall 25-26 Schedule - Lantiv version.Pdf',
    label: 'Lantiv schedule — Fall 25–26',
    policyHint: 'Copy of the Lantiv Timetabling System',
  },
  {
    slug: 'lantiv-spring',
    file: 'Spring 25-26 Schedule - Lantiv version.Pdf',
    label: 'Lantiv schedule — Spring 25–26',
    policyHint: 'Copy of the Lantiv Timetabling System',
  },
  {
    slug: 'lantiv-screenshot',
    file: 'Screen Shot of Lantive.pdf',
    label: 'Lantiv screenshot',
    policyHint: 'Screenshot of the Lantiv Timetabling System',
  },
  {
    slug: 'sis-fall',
    file: 'Fall Schedule 25-26 - SIS version.xlsx',
    label: 'Previous SIS schedule — Fall 25–26',
    policyHint: 'Previous schedules (SIS copy attached)',
  },
  {
    slug: 'sis-spring',
    file: 'Spring Schedule 25-26 - SIS version.xlsx',
    label: 'Previous SIS schedule — Spring 25–26',
    policyHint: 'Previous schedules (SIS copy attached)',
  },
  {
    slug: 'classroom-capacity',
    file: 'Classroom & Laboratory Capacity 2026.pdf',
    label: 'Classroom & laboratory capacity 2026',
    policyHint: 'List of labs and lectures (attached)',
  },
  {
    slug: 'merged-courses',
    file: 'Merged Courses.xlsx',
    label: 'Merged courses list',
    policyHint: 'Some courses have dual codes (merged courses)',
  },
  {
    slug: 'course-descriptions',
    file: 'Course Descriptions.docx',
    label: 'Course descriptions',
    policyHint: 'Courses to schedule each term',
  },
  {
    slug: 'instructor-availability',
    file: 'Per-instructor Availability.xlsx',
    label: 'Per-instructor availability',
    policyHint: 'Instructor schedules and availability',
  },
  {
    slug: 'academic-staff',
    file: 'Acadamic Staff Data.xlsx',
    label: 'Academic staff list',
    policyHint: 'List of academics',
  },
]

export function listRefDocs(): RefDoc[] {
  return REGISTRY.map((d) => {
    const full = join(DOCS_DIR, d.file)
    let exists = false
    let size: number | undefined
    try {
      if (existsSync(full)) {
        exists = true
        size = statSync(full).size
      }
    } catch {
      // ignore
    }
    return { ...d, exists, size }
  })
}

export function findRefDoc(slug: string): RefDoc | undefined {
  return listRefDocs().find((d) => d.slug === slug)
}

export function readRefDoc(slug: string): { buf: Buffer; doc: RefDoc } | undefined {
  const doc = findRefDoc(slug)
  if (!doc || !doc.exists) return undefined
  const buf = readFileSync(join(DOCS_DIR, doc.file))
  return { buf, doc }
}

export function contentTypeFor(file: string): string {
  const ext = file.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'application/pdf'
  if (ext === 'xlsx')
    return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  if (ext === 'xls') return 'application/vnd.ms-excel'
  if (ext === 'docx')
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  if (ext === 'doc') return 'application/msword'
  if (ext === 'html' || ext === 'htm') return 'text/html; charset=utf-8'
  return 'application/octet-stream'
}

export function formatBytes(n?: number): string {
  if (!n && n !== 0) return '—'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

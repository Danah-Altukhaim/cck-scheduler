import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { readPlan, importEnrollment } from '@/lib/store'
import type { EnrollmentRecord } from '@/lib/data'

export const dynamic = 'force-dynamic'

// Pull a value from a spreadsheet row by trying several header spellings.
function pick(row: Record<string, unknown>, names: string[]): unknown {
  for (const [k, v] of Object.entries(row)) {
    if (names.includes(k.trim().toLowerCase())) return v
  }
  return undefined
}

function asBool(v: unknown): boolean {
  const s = String(v ?? '').trim().toLowerCase()
  return ['yes', 'y', 'true', '1', 'working', 'puc'].includes(s)
}

function asLanguage(v: unknown): string {
  const s = String(v ?? '').trim().toLowerCase()
  if (s.startsWith('en')) return 'en'
  if (s.startsWith('ar')) return 'ar'
  return 'both'
}

// POST /api/enrollment/import?schedule=:id — load enrollment rows from a sheet.
// Columns (any reasonable spelling): major, language, working, puc, count.
// A later AI pass will read messier sheets; this is the straightforward path.
export async function POST(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'no file uploaded' }, { status: 400 })
    }
    const wb = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer' })
    const sheet = wb.SheetNames[0] ? wb.Sheets[wb.SheetNames[0]] : undefined
    if (!sheet) return NextResponse.json({ error: 'spreadsheet has no sheets' }, { status: 400 })
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'spreadsheet has no data rows' }, { status: 400 })
    }

    // Resolve a major cell against program codes or major names.
    const plan = readPlan(sid)
    const majorLookup = new Map<string, string>()
    for (const m of plan.majors ?? []) {
      majorLookup.set(m.program_code.toLowerCase(), m.program_code)
      majorLookup.set(m.name.toLowerCase(), m.program_code)
    }

    const recs: Omit<EnrollmentRecord, 'id'>[] = []
    for (const row of rows) {
      const rawMajor = String(pick(row, ['major', 'program', 'program_code']) ?? '').trim()
      if (!rawMajor) continue
      const count = Number(pick(row, ['count', 'students', 'enrollment', 'headcount']) ?? 0)
      recs.push({
        major: majorLookup.get(rawMajor.toLowerCase()) ?? rawMajor,
        language: asLanguage(pick(row, ['language', 'lang'])),
        working_student: asBool(pick(row, ['working_student', 'working', 'work'])),
        puc: asBool(pick(row, ['puc', 'funding', 'puc_funded'])),
        count: Number.isFinite(count) ? count : 0,
      })
    }
    if (recs.length === 0) {
      return NextResponse.json(
        { error: 'no rows with a "major" column were found' },
        { status: 400 },
      )
    }
    const imported = importEnrollment(sid, recs)
    return NextResponse.json({ ok: true, imported })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'import failed' },
      { status: 400 },
    )
  }
}

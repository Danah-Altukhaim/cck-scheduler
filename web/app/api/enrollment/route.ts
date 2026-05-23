import { NextRequest, NextResponse } from 'next/server'
import { listEnrollment, createEnrollment } from '@/lib/store'
import type { EnrollmentRecord } from '@/lib/data'

export const dynamic = 'force-dynamic'

// GET /api/enrollment?schedule=:id — list enrollment records.
export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  return NextResponse.json({ rows: listEnrollment(sid) })
}

// POST /api/enrollment?schedule=:id — add an enrollment record.
export async function POST(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    const body = (await req.json()) as Partial<EnrollmentRecord>
    if (!body.major) return NextResponse.json({ error: 'major is required' }, { status: 400 })
    const row = createEnrollment(sid, {
      major: body.major,
      language: body.language || 'both',
      working_student: !!body.working_student,
      puc: !!body.puc,
      count: Number(body.count) || 0,
    })
    return NextResponse.json({ row })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create failed' },
      { status: 400 },
    )
  }
}

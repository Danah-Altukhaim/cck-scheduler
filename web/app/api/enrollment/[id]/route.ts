import { NextRequest, NextResponse } from 'next/server'
import { updateEnrollment, deleteEnrollment } from '@/lib/store'
import type { EnrollmentRecord } from '@/lib/data'

export const dynamic = 'force-dynamic'

// PUT /api/enrollment/:id?schedule=:sid — update an enrollment record.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    const body = (await req.json()) as Partial<EnrollmentRecord>
    const row = updateEnrollment(sid, params.id, {
      ...(body.major !== undefined ? { major: body.major } : {}),
      ...(body.language !== undefined ? { language: body.language } : {}),
      ...(body.working_student !== undefined ? { working_student: !!body.working_student } : {}),
      ...(body.puc !== undefined ? { puc: !!body.puc } : {}),
      ...(body.count !== undefined ? { count: Number(body.count) || 0 } : {}),
    })
    return NextResponse.json({ row })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'update failed' },
      { status: 400 },
    )
  }
}

// DELETE /api/enrollment/:id?schedule=:sid — remove an enrollment record.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    deleteEnrollment(sid, params.id)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'delete failed' },
      { status: 400 },
    )
  }
}

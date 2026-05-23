import { NextRequest, NextResponse } from 'next/server'
import {
  listManualSections,
  createManualSection,
} from '@/lib/store'
import type { ManualSection } from '@/lib/data'

export const dynamic = 'force-dynamic'

export function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  return NextResponse.json({ rows: listManualSections(sid) })
}

export async function POST(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    const body = (await req.json()) as Omit<ManualSection, 'id'>
    if (
      !body.course_code ||
      !body.day ||
      typeof body.start_min !== 'number' ||
      typeof body.end_min !== 'number' ||
      !body.room_code ||
      !body.instructor_id
    ) {
      return NextResponse.json({ error: 'missing required fields' }, { status: 400 })
    }
    if (body.end_min <= body.start_min) {
      return NextResponse.json({ error: 'end time must be after start time' }, { status: 400 })
    }
    const row = createManualSection(sid, body)
    return NextResponse.json({ row })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create failed' },
      { status: 400 },
    )
  }
}

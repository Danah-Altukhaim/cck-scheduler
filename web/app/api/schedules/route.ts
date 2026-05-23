import { NextRequest, NextResponse } from 'next/server'
import { listSchedules, createSchedule } from '@/lib/schedules'

export const dynamic = 'force-dynamic'

// GET /api/schedules — list all schedules.
export async function GET() {
  return NextResponse.json({ schedules: listSchedules() })
}

// POST /api/schedules — create a schedule. body: { label, source }
// source: 'blank' | 'base' | <existing schedule id>
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { label?: string; source?: string }
    if (!body.label || !body.label.trim()) {
      return NextResponse.json({ error: 'a label is required' }, { status: 400 })
    }
    const meta = createSchedule(body.label, body.source || 'base')
    return NextResponse.json({ schedule: meta })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create failed' },
      { status: 400 },
    )
  }
}

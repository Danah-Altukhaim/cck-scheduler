import { NextRequest, NextResponse } from 'next/server'
import { renameSchedule, deleteSchedule, scheduleExists } from '@/lib/schedules'

export const dynamic = 'force-dynamic'

// PUT /api/schedules/:id — rename. body: { label }
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = (await req.json()) as { label?: string }
    if (!body.label || !body.label.trim()) {
      return NextResponse.json({ error: 'a label is required' }, { status: 400 })
    }
    renameSchedule(params.id, body.label)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'rename failed' },
      { status: 400 },
    )
  }
}

// DELETE /api/schedules/:id — remove the schedule and its folder.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!scheduleExists(params.id)) {
    return NextResponse.json({ error: 'schedule not found' }, { status: 404 })
  }
  deleteSchedule(params.id)
  return NextResponse.json({ ok: true })
}

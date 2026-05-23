import { NextRequest, NextResponse } from 'next/server'
import { isEntityType, updateEntity, deleteEntity } from '@/lib/store'

export const dynamic = 'force-dynamic'

// PUT /api/entities/:type/:id?schedule=:sid — update one record.
export async function PUT(req: NextRequest, { params }: { params: { type: string; id: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  if (!isEntityType(params.type)) {
    return NextResponse.json({ error: 'unknown entity type' }, { status: 404 })
  }
  try {
    const body = (await req.json()) as Record<string, unknown>
    const row = updateEntity(sid, params.type, decodeURIComponent(params.id), body)
    return NextResponse.json({ row })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'update failed' },
      { status: 400 },
    )
  }
}

// DELETE /api/entities/:type/:id?schedule=:sid — remove one record.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { type: string; id: string } },
) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  if (!isEntityType(params.type)) {
    return NextResponse.json({ error: 'unknown entity type' }, { status: 404 })
  }
  try {
    deleteEntity(sid, params.type, decodeURIComponent(params.id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'delete failed' },
      { status: 400 },
    )
  }
}

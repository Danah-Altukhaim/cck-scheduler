import { NextRequest, NextResponse } from 'next/server'
import { isEntityType, listEntities, createEntity } from '@/lib/store'

export const dynamic = 'force-dynamic'

// GET /api/entities/:type?schedule=:id — list records.
export async function GET(req: NextRequest, { params }: { params: { type: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  if (!isEntityType(params.type)) {
    return NextResponse.json({ error: 'unknown entity type' }, { status: 404 })
  }
  return NextResponse.json({ rows: listEntities(sid, params.type) })
}

// POST /api/entities/:type?schedule=:id — create one record.
export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  if (!isEntityType(params.type)) {
    return NextResponse.json({ error: 'unknown entity type' }, { status: 404 })
  }
  try {
    const body = (await req.json()) as Record<string, unknown>
    const row = createEntity(sid, params.type, body)
    return NextResponse.json({ row })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create failed' },
      { status: 400 },
    )
  }
}

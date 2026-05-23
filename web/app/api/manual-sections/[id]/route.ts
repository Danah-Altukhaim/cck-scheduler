import { NextRequest, NextResponse } from 'next/server'
import { deleteManualSection, updateManualSection } from '@/lib/store'
import type { ManualSection } from '@/lib/data'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    const body = (await req.json()) as Partial<ManualSection>
    const row = updateManualSection(sid, decodeURIComponent(params.id), body)
    return NextResponse.json({ row })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'update failed' },
      { status: 400 },
    )
  }
}

export function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    deleteManualSection(sid, decodeURIComponent(params.id))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'delete failed' },
      { status: 400 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getConfig, saveConfig, type CustomRule } from '@/lib/config'

export const dynamic = 'force-dynamic'

// PUT /api/rules/:id?schedule=:sid — update a custom rule.
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    const body = (await req.json()) as Partial<CustomRule>
    const config = getConfig(sid)
    const idx = config.customRules.findIndex((r) => r.id === params.id)
    if (idx < 0) return NextResponse.json({ error: 'rule not found' }, { status: 404 })
    const updated: CustomRule = { ...config.customRules[idx]!, ...body, id: params.id }
    config.customRules[idx] = updated
    saveConfig(sid, config)
    return NextResponse.json({ rule: updated })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'update failed' },
      { status: 400 },
    )
  }
}

// DELETE /api/rules/:id?schedule=:sid — remove a custom rule.
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  const config = getConfig(sid)
  const next = config.customRules.filter((r) => r.id !== params.id)
  if (next.length === config.customRules.length) {
    return NextResponse.json({ error: 'rule not found' }, { status: 404 })
  }
  config.customRules = next
  saveConfig(sid, config)
  return NextResponse.json({ ok: true })
}

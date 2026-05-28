import { NextRequest, NextResponse } from 'next/server'
import { getConfig, saveConfig, type SchedulerConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

// GET /api/config?schedule=:id — current settings + custom rules.
export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  return NextResponse.json(getConfig(sid))
}

// PUT /api/config?schedule=:id — update the settings knobs. Custom rules are
// managed through /api/rules and are preserved here.
export async function PUT(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    const body = (await req.json()) as Partial<SchedulerConfig>
    const current = getConfig(sid)
    saveConfig(sid, {
      operatingDays: body.operatingDays ?? current.operatingDays,
      operatingWindow: body.operatingWindow ?? current.operatingWindow,
      mondayBlock: body.mondayBlock ?? current.mondayBlock,
      buckets: body.buckets ?? current.buckets,
      customRules: current.customRules,
    })
    return NextResponse.json({ ok: true, config: getConfig(sid) })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'save failed' },
      { status: 400 },
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { getConfig, saveConfig, type CustomRule } from '@/lib/config'

export const dynamic = 'force-dynamic'

// GET /api/rules?schedule=:id — list custom rules.
export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  return NextResponse.json({ rules: getConfig(sid).customRules })
}

// POST /api/rules?schedule=:id — add a custom rule.
export async function POST(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  try {
    const body = (await req.json()) as Partial<CustomRule>
    if (!body.type || !body.name) {
      return NextResponse.json({ error: 'name and type are required' }, { status: 400 })
    }
    const config = getConfig(sid)
    const rule: CustomRule = {
      id: body.id && body.id.trim() ? body.id : `rule-${Date.now()}`,
      name: body.name,
      type: body.type,
      kind: body.kind ?? 'hard',
      enabled: body.enabled ?? true,
      params: body.params ?? {},
    }
    if (config.customRules.some((r) => r.id === rule.id)) {
      return NextResponse.json({ error: `rule "${rule.id}" already exists` }, { status: 400 })
    }
    config.customRules.push(rule)
    saveConfig(sid, config)
    return NextResponse.json({ rule })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'create failed' },
      { status: 400 },
    )
  }
}

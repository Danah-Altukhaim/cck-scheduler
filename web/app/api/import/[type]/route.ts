import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { isEntityType, importEntities } from '@/lib/store'

export const dynamic = 'force-dynamic'

// POST /api/import/:type?schedule=:id — bulk-load records from a spreadsheet.
// The first sheet's header row must use the entity's field names as columns.
export async function POST(req: NextRequest, { params }: { params: { type: string } }) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  if (!isEntityType(params.type)) {
    return NextResponse.json({ error: 'unknown entity type' }, { status: 404 })
  }
  try {
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof Blob)) {
      return NextResponse.json({ error: 'no file uploaded' }, { status: 400 })
    }
    const buf = Buffer.from(await file.arrayBuffer())
    const wb = XLSX.read(buf, { type: 'buffer' })
    const sheetName = wb.SheetNames[0]
    if (!sheetName) {
      return NextResponse.json({ error: 'spreadsheet has no sheets' }, { status: 400 })
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName]!)
    if (rows.length === 0) {
      return NextResponse.json({ error: 'spreadsheet has no data rows' }, { status: 400 })
    }
    const result = importEntities(sid, params.type, rows)
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'import failed' },
      { status: 400 },
    )
  }
}

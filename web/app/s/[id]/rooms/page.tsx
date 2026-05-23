import { getTermPlan, getSchedule, OPERATING_DAYS } from '@/lib/data'
import { EntityEditor, type FieldSpec } from '@/components/EntityEditor'

export const dynamic = 'force-dynamic'

const FIELDS: FieldSpec[] = [
  { name: 'code', label: 'Room code', kind: 'text', idField: true },
  { name: 'display_name', label: 'Display name', kind: 'text' },
  { name: 'type', label: 'Type', kind: 'select', options: ['lecture', 'lab', 'special'] },
  { name: 'floor', label: 'Floor', kind: 'select', options: ['ground', 'first', 'second', 'unknown'] },
  { name: 'capacity', label: 'Capacity', kind: 'number' },
  { name: 'aliases', label: 'Aliases', kind: 'tags' },
]

export default function RoomsPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)

  const AVAILABLE_HRS = 12 * 5
  const usage = new Map<string, { mins: number; sections: Set<string> }>()
  for (const a of sched.assignments) {
    if (!OPERATING_DAYS.includes(a.day)) continue
    const u = usage.get(a.room_code) || { mins: 0, sections: new Set<string>() }
    u.mins += a.end_min - a.start_min
    u.sections.add(a.section_id)
    usage.set(a.room_code, u)
  }

  const computed: Record<string, Record<string, string>> = {}
  for (const r of plan.rooms) {
    const u = usage.get(r.code)
    const hrs = (u?.mins || 0) / 60
    const pct = (hrs / AVAILABLE_HRS) * 100
    computed[r.code] = {
      used: `${hrs.toFixed(1)}h`,
      util: `${pct.toFixed(0)}%`,
      placed: String(u?.sections.size || 0),
    }
  }

  return (
    <EntityEditor
      scheduleId={sid}
      type="rooms"
      idField="code"
      title="Rooms"
      subtitle={`${usage.size} in use · weekly capacity 60h`}
      fields={FIELDS}
      initialRows={plan.rooms as unknown as Record<string, unknown>[]}
      computed={computed}
      computedColumns={[
        { key: 'used', label: 'Hours used' },
        { key: 'util', label: 'Utilization' },
        { key: 'placed', label: 'Sections' },
      ]}
    />
  )
}

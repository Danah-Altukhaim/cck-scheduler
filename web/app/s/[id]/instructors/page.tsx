import { getTermPlan, getSchedule } from '@/lib/data'
import { EntityEditor, type FieldSpec } from '@/components/EntityEditor'

export const dynamic = 'force-dynamic'

const RANKS = [
  'Professor',
  'Associate Professor',
  'Assistant Professor',
  'Senior Lecturer',
  'Lecturer',
  'Assistant Lecturer',
  'Senior Instructor',
  'Instructor',
  'Assistant Instructor',
  'Unknown',
]

const FIELDS: FieldSpec[] = [
  { name: 'id', label: 'ID', kind: 'text', idField: true },
  { name: 'name', label: 'Name', kind: 'text' },
  { name: 'rank', label: 'Rank', kind: 'select', options: RANKS },
  { name: 'department', label: 'Department', kind: 'text' },
  { name: 'employment', label: 'Employment', kind: 'select', options: ['full-time', 'part-time', 'HOD'] },
  { name: 'weekly_cap_hours', label: 'Weekly cap (h)', kind: 'number' },
  { name: 'daily_cap_hours', label: 'Daily cap (h)', kind: 'number' },
  { name: 'status', label: 'Status', kind: 'select', options: ['active', 'missing-from-roster'] },
  { name: 'email', label: 'Email', kind: 'text' },
  { name: 'certifications', label: 'Certifications (course codes)', kind: 'tags' },
  { name: 'name_aliases', label: 'Name aliases', kind: 'tags' },
  { name: 'source', label: 'Source', kind: 'tags' },
  { name: 'availability_windows', label: 'Availability windows', kind: 'availability-windows' },
]

export default function InstructorsPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)

  const load = new Map<string, number>()
  for (const a of sched.assignments) {
    load.set(a.instructor_id, (load.get(a.instructor_id) || 0) + (a.end_min - a.start_min))
  }

  const computed: Record<string, Record<string, string>> = {}
  for (const i of plan.instructors) {
    const hrs = (load.get(i.id) || 0) / 60
    const pct = i.weekly_cap_hours > 0 ? (hrs / i.weekly_cap_hours) * 100 : 0
    computed[i.id] = { assigned: `${hrs.toFixed(1)}h`, util: `${pct.toFixed(0)}%` }
  }

  return (
    <EntityEditor
      scheduleId={sid}
      type="instructors"
      idField="id"
      title="Instructors"
      subtitle="rank-based weekly caps · empty certifications = can teach anything"
      fields={FIELDS}
      initialRows={plan.instructors as unknown as Record<string, unknown>[]}
      computed={computed}
      computedColumns={[
        { key: 'assigned', label: 'Hours assigned' },
        { key: 'util', label: 'Utilization' },
      ]}
    />
  )
}

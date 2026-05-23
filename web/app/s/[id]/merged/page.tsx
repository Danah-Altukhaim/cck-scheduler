import { getTermPlan } from '@/lib/data'
import { EntityEditor, type FieldSpec } from '@/components/EntityEditor'

export const dynamic = 'force-dynamic'

const FIELDS: FieldSpec[] = [
  { name: 'id', label: 'Group ID', kind: 'text', idField: true },
  { name: 'course_codes', label: 'Course codes', kind: 'tags' },
  { name: 'rationale', label: 'Rationale', kind: 'text' },
]

export default function MergedGroupsPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  return (
    <EntityEditor
      scheduleId={sid}
      type="merged-groups"
      idField="id"
      title="Merged groups"
      subtitle="courses in a group are taught together: same room, time, and instructor"
      fields={FIELDS}
      initialRows={plan.merged_groups as unknown as Record<string, unknown>[]}
    />
  )
}

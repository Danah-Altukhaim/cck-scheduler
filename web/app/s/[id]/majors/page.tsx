import { getTermPlan } from '@/lib/data'
import { EntityEditor, type FieldSpec } from '@/components/EntityEditor'

export const dynamic = 'force-dynamic'

const FIELDS: FieldSpec[] = [
  { name: 'program_code', label: 'Program code', kind: 'text', idField: true },
  { name: 'name', label: 'Name', kind: 'text' },
  { name: 'level', label: 'Level', kind: 'select', options: ['Diploma', 'Bachelor'] },
  { name: 'semester_blocks', label: 'Semester blocks', kind: 'semester-blocks' },
]

export default function MajorsPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  return (
    <EntityEditor
      scheduleId={sid}
      type="majors"
      idField="program_code"
      title="Majors"
      subtitle="semester blocks drive the cohort no-conflict rule"
      fields={FIELDS}
      initialRows={plan.majors as unknown as Record<string, unknown>[]}
    />
  )
}

import { getTermPlan } from '@/lib/data'
import { EnrollmentEditor } from '@/components/EnrollmentEditor'

export const dynamic = 'force-dynamic'

export default function EnrollmentPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  return (
    <EnrollmentEditor
      scheduleId={sid}
      initialRows={plan.enrollment ?? []}
      majors={plan.majors.map((m) => ({ program_code: m.program_code, name: m.name }))}
    />
  )
}

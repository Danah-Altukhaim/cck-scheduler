import { getTermPlan, getSchedule } from '@/lib/data'
import { getScheduleMeta } from '@/lib/schedules'
import { ScheduleView } from './ScheduleView'

export const dynamic = 'force-dynamic'

export default function SchedulePage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)
  const meta = getScheduleMeta(sid)

  return (
    <main className="page">
      <ScheduleView
        scheduleId={sid}
        rooms={plan.rooms}
        instructors={plan.instructors}
        courses={plan.courses}
        sections={plan.sections}
        assignments={sched.assignments}
        termLabel={meta?.label ?? `${plan.term.season} ${plan.term.year}`}
      />
    </main>
  )
}

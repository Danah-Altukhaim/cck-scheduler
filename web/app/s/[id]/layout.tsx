import { notFound } from 'next/navigation'
import { TopNav } from '@/components/TopNav'
import { Stepper } from '@/components/Stepper'
import { getScheduleMeta } from '@/lib/schedules'
import { getTermPlan, getSchedule } from '@/lib/data'

export const dynamic = 'force-dynamic'

export default function ScheduleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { id: string }
}) {
  const meta = getScheduleMeta(params.id)
  if (!meta) notFound()

  const plan = getTermPlan(params.id)
  const sched = getSchedule(params.id)
  const inputsDone =
    plan.courses.length > 0 && plan.instructors.length > 0 && plan.rooms.length > 0
  const generated = sched.assignments.length > 0

  return (
    <>
      <TopNav label={meta.label} />
      <Stepper scheduleId={params.id} inputsDone={inputsDone} generated={generated} />
      <main className="max-w-[1400px] mx-auto px-6 py-6">{children}</main>
    </>
  )
}

import { notFound } from 'next/navigation'
import { AppShell } from '@/components/app/AppShell'
import { getScheduleMeta, listSchedules } from '@/lib/schedules'
import { getTermPlan, getSchedule } from '@/lib/data'
import { getConfig } from '@/lib/config'

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
  const all = listSchedules()
  const customRules = (() => {
    try { return getConfig(params.id).customRules } catch { return [] }
  })()

  const inputsDone =
    plan.courses.length > 0 && plan.instructors.length > 0 && plan.rooms.length > 0
  const generated = sched.assignments.length > 0
  void generated

  const issueCount = (plan.reports ?? []).reduce(
    (sum, r) => sum + (r.warnings?.length ?? 0),
    0,
  )

  return (
    <AppShell
      scheduleId={params.id}
      schedule={meta}
      schedules={all}
      ready={inputsDone}
      counts={{
        sections: plan.sections.length,
        instructors: plan.instructors.length,
        rooms: plan.rooms.length,
        courses: plan.courses.length,
        majors: plan.majors.length,
        merged: plan.merged_groups.length,
        enrollment: plan.enrollment?.length ?? 0,
        rules: customRules.length,
        issues: issueCount,
      }}
    >
      {children}
    </AppShell>
  )
}

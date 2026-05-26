import { getTermPlan, getSchedule, getScheduleMtime } from '@/lib/data'
import { getConfig } from '@/lib/config'
import { GenerateView } from './GenerateView'

export const dynamic = 'force-dynamic'

export default function GeneratePage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)
  const config = getConfig(sid)
  const mtime = getScheduleMtime(sid)

  const placed = new Set(sched.assignments.map((a) => a.section_id)).size
  const total = plan.sections.length
  const hasResult = sched.assignments.length > 0
  const totalIssues = (plan.reports ?? []).reduce((sum, r) => sum + (r.warnings?.length ?? 0), 0)

  type StatusKey = 'ok' | 'warn' | 'error'
  const preflight: { label: string; status: StatusKey; detail: string; hint?: string; href?: string }[] = [
    {
      label: 'Courses',
      status: plan.courses.length > 0 ? 'ok' : 'error',
      detail: `${plan.courses.length} loaded`,
      hint: plan.courses.length === 0 ? 'Add or import at least one course.' : undefined,
      href: `/s/${sid}/courses`,
    },
    {
      label: 'Instructors',
      status: plan.instructors.length > 0 ? 'ok' : 'error',
      detail: `${plan.instructors.length} loaded`,
      hint:
        plan.instructors.length === 0
          ? 'Add or import instructors.'
          : `${plan.instructors.filter((i) => i.status === 'active').length} active`,
      href: `/s/${sid}/instructors`,
    },
    {
      label: 'Rooms',
      status: plan.rooms.length > 0 ? 'ok' : 'error',
      detail: `${plan.rooms.length} loaded`,
      hint: plan.rooms.length === 0 ? 'Add or import rooms.' : undefined,
      href: `/s/${sid}/rooms`,
    },
    {
      label: 'Enrollment forecast',
      status: (plan.enrollment ?? []).length > 0 ? 'ok' : 'warn',
      detail: `${(plan.enrollment ?? []).length} rows`,
      hint:
        (plan.enrollment ?? []).length === 0
          ? 'No enrollment data — Stage 1 will estimate demand from last term.'
          : `${(plan.enrollment ?? []).reduce((s, r) => s + r.count, 0)} students total`,
      href: `/s/${sid}/enrollment`,
    },
    {
      label: 'Majors',
      status: plan.majors.length > 0 ? 'ok' : 'warn',
      detail: `${plan.majors.length} sheets`,
      hint:
        plan.majors.length === 0
          ? 'No major sheets — cohort no-conflict rule (H6) is inert without them.'
          : undefined,
      href: `/s/${sid}/majors`,
    },
    {
      label: 'Custom rules',
      status: 'ok',
      detail: `${config.customRules.filter((r) => r.enabled).length} enabled · ${config.customRules.length} total`,
      href: `/s/${sid}/rules`,
    },
    {
      label: 'Operating window',
      status: 'ok',
      detail: `${config.operatingDays.join(' / ')} · ${Math.floor(config.operatingWindow.startMin / 60)}:${String(config.operatingWindow.startMin % 60).padStart(2, '0')}–${Math.floor(config.operatingWindow.endMin / 60)}:${String(config.operatingWindow.endMin % 60).padStart(2, '0')}`,
      href: `/s/${sid}/settings`,
    },
    {
      label: 'Data issues',
      status: totalIssues > 0 ? 'warn' : 'ok',
      detail: `${totalIssues} warning${totalIssues === 1 ? '' : 's'} from ingest`,
      hint: totalIssues > 0 ? 'Warnings won\'t block the solver but may indicate data drift.' : undefined,
      href: `/s/${sid}/issues`,
    },
  ]

  const stats = [
    { label: 'Sections to place', value: plan.sections.length, hint: 'opened by Stage 1' },
    { label: 'Courses', value: plan.courses.length },
    { label: 'Instructors', value: plan.instructors.length, hint: `${plan.instructors.filter((i) => i.status === 'active').length} active` },
    { label: 'Rooms', value: plan.rooms.length },
  ]

  return (
    <GenerateView
      scheduleId={sid}
      preflight={preflight}
      stats={stats}
      result={{ placed, total, hasResult }}
      lastSolvedAt={mtime ? mtime.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : null}
    />
  )
}

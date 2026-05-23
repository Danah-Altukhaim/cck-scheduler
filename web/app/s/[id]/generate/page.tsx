import Link from 'next/link'
import { CheckCircle2, ArrowRight, ArrowLeft, Clock } from 'lucide-react'
import { getTermPlan, getSchedule, getScheduleMtime } from '@/lib/data'
import { getConfig } from '@/lib/config'
import { SolveButton } from '../SolveButton'

export const dynamic = 'force-dynamic'

export default function GeneratePage({ params }: { params: { id: string } }) {
  const sid = params.id
  const base = `/s/${sid}`
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)
  const config = getConfig(sid)
  const mtime = getScheduleMtime(sid)

  const placed = new Set(sched.assignments.map((a) => a.section_id)).size
  const total = plan.sections.length
  const hasResult = sched.assignments.length > 0

  const stats = [
    { label: 'Courses', value: plan.courses.length },
    { label: 'Instructors', value: plan.instructors.length },
    { label: 'Rooms', value: plan.rooms.length },
    { label: 'Custom rules', value: config.customRules.filter((r) => r.enabled).length },
  ]

  return (
    <div className="space-y-7">
      <header>
        <div className="text-xs font-semibold text-cck-green uppercase tracking-wide">Step 3 of 4</div>
        <h1 className="text-3xl font-bold mt-1.5">Generate the schedule</h1>
        <p className="text-[15px] text-cck-muted mt-1.5 max-w-2xl">
          The solver places every course into a room, an instructor, and a time slot while
          respecting your rules.
        </p>
      </header>

      <section className="space-y-2">
        <div className="text-xs font-semibold text-cck-muted uppercase tracking-wide">
          What will be scheduled
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="kpi">
              <div className="label">{s.label}</div>
              <div className="value">{s.value}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="card p-6 space-y-4">
        <div>
          <div className="font-semibold text-[15px]">Ready to generate</div>
          <p className="text-sm text-cck-muted mt-1 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            This usually takes ~5 minutes. You can leave this page; the solve keeps running.
          </p>
        </div>
        <SolveButton scheduleId={sid} />
      </div>

      {hasResult && (
        <div className="card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-9 w-9" style={{ color: '#1f7a3d' }} />
            <div>
              <div className="font-semibold">
                {placed === total
                  ? `All ${total} sections placed`
                  : `${placed} of ${total} sections placed`}
              </div>
              <div className="text-sm text-cck-muted">
                {mtime
                  ? `Generated ${mtime.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}`
                  : 'A schedule is ready'}
              </div>
            </div>
          </div>
          <Link href={`${base}/schedule`} className="btn-primary">
            View the schedule <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <div className="border-t border-cck-line pt-5">
        <Link href={`${base}/constraints`} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
      </div>
    </div>
  )
}

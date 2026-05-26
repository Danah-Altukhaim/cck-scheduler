import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  CalendarRange,
  CheckCircle2,
  Clock,
  DoorOpen,
  GraduationCap,
  Layers,
  ListChecks,
  Play,
  SlidersHorizontal,
  Users,
  UserPlus,
} from 'lucide-react'
import { getTermPlan, getSchedule, getScheduleMtime } from '@/lib/data'
import { getConfig } from '@/lib/config'
import { Badge, Button } from '@/components/ui'

export const dynamic = 'force-dynamic'

export default function ScheduleDashboard({ params }: { params: { id: string } }) {
  const sid = params.id
  const base = `/s/${sid}`
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)
  const config = getConfig(sid)
  const mtime = getScheduleMtime(sid)

  const placedCount = new Set(sched.assignments.map((a) => a.section_id)).size
  const total = plan.sections.length
  const hasResult = sched.assignments.length > 0
  const inputsReady =
    plan.courses.length > 0 && plan.instructors.length > 0 && plan.rooms.length > 0
  const totalIssues = (plan.reports ?? []).reduce((sum, r) => sum + (r.warnings?.length ?? 0), 0)
  const enrollmentTotal = (plan.enrollment ?? []).reduce((s, r) => s + r.count, 0)
  const placementPct = total > 0 ? Math.round((placedCount / total) * 100) : 0

  const inputCards = [
    { seg: '/courses', name: 'Courses', count: plan.courses.length, Icon: BookOpen },
    { seg: '/instructors', name: 'Instructors', count: plan.instructors.length, Icon: Users },
    { seg: '/rooms', name: 'Rooms', count: plan.rooms.length, Icon: DoorOpen },
    { seg: '/enrollment', name: 'Enrollment', count: enrollmentTotal, Icon: UserPlus },
    { seg: '/majors', name: 'Majors', count: plan.majors.length, Icon: GraduationCap },
    { seg: '/merged', name: 'Merged groups', count: plan.merged_groups.length, Icon: Layers },
  ]

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Overview</div>
          <h1>{plan.term.season} {plan.term.year}</h1>
          <div className="sub">
            {hasResult ? (
              <>
                Last solved {mtime?.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) ?? '—'} ·{' '}
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>{placedCount}</span> of {total} sections placed
              </>
            ) : inputsReady ? (
              'Inputs look ready. Generate the schedule when you are.'
            ) : (
              'Add courses, instructors, and rooms to enable the solver.'
            )}
          </div>
        </div>
        <div className="page-actions">
          {hasResult && (
            <Button
              variant="secondary"
              icon={<CalendarRange size={14} />}
            >
              <Link href={`${base}/schedule`} style={{ color: 'inherit' }}>View schedule</Link>
            </Button>
          )}
          <Link href={`${base}/generate`} className={`btn btn-primary`}>
            <Play size={14} />
            {hasResult ? 'Re-generate' : 'Generate'}
          </Link>
        </div>
      </header>

      {/* KPI strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="kpi">
          <div className="label">Sections</div>
          <div className="value">{total}</div>
          <div className="sub">opened by Stage 1</div>
        </div>
        <div className="kpi">
          <div className="label">Placed</div>
          <div className="value">
            {placedCount} <span style={{ fontSize: 16, color: 'var(--muted)' }}>/ {total}</span>
          </div>
          <div className="sub">
            {hasResult ? `${placementPct}% placement rate` : 'Not generated yet'}
          </div>
        </div>
        <div className="kpi">
          <div className="label">Rules in play</div>
          <div className="value">
            14<span style={{ fontSize: 16, color: 'var(--muted)' }}>+9</span>
            {config.customRules.length > 0 && (
              <span style={{ fontSize: 16, color: 'var(--accent)', fontWeight: 600 }}> +{config.customRules.length}</span>
            )}
          </div>
          <div className="sub">hard · soft · custom</div>
        </div>
        <div className="kpi" style={{ borderColor: totalIssues > 0 ? 'var(--warn-strong)' : undefined }}>
          <div className="label" style={{ color: totalIssues > 0 ? 'var(--warn)' : undefined }}>Open issues</div>
          <div className="value">{totalIssues}</div>
          <div className="sub">{totalIssues > 0 ? 'data drift warnings' : 'all clean'}</div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Solver status */}
        <section
          className="card"
          style={{ padding: 18, gridColumn: 'span 2', minHeight: 168 }}
        >
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-label">Solver</div>
              <div className="text-h2" style={{ marginTop: 2 }}>
                {hasResult
                  ? placedCount === total
                    ? 'All sections placed'
                    : 'Schedule generated'
                  : 'No schedule yet'}
              </div>
            </div>
            {hasResult ? (
              <Badge tone="green" dot>
                <CheckCircle2 size={11} /> {placementPct}% placed
              </Badge>
            ) : (
              <Badge tone="muted" dot>
                <Clock size={11} /> pending
              </Badge>
            )}
          </div>
          {hasResult ? (
            <div>
              <div className="progress" aria-label={`${placementPct}% placed`}>
                <span style={{ width: `${placementPct}%` }} />
              </div>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <Link href={`${base}/schedule`} className="btn btn-primary btn-sm">
                  Open schedule <ArrowRight size={12} />
                </Link>
                <Link href={`${base}/sections`} className="btn btn-secondary btn-sm">
                  Review sections
                </Link>
                <Link href={`${base}/generate`} className="btn btn-ghost btn-sm">
                  Re-generate
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 flex-wrap">
              <p className="text-body-sm" style={{ color: 'var(--muted)', maxWidth: '54ch' }}>
                {inputsReady
                  ? 'All required inputs are in place. Running the solver typically takes 5–10 minutes.'
                  : 'Add courses, instructors, and rooms first — the solver cannot run without them.'}
              </p>
              <Link
                href={`${base}/generate`}
                className={`btn ${inputsReady ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              >
                <Play size={12} />
                Go to Generate
              </Link>
            </div>
          )}
        </section>

        {/* Quick actions */}
        <section className="card" style={{ padding: 18, minHeight: 168 }}>
          <div className="text-label mb-2">Shortcuts</div>
          <div className="flex flex-col gap-1.5">
            <Link href={`${base}/rules`} className="sidebar-item">
              <SlidersHorizontal size={14} /> Rules
              <span className="count">14+9+{config.customRules.length}</span>
            </Link>
            <Link href={`${base}/sections`} className="sidebar-item">
              <ListChecks size={14} /> Sections
              <span className="count">{total}</span>
            </Link>
            <Link href={`${base}/issues`} className="sidebar-item">
              <Clock size={14} /> Data issues
              <span className="count">{totalIssues}</span>
            </Link>
            <Link href={`${base}/settings`} className="sidebar-item">
              <SlidersHorizontal size={14} /> Term settings
            </Link>
          </div>
        </section>
      </div>

      {/* Inputs status */}
      <section className="mb-6">
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-h2">Inputs</h2>
            <p className="text-caption" style={{ marginTop: 2 }}>
              The dataset Stage 1 reads when opening sections. Click any tile to edit.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {inputCards.map((c) => (
            <Link key={c.seg} href={`${base}${c.seg}`} className="card card-link" style={{ padding: 16 }}>
              <div className="flex items-start justify-between">
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 32,
                    height: 32,
                    background: 'var(--accent-soft)',
                    borderRadius: 8,
                    color: 'var(--accent)',
                  }}
                >
                  <c.Icon size={16} />
                </div>
                <span className="text-h2 tabular">{c.count}</span>
              </div>
              <div className="text-body-sm" style={{ marginTop: 12, fontWeight: 600 }}>
                {c.name}
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}

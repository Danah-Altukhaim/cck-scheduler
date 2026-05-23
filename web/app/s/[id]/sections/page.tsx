import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTermPlan, getSchedule, minToHHMM, DAY_LABEL } from '@/lib/data'
import { listManualSections } from '@/lib/store'
import { ManualSectionsEditor } from '@/components/ManualSectionsEditor'

export const dynamic = 'force-dynamic'

export default function SectionsPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)
  const manualSections = listManualSections(sid)
  const courseMap = new Map(plan.courses.map((c) => [c.code, c]))
  const instMap = new Map(plan.instructors.map((i) => [i.id, i]))

  const byId = new Map<string, typeof sched.assignments>()
  for (const a of sched.assignments) {
    if (!byId.has(a.section_id)) byId.set(a.section_id, [])
    byId.get(a.section_id)!.push(a)
  }

  const rows = plan.sections.slice().sort((a, b) => {
    const ap = byId.has(a.id) ? 1 : 0
    const bp = byId.has(b.id) ? 1 : 0
    if (ap !== bp) return ap - bp
    return a.course_code.localeCompare(b.course_code)
  })

  return (
    <div className="space-y-6">
      <Link
        href={`/s/${params.id}/schedule`}
        className="inline-flex items-center gap-1 text-sm text-cck-muted hover:text-cck-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Schedule
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Sections</h1>
        <p className="text-sm text-cck-muted mt-1">
          {plan.sections.length} sections opened by Stage 1 · {byId.size} placed · solver-generated
          sections are read-only · {manualSections.length} independent section
          {manualSections.length === 1 ? '' : 's'} added below
        </p>
      </header>

      <ManualSectionsEditor
        scheduleId={sid}
        initial={manualSections}
        courses={plan.courses.map((c) => ({ code: c.code, name_en: c.name_en }))}
        instructors={plan.instructors.map((i) => ({ id: i.id, name: i.name }))}
        rooms={plan.rooms.map((r) => ({
          code: r.code,
          display_name: r.display_name,
          capacity: r.capacity,
        }))}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Solver-generated sections</h2>
        <div className="border border-cck-line rounded-md bg-white overflow-x-auto">
          <table className="cck">
            <thead>
              <tr>
                <th>Status</th>
                <th>Section ID</th>
                <th>Course</th>
                <th>Lang</th>
                <th>Bucket</th>
                <th>Cap</th>
                <th>Days</th>
                <th>Time</th>
                <th>Room</th>
                <th>Instructor</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-sm text-cck-muted">
                    No sections yet. Add courses and run the solver.
                  </td>
                </tr>
              )}
              {rows.map((s) => {
                const c = courseMap.get(s.course_code)
                const ass = byId.get(s.id)
                const placed = !!ass
                const days = ass ? ass.map((a) => DAY_LABEL[a.day]).join(' / ') : '-'
                const time = ass
                  ? `${minToHHMM(ass[0]!.start_min)}–${minToHHMM(ass[0]!.end_min)}`
                  : '-'
                const room = ass ? ass[0]!.room_code : '-'
                const inst = ass
                  ? instMap.get(ass[0]!.instructor_id)?.name || ass[0]!.instructor_id
                  : '-'
                return (
                  <tr key={s.id}>
                    <td>
                      {placed ? (
                        <span className="badge green">placed</span>
                      ) : (
                        <span className="badge red">unplaced</span>
                      )}
                    </td>
                    <td>
                      <code className="text-xs">{s.id}</code>
                    </td>
                    <td>
                      <div className="font-medium">{s.course_code}</div>
                      <div className="text-xs text-cck-muted">{c?.name_en}</div>
                    </td>
                    <td>{s.language}</td>
                    <td>
                      <span className="badge muted">{s.time_bucket}</span>
                    </td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {s.enrollment_cap}
                    </td>
                    <td>{days}</td>
                    <td>{time}</td>
                    <td>{room}</td>
                    <td>{inst}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

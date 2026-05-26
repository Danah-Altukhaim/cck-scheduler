import { getTermPlan, getSchedule } from '@/lib/data'
import { listManualSections } from '@/lib/store'
import { ManualSectionsEditor } from '@/components/ManualSectionsEditor'
import { SectionsTable } from './SectionsTable'

export const dynamic = 'force-dynamic'

export default function SectionsPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)
  const manualSections = listManualSections(sid)
  const placedSet = new Set(sched.assignments.map((a) => a.section_id))
  const placed = plan.sections.filter((s) => placedSet.has(s.id)).length

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Sections</div>
          <h1>Section roster</h1>
          <div className="sub">
            {plan.sections.length} sections opened by Stage 1 · {placed} placed by the solver ·{' '}
            {manualSections.length} independent / manual section{manualSections.length === 1 ? '' : 's'}
          </div>
        </div>
      </header>

      <section className="mb-8">
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
      </section>

      <section>
        <h2 className="text-h2 mb-3">Solver-generated sections</h2>
        <SectionsTable
          sections={plan.sections}
          assignments={sched.assignments}
          courses={plan.courses}
          instructors={plan.instructors}
        />
      </section>
    </main>
  )
}

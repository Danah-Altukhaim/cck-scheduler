import Link from 'next/link'
import { getTermPlan, getSchedule, OPERATING_DAYS, DAY_LABEL, courseClass, minToHHMM } from '@/lib/data'
import type { Assignment } from '@/lib/data'
import { ScheduleFilters } from './ScheduleFilters'

export const dynamic = 'force-dynamic'

interface SearchParams {
  room?: string
  instructor?: string
  dept?: string
}

export default function SchedulePage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: SearchParams
}) {
  const sid = params.id
  const plan = getTermPlan(sid)
  const sched = getSchedule(sid)

  const sectionMap = new Map(plan.sections.map((s) => [s.id, s]))
  const courseMap = new Map(plan.courses.map((c) => [c.code, c]))
  const instMap = new Map(plan.instructors.map((i) => [i.id, i]))
  const roomMap = new Map(plan.rooms.map((r) => [r.code, r]))

  let assignments: Assignment[] = sched.assignments
  if (searchParams.room) assignments = assignments.filter((a) => a.room_code === searchParams.room)
  if (searchParams.instructor)
    assignments = assignments.filter((a) => a.instructor_id === searchParams.instructor)
  if (searchParams.dept) {
    assignments = assignments.filter(
      (a) => instMap.get(a.instructor_id)?.department === searchParams.dept,
    )
  }

  const startMin = 8 * 60
  const endMin = 20 * 60
  const slotMin = 30
  const numSlots = (endMin - startMin) / slotMin

  const cellMap = new Map<string, Assignment[]>()
  for (const a of assignments) {
    if (!OPERATING_DAYS.includes(a.day)) continue
    const slotIdx = Math.floor((a.start_min - startMin) / slotMin)
    const key = `${a.day}|${slotIdx}`
    if (!cellMap.has(key)) cellMap.set(key, [])
    cellMap.get(key)!.push(a)
  }

  const depts = [...new Set(plan.instructors.map((i) => i.department))].filter(Boolean).sort()
  const placedTotal = new Set(sched.assignments.map((a) => a.section_id)).size
  const total = plan.sections.length
  const allPlaced = total > 0 && placedTotal === total

  return (
    <div className="space-y-5">
      <header>
        <div className="text-sm font-semibold text-cck-green">Step 4 of 4</div>
        <h1 className="text-2xl font-bold mt-1">Your schedule</h1>
        <p className="text-sm text-cck-muted mt-1">
          {total === 0
            ? 'No schedule yet. Go to Step 3 to generate one.'
            : allPlaced
              ? `All ${total} sections placed.`
              : `${placedTotal} of ${total} sections placed. ${total - placedTotal} could not be scheduled.`}
        </p>
      </header>

      <div className="flex items-center gap-4 text-sm">
        <Link href={`/s/${sid}/sections`} className="text-cck-green hover:underline">
          View all sections →
        </Link>
        <Link href={`/s/${sid}/issues`} className="text-cck-green hover:underline">
          Data issues →
        </Link>
      </div>

      <ScheduleFilters
        basePath={`/s/${sid}/schedule`}
        rooms={plan.rooms.map((r) => ({ code: r.code, display: r.display_name }))}
        instructors={plan.instructors.map((i) => ({ id: i.id, name: i.name }))}
        depts={depts as string[]}
      />

      <div className="border border-cck-line rounded-md bg-white overflow-x-auto">
        <div
          className="sched"
          style={{
            gridTemplateColumns: `60px repeat(${OPERATING_DAYS.length}, minmax(180px, 1fr))`,
            gridAutoRows: 'minmax(34px, auto)',
          }}
        >
          <div className="hdr"></div>
          {OPERATING_DAYS.map((d) => (
            <div key={d} className="hdr">{DAY_LABEL[d]}</div>
          ))}
          {Array.from({ length: numSlots }).map((_, slotIdx) => (
            <Row
              key={slotIdx}
              slotIdx={slotIdx}
              startMin={startMin}
              slotMin={slotMin}
              cellMap={cellMap}
              sectionMap={sectionMap}
              courseMap={courseMap}
              roomMap={roomMap}
              instMap={instMap}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Row(props: {
  slotIdx: number
  startMin: number
  slotMin: number
  cellMap: Map<string, Assignment[]>
  sectionMap: Map<string, ReturnType<typeof getTermPlan>['sections'][number]>
  courseMap: Map<string, ReturnType<typeof getTermPlan>['courses'][number]>
  roomMap: Map<string, ReturnType<typeof getTermPlan>['rooms'][number]>
  instMap: Map<string, ReturnType<typeof getTermPlan>['instructors'][number]>
}) {
  const { slotIdx, startMin, slotMin, cellMap, sectionMap, courseMap, roomMap, instMap } = props
  const t = startMin + slotIdx * slotMin
  const showLabel = t % 60 === 0
  return (
    <>
      <div className="time">{showLabel ? minToHHMM(t) : ''}</div>
      {OPERATING_DAYS.map((d) => {
        const evs = cellMap.get(`${d}|${slotIdx}`) || []
        return (
          <div key={d + slotIdx} className="cell">
            {evs.map((a, i) => {
              const sec = sectionMap.get(a.section_id)
              const c = sec ? courseMap.get(sec.course_code) : null
              const r = roomMap.get(a.room_code)
              const inst = instMap.get(a.instructor_id)
              const rows = Math.max(1, Math.round((a.end_min - a.start_min) / slotMin))
              return (
                <div
                  key={a.section_id + '-' + a.day + '-' + i}
                  className={`sched-block ${courseClass(c?.code || '')}`}
                  style={{ minHeight: rows * 30 + 'px' }}
                  title={`${c?.code || ''} · ${c?.name_en || ''}\n${minToHHMM(a.start_min)}–${minToHHMM(a.end_min)}\n${r?.display_name || a.room_code}\n${inst?.name || a.instructor_id}`}
                >
                  <div className="code">{c?.code}</div>
                  <div className="meta">
                    {minToHHMM(a.start_min)}–{minToHHMM(a.end_min)}
                  </div>
                  <div className="meta">{r?.code || a.room_code}</div>
                </div>
              )
            })}
          </div>
        )
      })}
    </>
  )
}

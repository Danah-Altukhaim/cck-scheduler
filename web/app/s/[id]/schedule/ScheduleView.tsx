'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Calendar as CalendarIcon,
  List as ListIcon,
  Filter,
  Search,
  Download,
  Printer,
  X,
  AlertTriangle,
  CheckCircle2,
  CircleSlash,
} from 'lucide-react'
import {
  OPERATING_DAYS,
  DAY_LABEL,
  minToHHMM,
  courseClass,
  type Day,
} from '@/lib/format'
import type {
  Assignment,
  Course,
  Instructor,
  MajorSheet,
  Room,
  Section,
} from '@/lib/data'
import { StaticTabs } from '@/components/ui/Tabs'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { Badge, StatusIcon } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'

export interface ReservedBlock {
  enabled: boolean
  day: string
  startMin: number
  endMin: number
}

export interface ScheduleViewProps {
  scheduleId: string
  rooms: Room[]
  instructors: Instructor[]
  courses: Course[]
  sections: Section[]
  majors: MajorSheet[]
  assignments: Assignment[]
  termLabel: string
  reservedBlock?: ReservedBlock
}

type ViewMode = 'calendar' | 'list'
type ColorBy = 'department' | 'instructor' | 'room' | 'language'
type GroupBy = 'none' | 'cohort' | 'instructor' | 'room' | 'course'

interface FilterState {
  search: string
  rooms: string[]
  instructors: string[]
  depts: string[]
  bucket: 'all' | 'morning' | 'midday' | 'evening'
  status: 'all' | 'placed' | 'unplaced'
  colorBy: ColorBy
  density: 'cozy' | 'compact'
  view: ViewMode
  groupBy: GroupBy
}

const DEFAULT_FILTERS: FilterState = {
  search: '',
  rooms: [],
  instructors: [],
  depts: [],
  bucket: 'all',
  status: 'all',
  colorBy: 'department',
  density: 'cozy',
  view: 'calendar',
  groupBy: 'none',
}

// Stable color palette for color-by ramp.
const COLOR_RAMP = [
  '#1f5fb2', '#b21f24', '#1f8b6b', '#b26a1f', '#6b1fb2',
  '#1c8c8c', '#a86a08', '#5a5a5a', '#006341', '#76b82a',
  '#0f4a9e', '#923a3e', '#256b4a', '#a85d20', '#5d2a8c',
]

function hashStr(str: string): number {
  let h = 5381
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return Math.abs(h)
}
function rampColor(key: string): string {
  return COLOR_RAMP[hashStr(key) % COLOR_RAMP.length]!
}

export function ScheduleView(props: ScheduleViewProps) {
  const { rooms, instructors, courses, sections, majors, assignments, scheduleId, reservedBlock } = props
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS)
  const [openAssignment, setOpenAssignment] = useState<Assignment | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // hydrate from URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const u = new URL(window.location.href)
    const next: Partial<FilterState> = {}
    if (u.searchParams.get('q')) next.search = u.searchParams.get('q')!
    if (u.searchParams.get('view')) next.view = u.searchParams.get('view') as ViewMode
    if (u.searchParams.get('group')) next.groupBy = u.searchParams.get('group') as GroupBy
    if (u.searchParams.get('color')) next.colorBy = u.searchParams.get('color') as ColorBy
    if (u.searchParams.get('density')) next.density = u.searchParams.get('density') as 'cozy' | 'compact'
    if (u.searchParams.get('bucket')) next.bucket = u.searchParams.get('bucket') as FilterState['bucket']
    if (u.searchParams.get('status')) next.status = u.searchParams.get('status') as FilterState['status']
    if (u.searchParams.get('rooms')) next.rooms = u.searchParams.get('rooms')!.split(',').filter(Boolean)
    if (u.searchParams.get('instructors')) next.instructors = u.searchParams.get('instructors')!.split(',').filter(Boolean)
    if (u.searchParams.get('depts')) next.depts = u.searchParams.get('depts')!.split(',').filter(Boolean)
    if (Object.keys(next).length) setFilters((f) => ({ ...f, ...next }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // persist to URL (debounced via batching)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const u = new URL(window.location.href)
    const set = (k: string, v: string | null) => {
      if (v) u.searchParams.set(k, v)
      else u.searchParams.delete(k)
    }
    set('q', filters.search.trim() || null)
    set('view', filters.view === 'calendar' ? null : filters.view)
    set('group', filters.groupBy === 'none' ? null : filters.groupBy)
    set('color', filters.colorBy === 'department' ? null : filters.colorBy)
    set('density', filters.density === 'cozy' ? null : filters.density)
    set('bucket', filters.bucket === 'all' ? null : filters.bucket)
    set('status', filters.status === 'all' ? null : filters.status)
    set('rooms', filters.rooms.length ? filters.rooms.join(',') : null)
    set('instructors', filters.instructors.length ? filters.instructors.join(',') : null)
    set('depts', filters.depts.length ? filters.depts.join(',') : null)
    window.history.replaceState(null, '', u.toString())
  }, [filters])

  const sectionMap = useMemo(() => new Map(sections.map((s) => [s.id, s])), [sections])
  const courseMap = useMemo(() => new Map(courses.map((c) => [c.code, c])), [courses])
  const instMap = useMemo(() => new Map(instructors.map((i) => [i.id, i])), [instructors])
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.code, r])), [rooms])
  const depts = useMemo(
    () => Array.from(new Set(instructors.map((i) => i.department).filter(Boolean))).sort(),
    [instructors],
  )

  // section_id → [{ key, label }] for cohort grouping. A section can belong to
  // multiple (program, semester) cohorts (shared/elective courses) and will
  // appear in each.
  const cohortsBySection = useMemo(() => {
    const sectionsByCourse = new Map<string, Section[]>()
    for (const s of sections) {
      const list = sectionsByCourse.get(s.course_code) ?? []
      list.push(s)
      sectionsByCourse.set(s.course_code, list)
    }
    const map = new Map<string, { key: string; label: string }[]>()
    for (const m of majors) {
      for (const block of m.semester_blocks ?? []) {
        const key = `${m.program_code}:S${block.semester}`
        const label = `${m.name} — Semester ${block.semester}`
        for (const code of block.required_courses ?? []) {
          const matches = sectionsByCourse.get(code) ?? []
          for (const sec of matches) {
            const existing = map.get(sec.id) ?? []
            if (!existing.some((e) => e.key === key)) existing.push({ key, label })
            map.set(sec.id, existing)
          }
        }
      }
    }
    return map
  }, [majors, sections])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    const wantRooms = new Set(filters.rooms)
    const wantInst = new Set(filters.instructors)
    const wantDepts = new Set(filters.depts)
    return assignments.filter((a) => {
      if (wantRooms.size && !wantRooms.has(a.room_code)) return false
      if (wantInst.size && !wantInst.has(a.instructor_id)) return false
      if (wantDepts.size) {
        const dept = instMap.get(a.instructor_id)?.department
        if (!dept || !wantDepts.has(dept)) return false
      }
      const sec = sectionMap.get(a.section_id)
      if (filters.bucket !== 'all' && sec?.time_bucket !== filters.bucket) return false
      if (q) {
        const c = sec ? courseMap.get(sec.course_code) : null
        const inst = instMap.get(a.instructor_id)
        const r = roomMap.get(a.room_code)
        const hay = [c?.code, c?.name_en, inst?.name, r?.display_name, r?.code, a.room_code, a.instructor_id]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [assignments, filters, sectionMap, courseMap, instMap, roomMap])

  // unplaced sections
  const placedIds = useMemo(() => new Set(assignments.map((a) => a.section_id)), [assignments])
  const unplaced = useMemo(() => sections.filter((s) => !placedIds.has(s.id)), [sections, placedIds])

  const placedTotal = placedIds.size
  const total = sections.length
  const allPlaced = total > 0 && placedTotal === total

  const colorOf = useCallback(
    (a: Assignment): string => {
      const sec = sectionMap.get(a.section_id)
      if (filters.colorBy === 'department') {
        const dept = instMap.get(a.instructor_id)?.department ?? 'unknown'
        return rampColor(dept)
      }
      if (filters.colorBy === 'instructor') return rampColor(a.instructor_id)
      if (filters.colorBy === 'room') return rampColor(a.room_code)
      if (filters.colorBy === 'language') return rampColor(sec?.language ?? '?')
      return 'var(--accent)'
    },
    [filters.colorBy, sectionMap, instMap],
  )

  const colorLegend = useMemo(() => {
    const keys = new Set<string>()
    for (const a of filtered) {
      if (filters.colorBy === 'department')
        keys.add(instMap.get(a.instructor_id)?.department ?? 'unknown')
      else if (filters.colorBy === 'instructor')
        keys.add(instMap.get(a.instructor_id)?.name ?? a.instructor_id)
      else if (filters.colorBy === 'room')
        keys.add(roomMap.get(a.room_code)?.display_name ?? a.room_code)
      else if (filters.colorBy === 'language')
        keys.add(sectionMap.get(a.section_id)?.language ?? '?')
    }
    return Array.from(keys)
      .sort()
      .map((k) => ({ key: k, color: rampColor(k) }))
  }, [filtered, filters.colorBy, instMap, roomMap, sectionMap])

  // Returns the group buckets an assignment belongs to. May be >1 (cohort case)
  // or empty (cohort with no major linkage → placed in "Other").
  const groupsForAssignment = useCallback(
    (a: Assignment): { key: string; label: string }[] => {
      if (filters.groupBy === 'cohort') {
        const list = cohortsBySection.get(a.section_id)
        if (list && list.length) return list
        return [{ key: '__other', label: 'Other (no cohort)' }]
      }
      if (filters.groupBy === 'instructor') {
        const i = instMap.get(a.instructor_id)
        return [{ key: a.instructor_id, label: i?.name ?? a.instructor_id }]
      }
      if (filters.groupBy === 'room') {
        const r = roomMap.get(a.room_code)
        return [{ key: a.room_code, label: r?.display_name ?? a.room_code }]
      }
      if (filters.groupBy === 'course') {
        const sec = sectionMap.get(a.section_id)
        const c = sec ? courseMap.get(sec.course_code) : null
        const key = c?.code ?? sec?.course_code ?? a.section_id
        const label = c ? `${c.code} — ${c.name_en}` : key
        return [{ key, label }]
      }
      return [{ key: '__all', label: '' }]
    },
    [filters.groupBy, cohortsBySection, instMap, roomMap, sectionMap, courseMap],
  )

  // Partition filtered assignments into groups (ordered by label).
  const grouped = useMemo(() => {
    if (filters.groupBy === 'none' || filters.view !== 'calendar') return null
    const buckets = new Map<string, { label: string; items: Assignment[] }>()
    const source = filters.status === 'unplaced' ? [] : filtered
    for (const a of source) {
      for (const g of groupsForAssignment(a)) {
        const b = buckets.get(g.key) ?? { label: g.label, items: [] }
        b.items.push(a)
        buckets.set(g.key, b)
      }
    }
    return Array.from(buckets.entries())
      .map(([key, v]) => ({ key, label: v.label, items: v.items }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [filters.groupBy, filters.view, filters.status, filtered, groupsForAssignment])

  const activeFilterCount =
    filters.rooms.length + filters.instructors.length + filters.depts.length +
    (filters.bucket === 'all' ? 0 : 1) + (filters.status === 'all' ? 0 : 1)

  function update<K extends keyof FilterState>(k: K, v: FilterState[K]) {
    setFilters((f) => ({ ...f, [k]: v }))
  }

  function resetFilters() {
    setFilters({
      ...DEFAULT_FILTERS,
      view: filters.view,
      colorBy: filters.colorBy,
      density: filters.density,
      groupBy: filters.groupBy,
    })
  }

  return (
    <>
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Schedule</div>
          <h1>{props.termLabel}</h1>
          <div className="sub">
            {total === 0 ? (
              'No schedule yet — run the solver from the Generate page to produce one.'
            ) : (
              <>
                <span style={{ fontWeight: 600, color: 'var(--ink)' }}>
                  {placedTotal} of {total} sections placed
                </span>
                {!allPlaced && (
                  <>
                    {' · '}
                    <span style={{ color: 'var(--warn)' }}>
                      {total - placedTotal} unplaced
                    </span>
                  </>
                )}
                {' · '}
                <span>{filtered.length} visible after filters</span>
              </>
            )}
          </div>
        </div>
        <div className="page-actions">
          <Button
            variant="secondary"
            size="md"
            icon={<Download size={14} />}
            onClick={() => {
              window.location.href = `/api/schedules/${scheduleId}/export`
            }}
          >
            Export
          </Button>
          <Button
            variant="secondary"
            size="md"
            icon={<Printer size={14} />}
            onClick={() => window.print()}
          >
            Print
          </Button>
        </div>
      </header>

      {/* View tabs + color/density controls */}
      <div className="flex items-center gap-3 flex-wrap" style={{ marginBottom: 16 }}>
        <StaticTabs<ViewMode>
          value={filters.view}
          onChange={(v) => update('view', v)}
          items={[
            { value: 'calendar', label: 'Calendar', icon: <CalendarIcon size={13} /> },
            { value: 'list', label: 'List', icon: <ListIcon size={13} /> },
          ]}
        />
        <div className="ml-auto flex items-center gap-3 flex-wrap">
          {filters.view === 'calendar' && (
            <label className="flex items-center gap-2">
              <span className="text-label">Group by</span>
              <select
                className="select"
                style={{ width: 'auto', minWidth: 120 }}
                value={filters.groupBy}
                onChange={(e) => update('groupBy', e.target.value as GroupBy)}
              >
                <option value="none">None</option>
                <option value="cohort">Cohort</option>
                <option value="instructor">Instructor</option>
                <option value="room">Room</option>
                <option value="course">Course</option>
              </select>
            </label>
          )}
          <label className="flex items-center gap-2">
            <span className="text-label">Color by</span>
            <select
              className="select"
              style={{ width: 'auto', minWidth: 120 }}
              value={filters.colorBy}
              onChange={(e) => update('colorBy', e.target.value as ColorBy)}
            >
              <option value="department">Department</option>
              <option value="instructor">Instructor</option>
              <option value="room">Room</option>
              <option value="language">Language</option>
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="text-label">Density</span>
            <select
              className="select"
              style={{ width: 'auto', minWidth: 100 }}
              value={filters.density}
              onChange={(e) => update('density', e.target.value as 'cozy' | 'compact')}
            >
              <option value="cozy">Cozy</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </div>
      </div>

      {/* Filter bar */}
      <div className="card-flat" style={{ padding: '10px 12px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
          <input
            type="search"
            className="input"
            placeholder="Search course, instructor, room…"
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            style={{ paddingLeft: 28 }}
          />
        </div>
        <Button
          variant={showFilters ? 'secondary' : 'ghost'}
          size="sm"
          icon={<Filter size={13} />}
          onClick={() => setShowFilters((s) => !s)}
        >
          Filters
          {activeFilterCount > 0 && (
            <span className="badge solid" style={{ marginLeft: 4, padding: '1px 6px' }}>
              {activeFilterCount}
            </span>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {showFilters && (
        <div className="card-flat" style={{ padding: 14, marginBottom: 16 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <FilterChips
              label="Department"
              options={depts.map((d) => ({ value: d, label: d }))}
              selected={filters.depts}
              onChange={(v) => update('depts', v)}
            />
            <FilterChips
              label="Time bucket"
              options={[
                { value: 'morning', label: 'Morning' },
                { value: 'midday', label: 'Midday' },
                { value: 'evening', label: 'Evening' },
              ]}
              selected={filters.bucket === 'all' ? [] : [filters.bucket]}
              onChange={(v) => update('bucket', v[0] as FilterState['bucket'] ?? 'all')}
              single
            />
            <FilterChips
              label="Status"
              options={[
                { value: 'placed', label: 'Placed' },
                { value: 'unplaced', label: 'Unplaced' },
              ]}
              selected={filters.status === 'all' ? [] : [filters.status]}
              onChange={(v) => update('status', v[0] as FilterState['status'] ?? 'all')}
              single
            />
          </div>
        </div>
      )}

      {/* Legend (when 2+ colors active) */}
      {colorLegend.length > 1 && (
        <div className="flex items-center gap-3 flex-wrap mb-3 text-caption">
          <span className="text-label">Legend</span>
          {colorLegend.slice(0, 14).map((l) => (
            <span key={l.key} className="flex items-center gap-1.5">
              <span style={{ width: 10, height: 10, borderRadius: 2, background: l.color, display: 'inline-block' }} />
              <span>{l.key}</span>
            </span>
          ))}
          {colorLegend.length > 14 && <span className="text-caption">+ {colorLegend.length - 14} more</span>}
        </div>
      )}

      {/* Unplaced banner */}
      {(filters.status === 'all' || filters.status === 'unplaced') && unplaced.length > 0 && (
        <div
          className="card-flat flex items-center gap-3"
          style={{
            padding: '10px 14px',
            marginBottom: 14,
            borderColor: 'var(--warn-strong)',
            background: 'var(--warn-soft)',
          }}
        >
          <AlertTriangle size={16} color="var(--warn)" />
          <span className="text-body-sm" style={{ fontWeight: 500 }}>
            <strong>{unplaced.length}</strong> section{unplaced.length === 1 ? '' : 's'} could not be placed.
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => update('view', 'list')}
            style={{ marginLeft: 'auto' }}
          >
            See unplaced
          </Button>
        </div>
      )}

      {/* Main view */}
      {total === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CalendarIcon size={22} />}
            title="No schedule yet"
            description="Generate the schedule from the Generate page to see assignments here."
            actions={
              <a href={`/s/${scheduleId}/generate`} className="btn btn-primary">
                Go to Generate →
              </a>
            }
          />
        </div>
      ) : filters.view === 'calendar' ? (
        grouped ? (
          grouped.length === 0 ? (
            <div className="card">
              <EmptyState title="Nothing to show" description="No assignments match the current filters." />
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {grouped.map((g) => (
                <section key={g.key}>
                  <div
                    className="flex items-baseline justify-between"
                    style={{ marginBottom: 8 }}
                  >
                    <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{g.label}</h2>
                    <span className="text-caption">{g.items.length} session{g.items.length === 1 ? '' : 's'}</span>
                  </div>
                  <CalendarView
                    assignments={g.items}
                    sectionMap={sectionMap}
                    courseMap={courseMap}
                    roomMap={roomMap}
                    instMap={instMap}
                    colorOf={colorOf}
                    density={filters.density}
                    onOpen={setOpenAssignment}
                    reservedBlock={reservedBlock}
                  />
                </section>
              ))}
            </div>
          )
        ) : (
          <CalendarView
            assignments={filters.status === 'unplaced' ? [] : filtered}
            sectionMap={sectionMap}
            courseMap={courseMap}
            roomMap={roomMap}
            instMap={instMap}
            colorOf={colorOf}
            density={filters.density}
            onOpen={setOpenAssignment}
            reservedBlock={reservedBlock}
          />
        )
      ) : (
        <ListView
          assignments={filters.status === 'unplaced' ? [] : filtered}
          unplaced={filters.status === 'placed' ? [] : unplaced}
          sectionMap={sectionMap}
          courseMap={courseMap}
          roomMap={roomMap}
          instMap={instMap}
          onOpen={setOpenAssignment}
        />
      )}

      {/* Section detail */}
      <Sheet
        open={!!openAssignment}
        onClose={() => setOpenAssignment(null)}
        title={(() => {
          if (!openAssignment) return ''
          const sec = sectionMap.get(openAssignment.section_id)
          const c = sec ? courseMap.get(sec.course_code) : null
          return c?.code ?? openAssignment.section_id
        })()}
        description={(() => {
          if (!openAssignment) return ''
          const sec = sectionMap.get(openAssignment.section_id)
          const c = sec ? courseMap.get(sec.course_code) : null
          return c?.name_en
        })()}
      >
        {openAssignment && (
          <SectionDetail
            a={openAssignment}
            section={sectionMap.get(openAssignment.section_id)}
            course={(() => {
              const sec = sectionMap.get(openAssignment.section_id)
              return sec ? courseMap.get(sec.course_code) : undefined
            })()}
            room={roomMap.get(openAssignment.room_code)}
            instructor={instMap.get(openAssignment.instructor_id)}
            allAssignments={assignments.filter((a) => a.section_id === openAssignment.section_id)}
          />
        )}
      </Sheet>
    </>
  )
}

// ---------------------------------------------------------------------------
// Filter chips

function FilterChips({
  label,
  options,
  selected,
  onChange,
  single,
}: {
  label: string
  options: { value: string; label: string }[]
  selected: string[]
  onChange: (next: string[]) => void
  single?: boolean
}) {
  function toggle(v: string) {
    if (single) {
      onChange(selected.includes(v) ? [] : [v])
    } else {
      onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
    }
  }
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-label">{label}</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => {
          const on = selected.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`badge ${on ? 'solid' : 'muted'}`}
              style={{ cursor: 'pointer', userSelect: 'none' }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Calendar view (the timetable grid)

// Compute side-by-side lanes for overlapping assignments within a single day.
// Returns one entry per input assignment (in original order) with the lane it
// occupies and the total lane count for its overlap cluster.
function computeLanes(items: Assignment[]): { lane: number; lanes: number }[] {
  const n = items.length
  if (n === 0) return []
  const idx = items.map((_, i) => i).sort((x, y) => {
    const dx = items[x]!.start_min - items[y]!.start_min
    return dx !== 0 ? dx : items[y]!.end_min - items[x]!.end_min
  })
  const result: { lane: number; lanes: number }[] = new Array(n)
  let cluster: number[] = []
  let clusterEnd = -1
  let laneEnds: number[] = []
  const flushCluster = () => {
    const lanes = laneEnds.length
    for (const i of cluster) result[i] = { lane: result[i]!.lane, lanes }
    cluster = []
    laneEnds = []
    clusterEnd = -1
  }
  for (const i of idx) {
    const a = items[i]!
    if (a.start_min >= clusterEnd && cluster.length) flushCluster()
    let lane = laneEnds.findIndex((end) => end <= a.start_min)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(a.end_min)
    } else {
      laneEnds[lane] = a.end_min
    }
    result[i] = { lane, lanes: 0 }
    cluster.push(i)
    clusterEnd = Math.max(clusterEnd, a.end_min)
  }
  if (cluster.length) flushCluster()
  return result
}

function CalendarView({
  assignments,
  sectionMap,
  courseMap,
  roomMap,
  instMap,
  colorOf,
  density,
  onOpen,
  reservedBlock,
}: {
  assignments: Assignment[]
  sectionMap: Map<string, Section>
  courseMap: Map<string, Course>
  roomMap: Map<string, Room>
  instMap: Map<string, Instructor>
  colorOf: (a: Assignment) => string
  density: 'cozy' | 'compact'
  onOpen: (a: Assignment) => void
  reservedBlock?: ReservedBlock
}) {
  const startMin = 8 * 60
  const endMin = 20 * 60
  const totalMin = endMin - startMin
  const pxPerMin = density === 'compact' ? 24 / 30 : 32 / 30
  const bodyHeight = totalMin * pxPerMin
  const hourHeight = 60 * pxPerMin

  if (assignments.length === 0) {
    return (
      <div className="card">
        <EmptyState title="Nothing to show" description="No assignments match the current filters." />
      </div>
    )
  }

  // Group assignments by day, filter outside the visible window.
  const byDay = new Map<Day, Assignment[]>()
  for (const a of assignments) {
    if (!OPERATING_DAYS.includes(a.day)) continue
    if (a.end_min <= startMin || a.start_min >= endMin) continue
    if (!byDay.has(a.day)) byDay.set(a.day, [])
    byDay.get(a.day)!.push(a)
  }

  const totalHours = Math.ceil(totalMin / 60)

  return (
    <div className="card-flat" style={{ overflow: 'auto' }}>
      <div
        className="sched"
        style={{
          gridTemplateColumns: `64px repeat(${OPERATING_DAYS.length}, minmax(200px, 1fr))`,
          gridTemplateRows: 'auto 1fr',
        }}
      >
        <div className="hdr" />
        {OPERATING_DAYS.map((d) => (
          <div key={d} className="hdr">
            {DAY_LABEL[d]}
          </div>
        ))}

        {/* Time gutter */}
        <div className="time" style={{ position: 'relative', height: bodyHeight, padding: 0 }}>
          {Array.from({ length: totalHours + 1 }).map((_, h) => {
            const m = startMin + h * 60
            if (m > endMin) return null
            const top = h * hourHeight
            return (
              <div
                key={h}
                style={{
                  position: 'absolute',
                  top,
                  right: 6,
                  transform: 'translateY(-50%)',
                  fontSize: 11,
                  color: 'var(--muted)',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {minToHHMM(m)}
              </div>
            )
          })}
        </div>

        {/* Day columns */}
        {OPERATING_DAYS.map((d) => {
          const list = byDay.get(d) ?? []
          const lanes = computeLanes(list)
          const showReserved =
            reservedBlock?.enabled &&
            reservedBlock.day === d &&
            reservedBlock.endMin > startMin &&
            reservedBlock.startMin < endMin
          return (
            <div
              key={d}
              className="cell"
              style={{ position: 'relative', height: bodyHeight, padding: 0 }}
            >
              {/* Hour grid lines */}
              {Array.from({ length: totalHours + 1 }).map((_, h) => (
                <div
                  key={h}
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: h * hourHeight,
                    borderTop:
                      h === 0 || h === totalHours
                        ? 'none'
                        : '1px solid var(--line-soft)',
                  }}
                />
              ))}
              {/* Reserved-block overlay */}
              {showReserved && (
                <div
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: (Math.max(reservedBlock!.startMin, startMin) - startMin) * pxPerMin,
                    height:
                      (Math.min(reservedBlock!.endMin, endMin) -
                        Math.max(reservedBlock!.startMin, startMin)) *
                      pxPerMin,
                    background:
                      'repeating-linear-gradient(135deg, rgba(120,120,120,0.10) 0 8px, rgba(120,120,120,0.18) 8px 16px)',
                    borderTop: '1px solid rgba(120,120,120,0.35)',
                    borderBottom: '1px solid rgba(120,120,120,0.35)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    zIndex: 1,
                  }}
                  title={`Reserved: ${minToHHMM(reservedBlock!.startMin)}–${minToHHMM(reservedBlock!.endMin)}`}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--muted)',
                      background: 'var(--surface)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    Reserved
                  </span>
                </div>
              )}
              {list.map((a, i) => {
                const sec = sectionMap.get(a.section_id)
                const c = sec ? courseMap.get(sec.course_code) : null
                const r = roomMap.get(a.room_code)
                const inst = instMap.get(a.instructor_id)
                const top = (Math.max(a.start_min, startMin) - startMin) * pxPerMin
                const height = (Math.min(a.end_min, endMin) - Math.max(a.start_min, startMin)) * pxPerMin
                const { lane, lanes: laneCount } = lanes[i]!
                const widthPct = 100 / Math.max(1, laneCount)
                const leftPct = lane * widthPct
                const bg = colorOf(a)
                return (
                  <button
                    type="button"
                    key={a.section_id + '-' + a.day + '-' + i}
                    className={`sched-block ${courseClass(c?.code || '')}`}
                    onClick={() => onOpen(a)}
                    style={{
                      position: 'absolute',
                      top,
                      height: Math.max(height - 2, 12),
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      background: bg,
                      border: 'none',
                      textAlign: 'left',
                      overflow: 'hidden',
                    }}
                    title={`${c?.code || ''} · ${c?.name_en || ''}\n${minToHHMM(a.start_min)}–${minToHHMM(a.end_min)}\n${r?.display_name || a.room_code}\n${inst?.name || a.instructor_id}`}
                  >
                    <div className="code">{c?.code}</div>
                    {height >= 28 && (
                      <div className="meta">
                        {minToHHMM(a.start_min)}–{minToHHMM(a.end_min)}
                      </div>
                    )}
                    {height >= 44 && <div className="meta">{r?.code || a.room_code}</div>}
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// List view

function ListView({
  assignments,
  unplaced,
  sectionMap,
  courseMap,
  roomMap,
  instMap,
  onOpen,
}: {
  assignments: Assignment[]
  unplaced: Section[]
  sectionMap: Map<string, Section>
  courseMap: Map<string, Course>
  roomMap: Map<string, Room>
  instMap: Map<string, Instructor>
  onOpen: (a: Assignment) => void
}) {
  // group by section
  const bySection = new Map<string, Assignment[]>()
  for (const a of assignments) {
    if (!bySection.has(a.section_id)) bySection.set(a.section_id, [])
    bySection.get(a.section_id)!.push(a)
  }
  const sortedSections = Array.from(bySection.keys()).sort((a, b) => {
    const ca = courseMap.get(sectionMap.get(a)?.course_code ?? '')
    const cb = courseMap.get(sectionMap.get(b)?.course_code ?? '')
    return (ca?.code ?? '').localeCompare(cb?.code ?? '')
  })

  if (sortedSections.length === 0 && unplaced.length === 0) {
    return (
      <div className="card">
        <EmptyState title="No assignments" description="No sections match the current filters." />
      </div>
    )
  }

  return (
    <div className="card-flat" style={{ overflow: 'auto' }}>
      <table className="cck">
        <thead>
          <tr>
            <th>Status</th>
            <th>Course</th>
            <th>Section</th>
            <th>Lang</th>
            <th>Days & time</th>
            <th>Room</th>
            <th>Instructor</th>
          </tr>
        </thead>
        <tbody>
          {sortedSections.map((sid) => {
            const list = bySection.get(sid)!
            const sec = sectionMap.get(sid)
            const c = sec ? courseMap.get(sec.course_code) : null
            const r = roomMap.get(list[0]!.room_code)
            const inst = instMap.get(list[0]!.instructor_id)
            const days = Array.from(new Set(list.map((a) => a.day)))
              .sort((a, b) => OPERATING_DAYS.indexOf(a as Day) - OPERATING_DAYS.indexOf(b as Day))
              .map((d) => DAY_LABEL[d as Day])
              .join(' / ')
            return (
              <tr key={sid} style={{ cursor: 'pointer' }} onClick={() => onOpen(list[0]!)}>
                <td>
                  <StatusIcon status="ok" />
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c?.code}</div>
                  <div className="text-caption">{c?.name_en}</div>
                </td>
                <td className="text-mono" style={{ fontSize: 12 }}>
                  {sid}
                </td>
                <td>
                  <Badge tone="muted">{sec?.language ?? '—'}</Badge>
                </td>
                <td className="tabular">
                  {days} · {minToHHMM(list[0]!.start_min)}–{minToHHMM(list[0]!.end_min)}
                </td>
                <td>{r?.display_name ?? list[0]!.room_code}</td>
                <td>{inst?.name ?? list[0]!.instructor_id}</td>
              </tr>
            )
          })}
          {unplaced.map((sec) => {
            const c = courseMap.get(sec.course_code)
            return (
              <tr key={sec.id} style={{ background: 'var(--danger-soft)' }}>
                <td>
                  <StatusIcon status="error" />
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{c?.code}</div>
                  <div className="text-caption">{c?.name_en}</div>
                </td>
                <td className="text-mono" style={{ fontSize: 12 }}>{sec.id}</td>
                <td><Badge tone="muted">{sec.language}</Badge></td>
                <td colSpan={3}>
                  <Badge tone="red">
                    <CircleSlash size={11} /> Unplaced
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section detail

function SectionDetail({
  a,
  section,
  course,
  room,
  instructor,
  allAssignments,
}: {
  a: Assignment
  section?: Section
  course?: Course
  room?: Room
  instructor?: Instructor
  allAssignments: Assignment[]
}) {
  const days = Array.from(new Set(allAssignments.map((x) => x.day)))
    .sort((x, y) => OPERATING_DAYS.indexOf(x as Day) - OPERATING_DAYS.indexOf(y as Day))
    .map((d) => DAY_LABEL[d as Day])
    .join(' / ')
  return (
    <div className="flex flex-col gap-4">
      <Row label="Section ID" value={<span className="text-mono">{a.section_id}</span>} />
      <Row label="Course" value={course ? `${course.code} — ${course.name_en}` : a.section_id} />
      <Row label="Language" value={section?.language ?? '—'} />
      <Row label="Enrollment cap" value={section?.enrollment_cap ?? '—'} />
      <Row label="Days" value={days} />
      <Row label="Time" value={`${minToHHMM(a.start_min)}–${minToHHMM(a.end_min)} (${a.end_min - a.start_min} min)`} />
      <Row label="Pattern" value={section?.pattern ?? '—'} />
      <Row label="Room" value={room ? `${room.display_name} (cap ${room.capacity})` : a.room_code} />
      <Row label="Instructor" value={instructor ? `${instructor.name} (${instructor.rank}, ${instructor.department})` : a.instructor_id} />
      <Row label="Pinned" value={a.pinned ? 'Yes (manual / independent)' : 'No (solver-placed)'} />
      <Row label="Source" value={a.source} />
      <div className="divider" />
      <div className="text-caption" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <CheckCircle2 size={14} color="var(--success)" />
        Placement satisfies all hard constraints.
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-3 text-body-sm" style={{ alignItems: 'center' }}>
      <div className="text-label">{label}</div>
      <div style={{ gridColumn: 'span 2' }}>{value}</div>
    </div>
  )
}

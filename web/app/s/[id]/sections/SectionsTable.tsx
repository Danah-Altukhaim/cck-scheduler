'use client'

import { useMemo } from 'react'
import type { Assignment, Course, Instructor, Section } from '@/lib/data'
import { DAY_LABEL, OPERATING_DAYS, minToHHMM, type Day } from '@/lib/format'
import { Badge, DataTable, StatusIcon, type Column } from '@/components/ui'

interface Row {
  section: Section
  course?: Course
  placed: boolean
  days: string
  time: string
  room: string
  inst: string
  ass?: Assignment
}

export function SectionsTable({
  sections,
  assignments,
  courses,
  instructors,
}: {
  sections: Section[]
  assignments: Assignment[]
  courses: Course[]
  instructors: Instructor[]
}) {
  const rows = useMemo<Row[]>(() => {
    const byId = new Map<string, Assignment[]>()
    for (const a of assignments) {
      if (!byId.has(a.section_id)) byId.set(a.section_id, [])
      byId.get(a.section_id)!.push(a)
    }
    const courseMap = new Map(courses.map((c) => [c.code, c]))
    const instMap = new Map(instructors.map((i) => [i.id, i]))
    return sections.map((s) => {
      const list = byId.get(s.id)
      const placed = !!list
      const days = list
        ? list
            .map((a) => a.day)
            .sort((a, b) => OPERATING_DAYS.indexOf(a as Day) - OPERATING_DAYS.indexOf(b as Day))
            .map((d) => DAY_LABEL[d as Day])
            .join(' / ')
        : '—'
      return {
        section: s,
        course: courseMap.get(s.course_code),
        placed,
        days,
        time: list ? `${minToHHMM(list[0]!.start_min)}–${minToHHMM(list[0]!.end_min)}` : '—',
        room: list?.[0]?.room_code ?? '—',
        inst: list ? instMap.get(list[0]!.instructor_id)?.name ?? list[0]!.instructor_id : '—',
        ass: list?.[0],
      }
    })
  }, [sections, assignments, courses, instructors])

  const columns: Column<Row>[] = [
    {
      key: 'status',
      header: 'Status',
      width: 80,
      sortable: true,
      accessor: (r) => (r.placed ? 0 : 1),
      render: (r) => (
        <span className="flex items-center gap-2">
          <StatusIcon status={r.placed ? 'ok' : 'error'} />
          <span className="text-caption">{r.placed ? 'placed' : 'unplaced'}</span>
        </span>
      ),
    },
    {
      key: 'id',
      header: 'Section ID',
      sortable: true,
      mono: true,
      accessor: (r) => r.section.id,
      render: (r) => <span className="text-mono">{r.section.id}</span>,
    },
    {
      key: 'course',
      header: 'Course',
      sortable: true,
      accessor: (r) => r.section.course_code,
      render: (r) => (
        <div>
          <div style={{ fontWeight: 600 }}>{r.section.course_code}</div>
          <div className="text-caption">{r.course?.name_en}</div>
        </div>
      ),
    },
    {
      key: 'lang',
      header: 'Lang',
      sortable: true,
      width: 80,
      accessor: (r) => r.section.language,
      render: (r) => <Badge tone="muted">{r.section.language}</Badge>,
    },
    {
      key: 'bucket',
      header: 'Bucket',
      sortable: true,
      width: 100,
      accessor: (r) => r.section.time_bucket,
      render: (r) => <Badge tone="muted">{r.section.time_bucket}</Badge>,
    },
    {
      key: 'cap',
      header: 'Cap',
      sortable: true,
      width: 70,
      align: 'right',
      accessor: (r) => r.section.enrollment_cap,
    },
    { key: 'days', header: 'Days', sortable: true, accessor: (r) => r.days },
    {
      key: 'time',
      header: 'Time',
      sortable: true,
      accessor: (r) => (r.ass ? r.ass.start_min : Infinity),
      render: (r) => <span className="tabular">{r.time}</span>,
    },
    { key: 'room', header: 'Room', sortable: true, accessor: (r) => r.room },
    { key: 'inst', header: 'Instructor', sortable: true, accessor: (r) => r.inst },
  ]

  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(r) => r.section.id}
      storageKey="sections-table"
      defaultSortKey="status"
    />
  )
}

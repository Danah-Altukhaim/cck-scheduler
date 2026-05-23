'use client'

import { useMemo, useState } from 'react'
import { EntityEditor, type FieldSpec } from '@/components/EntityEditor'

type Row = Record<string, unknown>

interface Props {
  scheduleId: string
  fields: FieldSpec[]
  initialRows: Row[]
}

type Filter = 'all' | 'lecture' | 'lab' | 'lecture+lab'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'lecture', label: 'Lectures' },
  { key: 'lab', label: 'Labs' },
  { key: 'lecture+lab', label: 'Lecture + lab (CP / IAWD)' },
]

// Client-side wrapper around EntityEditor that adds a Lecture / Lab tab filter
// and a contextual note for the CP / IAWD pattern.
export function CoursesView({ scheduleId, fields, initialRows }: Props) {
  const [filter, setFilter] = useState<Filter>('all')

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: initialRows.length, lecture: 0, lab: 0, 'lecture+lab': 0 }
    for (const r of initialRows) {
      const t = r['type']
      if (t === 'lecture' || t === 'lab' || t === 'lecture+lab') c[t]++
    }
    return c
  }, [initialRows])

  const rows = useMemo(() => {
    if (filter === 'all') return initialRows
    return initialRows.filter((r) => r['type'] === filter)
  }, [initialRows, filter])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-cck-muted">Show:</span>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={
              filter === f.key
                ? 'badge red'
                : 'badge muted hover:bg-cck-line-soft transition-colors'
            }
            style={{ cursor: 'pointer', border: 'none' }}
          >
            {f.label} · {counts[f.key]}
          </button>
        ))}
      </div>

      {filter === 'lecture+lab' && (
        <div className="border border-cck-line rounded-md bg-white px-3 py-2 text-sm text-cck-muted">
          <strong className="text-cck-ink">CP and IAWD courses</strong> follow the
          4-credit split: 2 h lecture + 2 h lab. Use{' '}
          <code className="text-xs">type = lecture+lab</code> and{' '}
          <code className="text-xs">lecture_pattern = lab+lecture</code>.
        </div>
      )}

      <EntityEditor
        scheduleId={scheduleId}
        type="courses"
        idField="code"
        title="Courses"
        subtitle="the catalog Stage 1 opens sections from · teaching_hours is optional (defaults to credits)"
        fields={fields}
        initialRows={rows}
      />
    </div>
  )
}

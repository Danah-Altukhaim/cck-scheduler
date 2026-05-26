'use client'

import { useMemo, useState } from 'react'
import { EntityEditor, type FieldSpec } from '@/components/EntityEditor'
import { StaticTabs } from '@/components/ui'

type Row = Record<string, unknown>

interface Props {
  scheduleId: string
  fields: FieldSpec[]
  initialRows: Row[]
}

type Filter = 'all' | 'lecture' | 'lab' | 'lecture+lab'

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
    <div>
      <div style={{ padding: '0 28px', marginTop: -10, marginBottom: 6 }}>
        <StaticTabs<Filter>
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'lecture', label: 'Lectures', count: counts.lecture },
            { value: 'lab', label: 'Labs', count: counts.lab },
            { value: 'lecture+lab', label: 'Lecture + lab (CP / IAWD)', count: counts['lecture+lab'] },
          ]}
        />
      </div>

      {filter === 'lecture+lab' && (
        <div style={{ padding: '0 28px' }}>
          <div
            className="card-flat"
            style={{
              padding: '10px 14px',
              marginTop: 6,
              marginBottom: 12,
              background: 'var(--info-soft)',
              borderColor: 'var(--info-strong)',
            }}
          >
            <span className="text-body-sm">
              <strong>CP and IAWD courses</strong> follow the 4-credit split: 2 h lecture + 2 h lab.
              Use <code className="text-mono">type = lecture+lab</code> and{' '}
              <code className="text-mono">lecture_pattern = lab+lecture</code>.
            </span>
          </div>
        </div>
      )}

      <EntityEditor
        scheduleId={scheduleId}
        type="courses"
        idField="code"
        title="Courses"
        subtitle="catalog Stage 1 opens sections from"
        fields={fields}
        initialRows={rows}
      />
    </div>
  )
}

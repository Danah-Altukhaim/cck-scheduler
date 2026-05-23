'use client'

import { Plus, Trash2 } from 'lucide-react'

interface Win {
  days: string[]
  start_min: number
  end_min: number
}

const DAYS = ['Sa', 'Su', 'M', 'T', 'W', 'Th']

function minToHHMM(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

// Structured editor for an instructor's availability windows — replaces a raw
// JSON field.
export function AvailabilityWindowsEditor({
  value,
  onChange,
}: {
  value: Win[]
  onChange: (v: Win[]) => void
}) {
  const wins = Array.isArray(value) ? value : []

  const update = (i: number, patch: Partial<Win>) =>
    onChange(wins.map((w, idx) => (idx === i ? { ...w, ...patch } : w)))

  return (
    <div className="space-y-2">
      {wins.length === 0 && (
        <div className="text-sm text-cck-muted">
          No availability limits. This instructor can be scheduled any time.
        </div>
      )}
      {wins.map((w, i) => (
        <div key={i} className="border border-cck-line rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2.5">
              {DAYS.map((d) => {
                const on = (w.days ?? []).includes(d)
                return (
                  <label key={d} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={(e) =>
                        update(i, {
                          days: e.target.checked
                            ? [...(w.days ?? []), d]
                            : (w.days ?? []).filter((x) => x !== d),
                        })
                      }
                    />
                    {d}
                  </label>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => onChange(wins.filter((_, idx) => idx !== i))}
              className="text-sm text-cck-muted hover:text-cck-red inline-flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-cck-muted">Available</span>
            <input
              type="time"
              className="border border-cck-line rounded px-2 py-1"
              value={minToHHMM(w.start_min ?? 480)}
              onChange={(e) => update(i, { start_min: hhmmToMin(e.target.value) })}
            />
            <span className="text-cck-muted">to</span>
            <input
              type="time"
              className="border border-cck-line rounded px-2 py-1"
              value={minToHHMM(w.end_min ?? 720)}
              onChange={(e) => update(i, { end_min: hhmmToMin(e.target.value) })}
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...wins, { days: [], start_min: 480, end_min: 720 }])}
        className="text-sm text-cck-red inline-flex items-center gap-1 hover:underline"
      >
        <Plus className="h-4 w-4" /> Add availability window
      </button>
    </div>
  )
}

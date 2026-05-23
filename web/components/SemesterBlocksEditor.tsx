'use client'

import { Plus, Trash2 } from 'lucide-react'
import { ChipInput } from './ChipInput'

interface Block {
  semester: number
  required_courses: string[]
}

// Structured editor for a major's semester blocks — replaces a raw JSON field.
export function SemesterBlocksEditor({
  value,
  onChange,
}: {
  value: Block[]
  onChange: (v: Block[]) => void
}) {
  const blocks = Array.isArray(value) ? value : []

  const update = (i: number, patch: Partial<Block>) =>
    onChange(blocks.map((b, idx) => (idx === i ? { ...b, ...patch } : b)))

  return (
    <div className="space-y-2">
      {blocks.length === 0 && (
        <div className="text-sm text-cck-muted">No semester blocks yet.</div>
      )}
      {blocks.map((b, i) => (
        <div key={i} className="border border-cck-line rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm flex items-center gap-2">
              <span className="text-cck-muted">Semester</span>
              <input
                type="number"
                min={1}
                className="w-16 border border-cck-line rounded px-2 py-1"
                value={b.semester ?? 1}
                onChange={(e) => update(i, { semester: Number(e.target.value) })}
              />
            </label>
            <button
              type="button"
              onClick={() => onChange(blocks.filter((_, idx) => idx !== i))}
              className="text-sm text-cck-muted hover:text-cck-red inline-flex items-center gap-1"
            >
              <Trash2 className="h-3.5 w-3.5" /> Remove
            </button>
          </div>
          <div>
            <div className="text-xs text-cck-muted mb-1">Required courses</div>
            <ChipInput
              value={b.required_courses ?? []}
              onChange={(cs) => update(i, { required_courses: cs })}
              placeholder="type a course code, then Enter"
            />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...blocks, { semester: blocks.length + 1, required_courses: [] }])}
        className="text-sm text-cck-red inline-flex items-center gap-1 hover:underline"
      >
        <Plus className="h-4 w-4" /> Add semester block
      </button>
    </div>
  )
}

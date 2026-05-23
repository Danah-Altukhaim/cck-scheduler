'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

export function ScheduleFilters({
  basePath,
  rooms,
  instructors,
  depts,
}: {
  basePath: string
  rooms: { code: string; display: string }[]
  instructors: { id: string; name: string }[]
  depts: string[]
}) {
  const router = useRouter()
  const params = useSearchParams()

  const update = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString())
      if (!value) next.delete(key)
      else next.set(key, value)
      router.push(`${basePath}${next.toString() ? '?' + next.toString() : ''}`)
    },
    [params, router, basePath],
  )

  return (
    <div className="flex items-center gap-3 text-sm bg-white border border-cck-line rounded-md p-3">
      <label className="text-cck-muted font-medium uppercase text-xs tracking-wider">Filter</label>
      <select
        className="border border-cck-line rounded px-2 py-1 text-sm bg-white"
        value={params.get('room') || ''}
        onChange={(e) => update('room', e.target.value)}
      >
        <option value="">All rooms</option>
        {rooms.map((r) => (
          <option key={r.code} value={r.code}>
            {r.display}
          </option>
        ))}
      </select>
      <select
        className="border border-cck-line rounded px-2 py-1 text-sm bg-white"
        value={params.get('instructor') || ''}
        onChange={(e) => update('instructor', e.target.value)}
      >
        <option value="">All instructors</option>
        {instructors.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
      <select
        className="border border-cck-line rounded px-2 py-1 text-sm bg-white"
        value={params.get('dept') || ''}
        onChange={(e) => update('dept', e.target.value)}
      >
        <option value="">All departments</option>
        {depts.map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>
      {(params.get('room') || params.get('instructor') || params.get('dept')) && (
        <button className="text-cck-green text-xs underline ml-2" onClick={() => router.push(basePath)}>
          Clear
        </button>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, CalendarDays, ArrowRight, CalendarPlus } from 'lucide-react'
import type { ScheduleMeta } from '../lib/schedules'

function fmtDate(ms: number | null): string {
  if (!ms) return 'never'
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function SchedulesList({ initial }: { initial: ScheduleMeta[] }) {
  const [rows, setRows] = useState(initial)
  const [creating, setCreating] = useState(false)
  const [label, setLabel] = useState('')
  const [source, setSource] = useState('base')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function create() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, source }),
      })
      const data = (await res.json()) as { schedule?: ScheduleMeta; error?: string }
      if (!res.ok || !data.schedule) throw new Error(data.error || 'Create failed')
      router.push(`/s/${data.schedule.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed')
      setBusy(false)
    }
  }

  async function rename(s: ScheduleMeta) {
    const next = prompt('Rename schedule', s.label)
    if (!next || !next.trim()) return
    await fetch(`/api/schedules/${s.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: next }),
    })
    setRows((prev) => prev.map((r) => (r.id === s.id ? { ...r, label: next.trim() } : r)))
    router.refresh()
  }

  async function remove(s: ScheduleMeta) {
    if (!confirm(`Delete "${s.label}"? This removes all its data and cannot be undone.`)) return
    await fetch(`/api/schedules/${s.id}`, { method: 'DELETE' })
    setRows((prev) => prev.filter((r) => r.id !== s.id))
    router.refresh()
  }

  return (
    <div className="space-y-7">
      <header className="flex items-end justify-between">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center justify-center"
            style={{ width: 36, height: 36, background: '#006341', color: '#fff', borderRadius: 8, fontWeight: 800, fontSize: 13 }}
          >
            CCK
          </span>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Schedules</h1>
            <p className="text-sm text-cck-muted">
              Each schedule is a project with its own courses, instructors, rooms and rules.
            </p>
          </div>
        </div>
        <button
          onClick={() => {
            setCreating(true)
            setLabel('')
            setSource('base')
            setError(null)
          }}
          disabled={creating}
          className="btn-primary"
        >
          <Plus className="h-4 w-4" /> New schedule
        </button>
      </header>

      {creating && (
        <div className="card p-5 space-y-4">
          <div className="font-semibold text-[15px]">Create a new schedule</div>
          {error && <div className="text-sm text-cck-red">{error}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm space-y-1.5 block">
              <span className="text-cck-muted font-medium">Label</span>
              <input
                autoFocus
                className="w-full border border-cck-line rounded-lg px-3 py-2"
                placeholder="e.g. Fall 2027"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1.5 block">
              <span className="text-cck-muted font-medium">Start from</span>
              <select
                className="w-full border border-cck-line rounded-lg px-3 py-2 bg-white"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                <option value="base">Base template (rooms, instructors, courses)</option>
                <option value="blank">Blank (add everything myself)</option>
                {rows.map((r) => (
                  <option key={r.id} value={r.id}>
                    Copy of: {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={create} disabled={busy || !label.trim()} className="btn-primary">
              {busy ? 'Creating…' : 'Create & open'}
            </button>
            <button onClick={() => setCreating(false)} disabled={busy} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card p-12 text-center">
          <CalendarPlus className="h-10 w-10 mx-auto text-cck-muted" />
          <div className="font-semibold mt-3">No schedules yet</div>
          <div className="text-sm text-cck-muted mt-1">
            Create your first schedule to get started.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rows.map((s) => {
            const pct = s.total > 0 ? Math.round((s.placed / s.total) * 100) : 0
            return (
              <div key={s.id} className="card p-5 flex flex-col gap-3">
                <div className="flex items-start justify-between">
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 40, height: 40, background: '#e6f0eb' }}
                  >
                    <CalendarDays className="h-5 w-5" style={{ color: '#006341' }} />
                  </div>
                  {s.lastSolvedAt && (
                    <span className="badge green">{pct}% placed</span>
                  )}
                </div>
                <div>
                  <Link href={`/s/${s.id}`} className="font-semibold text-[15px] hover:text-cck-green">
                    {s.label}
                  </Link>
                  <div className="text-sm text-cck-muted mt-0.5">
                    {s.lastSolvedAt
                      ? `${s.placed}/${s.total} sections placed`
                      : 'Not generated yet'}
                  </div>
                  <div className="text-xs text-cck-muted mt-1">
                    Created {fmtDate(s.createdAt)} · solved {fmtDate(s.lastSolvedAt)}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-auto pt-1">
                  <Link href={`/s/${s.id}`} className="btn-primary">
                    Open <ArrowRight className="h-4 w-4" />
                  </Link>
                  <button onClick={() => rename(s)} className="text-sm text-cck-muted hover:underline">
                    Rename
                  </button>
                  <button onClick={() => remove(s)} className="text-sm text-cck-muted hover:underline">
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

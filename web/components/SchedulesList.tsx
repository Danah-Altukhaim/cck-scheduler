'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  CalendarDays,
  CalendarPlus,
  Search,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import type { ScheduleMeta } from '../lib/schedules'
import { Button, Dialog, ConfirmDialog, EmptyState, Segment, useToast } from './ui'

type ViewMode = 'cards' | 'list'

function fmtDate(ms: number | null): string {
  if (!ms) return '—'
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtRel(ms: number | null): string {
  if (!ms) return 'never'
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return fmtDate(ms)
}

export function SchedulesList({ initial }: { initial: ScheduleMeta[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const toast = useToast()
  const [rows, setRows] = useState(initial)
  const [view, setView] = useState<ViewMode>('cards')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [renameTarget, setRenameTarget] = useState<ScheduleMeta | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ScheduleMeta | null>(null)
  const [actionMenu, setActionMenu] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams?.get('new') === '1') setCreating(true)
  }, [searchParams])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => r.label.toLowerCase().includes(q))
  }, [rows, search])

  const stats = useMemo(() => {
    const solved = rows.filter((r) => r.lastSolvedAt).length
    const sections = rows.reduce((s, r) => s + r.total, 0)
    const placed = rows.reduce((s, r) => s + r.placed, 0)
    return {
      total: rows.length,
      solved,
      sections,
      placed,
      placementPct: sections > 0 ? Math.round((placed / sections) * 100) : 0,
    }
  }, [rows])

  async function performRename(s: ScheduleMeta, next: string) {
    const trimmed = next.trim()
    if (!trimmed || trimmed === s.label) return
    try {
      const res = await fetch(`/api/schedules/${s.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      if (!res.ok) throw new Error('Rename failed')
      setRows((prev) => prev.map((r) => (r.id === s.id ? { ...r, label: trimmed } : r)))
      toast.push({ title: 'Schedule renamed', tone: 'success' })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Rename failed', description: (e as Error).message, tone: 'error' })
    }
  }

  async function performDelete(s: ScheduleMeta) {
    try {
      const res = await fetch(`/api/schedules/${s.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRows((prev) => prev.filter((r) => r.id !== s.id))
      toast.push({
        title: 'Schedule deleted',
        description: `"${s.label}" was removed.`,
        tone: 'success',
      })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Delete failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Workspace</div>
          <h1>Schedules</h1>
          <div className="sub">
            Each schedule is a project with its own courses, instructors, rooms, rules, and solver runs.
          </div>
        </div>
        <div className="page-actions">
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
            New schedule
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPI label="Schedules" value={stats.total} sub={`${stats.solved} solved`} />
        <KPI label="Sections placed" value={stats.placed.toLocaleString()} sub={`of ${stats.sections.toLocaleString()}`} />
        <KPI label="Placement rate" value={`${stats.placementPct}%`} sub="across all schedules" />
        <KPI
          label="Last activity"
          value={fmtRel(
            rows
              .map((r) => r.lastSolvedAt ?? r.createdAt)
              .reduce<number | null>((acc, ms) => (acc == null || (ms && ms > acc) ? ms : acc), null),
          )}
          sub={rows[0]?.label ?? '—'}
        />
      </section>

      <div className="flex items-center gap-2 mb-4">
        <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
          />
          <input
            type="text"
            className="input"
            placeholder="Search schedules…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 28 }}
          />
        </div>
        <div className="ml-auto">
          <Segment
            value={view}
            onChange={setView}
            options={[
              { value: 'cards', label: 'Cards' },
              { value: 'list', label: 'List' },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        rows.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<CalendarPlus size={22} />}
              title="No schedules yet"
              description="Create your first schedule to start importing data and running the solver."
              actions={
                <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreating(true)}>
                  New schedule
                </Button>
              }
            />
          </div>
        ) : (
          <div className="card">
            <EmptyState
              title="No matches"
              description="Nothing matched your search. Try a different term."
            />
          </div>
        )
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((s) => {
            const pct = s.total > 0 ? Math.round((s.placed / s.total) * 100) : 0
            const placed = !!s.lastSolvedAt
            return (
              <div key={s.id} className="card p-5 flex flex-col gap-3 card-link" style={{ position: 'relative' }}>
                <Link href={`/s/${s.id}`} aria-label={`Open ${s.label}`} style={{ position: 'absolute', inset: 0 }} />
                <div className="flex items-start justify-between" style={{ position: 'relative' }}>
                  <div
                    className="flex items-center justify-center rounded-lg"
                    style={{ width: 38, height: 38, background: 'var(--accent-soft)' }}
                  >
                    <CalendarDays size={18} color="var(--accent)" />
                  </div>
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon btn-sm"
                      aria-label="More actions"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setActionMenu(actionMenu === s.id ? null : s.id)
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {actionMenu === s.id && (
                      <div
                        onMouseLeave={() => setActionMenu(null)}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          right: 0,
                          background: 'var(--surface)',
                          border: '1px solid var(--line)',
                          borderRadius: 'var(--radius-lg)',
                          boxShadow: 'var(--shadow-lg)',
                          padding: 4,
                          minWidth: 180,
                          zIndex: 5,
                        }}
                      >
                        <MenuItem
                          icon={<Pencil size={13} />}
                          label="Rename"
                          onClick={() => { setActionMenu(null); setRenameTarget(s) }}
                        />
                        <MenuItem
                          icon={<Copy size={13} />}
                          label="Duplicate"
                          onClick={() => { setActionMenu(null); setCreating(true) }}
                        />
                        <div className="divider" style={{ margin: 4 }} />
                        <MenuItem
                          icon={<Trash2 size={13} />}
                          label="Delete"
                          danger
                          onClick={() => { setActionMenu(null); setDeleteTarget(s) }}
                        />
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ position: 'relative' }}>
                  <div className="text-h3" style={{ marginBottom: 2 }}>{s.label}</div>
                  <div className="text-caption">
                    {placed ? `${s.placed} of ${s.total} sections placed` : 'Not generated yet'}
                  </div>
                </div>
                {placed && (
                  <div className="progress" aria-label={`${pct}% placed`}>
                    <span style={{ width: `${pct}%` }} />
                  </div>
                )}
                <div className="flex items-center gap-3 mt-auto" style={{ position: 'relative' }}>
                  <span className={`badge ${placed ? 'green' : 'muted'}`}>
                    {placed ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                    {placed ? `${pct}% placed` : 'Pending'}
                  </span>
                  <span className="text-caption" style={{ marginLeft: 'auto' }}>
                    {placed ? `Solved ${fmtRel(s.lastSolvedAt)}` : `Created ${fmtRel(s.createdAt)}`}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="card-flat" style={{ overflow: 'hidden' }}>
          <table className="cck">
            <thead>
              <tr>
                <th>Schedule</th>
                <th>Status</th>
                <th>Placed</th>
                <th>Last solve</th>
                <th>Created</th>
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const pct = s.total > 0 ? Math.round((s.placed / s.total) * 100) : 0
                const placed = !!s.lastSolvedAt
                return (
                  <tr
                    key={s.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/s/${s.id}`)}
                  >
                    <td>
                      <Link href={`/s/${s.id}`} style={{ color: 'inherit', textDecoration: 'none', fontWeight: 600 }}>
                        {s.label}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${placed ? 'green' : 'muted'}`}>
                        {placed ? `${pct}% placed` : 'Pending'}
                      </span>
                    </td>
                    <td className="tabular">
                      {placed ? `${s.placed} / ${s.total}` : '—'}
                    </td>
                    <td>{fmtRel(s.lastSolvedAt)}</td>
                    <td>{fmtDate(s.createdAt)}</td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        iconOnly
                        icon={<MoreHorizontal size={14} />}
                        aria-label="More actions"
                        onClick={() => setActionMenu(actionMenu === s.id ? null : s.id)}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <CreateScheduleDialog
        open={creating}
        onClose={() => setCreating(false)}
        existing={rows}
        onCreated={(s) => {
          setRows((prev) => [...prev, s])
          setCreating(false)
          toast.push({ title: 'Schedule created', description: s.label, tone: 'success' })
          router.push(`/s/${s.id}`)
        }}
        onError={(msg) => toast.push({ title: 'Create failed', description: msg, tone: 'error' })}
      />

      <RenameDialog
        target={renameTarget}
        onClose={() => setRenameTarget(null)}
        onConfirm={(name) => {
          if (renameTarget) performRename(renameTarget, name)
          setRenameTarget(null)
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await performDelete(deleteTarget)
        }}
        title={`Delete "${deleteTarget?.label}"?`}
        description="All data — inputs, rules, generated assignments — will be permanently removed. This action cannot be undone."
        confirmLabel="Delete schedule"
        tone="danger"
      />
    </>
  )
}

function KPI({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        width: '100%',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontSize: 13,
        color: danger ? 'var(--danger)' : 'var(--ink)',
        borderRadius: 'var(--radius-md)',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = danger ? 'var(--danger-soft)' : 'var(--surface-3)')}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      {label}
    </button>
  )
}

function CreateScheduleDialog({
  open,
  onClose,
  existing,
  onCreated,
  onError,
}: {
  open: boolean
  onClose: () => void
  existing: ScheduleMeta[]
  onCreated: (s: ScheduleMeta) => void
  onError: (msg: string) => void
}) {
  const [label, setLabel] = useState('')
  const [source, setSource] = useState('base')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) {
      setLabel('')
      setSource('base')
      setBusy(false)
    }
  }, [open])

  async function submit() {
    if (!label.trim()) return
    setBusy(true)
    try {
      const res = await fetch('/api/schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, source }),
      })
      const data = (await res.json()) as { schedule?: ScheduleMeta; error?: string }
      if (!res.ok || !data.schedule) throw new Error(data.error || 'Create failed')
      onCreated(data.schedule)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Create failed')
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New schedule"
      description="Schedules are independent — give yours a clear name and choose how to seed it."
      footer={
        <>
          <Button onClick={onClose} variant="secondary" disabled={busy}>
            Cancel
          </Button>
          <Button onClick={submit} variant="primary" disabled={busy || !label.trim()} loading={busy}>
            Create & open
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="field">
          <span className="field-label">Label</span>
          <input
            autoFocus
            className="input"
            placeholder="e.g. Fall 2026"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && label.trim() && !busy) submit()
            }}
          />
          <span className="field-hint">Choose something memorable like "Fall 2026" or "Pilot — block schedule".</span>
        </label>
        <label className="field">
          <span className="field-label">Start from</span>
          <select className="select" value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="base">Base template (rooms, instructors, courses pre-loaded)</option>
            <option value="blank">Blank — add everything myself</option>
            {existing.map((r) => (
              <option key={r.id} value={r.id}>
                Copy of: {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </Dialog>
  )
}

function RenameDialog({
  target,
  onClose,
  onConfirm,
}: {
  target: ScheduleMeta | null
  onClose: () => void
  onConfirm: (next: string) => void
}) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (target) setValue(target.label)
  }, [target])

  return (
    <Dialog
      open={!!target}
      onClose={onClose}
      title="Rename schedule"
      footer={
        <>
          <Button onClick={onClose} variant="secondary">Cancel</Button>
          <Button
            onClick={() => onConfirm(value)}
            variant="primary"
            disabled={!value.trim() || value.trim() === target?.label}
          >
            Save
          </Button>
        </>
      }
    >
      <label className="field">
        <span className="field-label">Label</span>
        <input
          className="input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && value.trim() && value.trim() !== target?.label) onConfirm(value)
          }}
        />
      </label>
    </Dialog>
  )
}

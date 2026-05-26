'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock,
  ListChecks,
  Loader2,
  Play,
  RotateCw,
  Square,
} from 'lucide-react'
import { Badge, Button, Progress, Segment, StatusIcon } from '@/components/ui'

type SolveState = 'idle' | 'running' | 'done' | 'error'
type SolveMode = 'check' | 'default' | 'interactive'

interface Stat {
  label: string
  value: number
  hint?: string
}

interface PreflightItem {
  label: string
  status: 'ok' | 'warn' | 'error'
  detail: string
  hint?: string
  href?: string
}

interface RunSummary {
  startedAt: number
  durationMs: number
  placed: number
  total: number
  mode: SolveMode
  state: SolveState
}

const HISTORY_KEY = (sid: string) => `runs:${sid}`

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function fmtRel(ms: number): string {
  const diff = Date.now() - ms
  const m = Math.floor(diff / 60_000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return new Date(ms).toLocaleDateString()
}

export function GenerateView({
  scheduleId,
  preflight,
  stats,
  result,
  lastSolvedAt,
}: {
  scheduleId: string
  preflight: PreflightItem[]
  stats: Stat[]
  result: { placed: number; total: number; hasResult: boolean }
  lastSolvedAt: string | null
}) {
  const router = useRouter()
  const q = `?schedule=${encodeURIComponent(scheduleId)}`
  const [state, setState] = useState<SolveState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [mode, setMode] = useState<SolveMode>('default')
  const [msg, setMsg] = useState<string | null>(null)
  const [runs, setRuns] = useState<RunSummary[]>([])
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const runStartRef = useRef<number | null>(null)

  // load run history
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HISTORY_KEY(scheduleId))
      if (raw) setRuns(JSON.parse(raw) as RunSummary[])
    } catch {
      /* ignore */
    }
  }, [scheduleId])

  function persistRun(r: RunSummary) {
    setRuns((cur) => {
      const next = [r, ...cur].slice(0, 10)
      try {
        window.localStorage.setItem(HISTORY_KEY(scheduleId), JSON.stringify(next))
      } catch {
        /* ignore */
      }
      return next
    })
  }

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/solve${q}`, { method: 'GET' })
      const d = (await res.json()) as {
        state: SolveState
        running: boolean
        elapsedMs: number
        log: string
      }
      setElapsed(d.elapsedMs ?? 0)
      if (d.state === 'running') {
        setState('running')
      } else if (d.state === 'done') {
        setState('done')
        stopPoll()
        const line = (d.log ?? '')
          .split('\n')
          .find((l) => l.includes('Solver:'))
          ?.trim()
        setMsg(line ?? 'Solve complete')
        if (runStartRef.current) {
          persistRun({
            startedAt: runStartRef.current,
            durationMs: d.elapsedMs ?? 0,
            placed: result.placed,
            total: result.total,
            mode,
            state: 'done',
          })
          runStartRef.current = null
        }
        router.refresh()
      } else if (d.state === 'error') {
        setState('error')
        stopPoll()
        setMsg('Solver failed. Check the dev-server terminal for details.')
        if (runStartRef.current) {
          persistRun({
            startedAt: runStartRef.current,
            durationMs: d.elapsedMs ?? 0,
            placed: 0,
            total: result.total,
            mode,
            state: 'error',
          })
          runStartRef.current = null
        }
      } else {
        setState('idle')
        stopPoll()
      }
    } catch {
      /* keep polling */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, mode])

  useEffect(() => {
    void fetch(`/api/solve${q}`)
      .then((r) => r.json())
      .then((d: { state: SolveState }) => {
        if (d.state === 'running') {
          setState('running')
          runStartRef.current = runStartRef.current ?? Date.now()
          pollRef.current = setInterval(() => void poll(), 3000)
          void poll()
        }
      })
      .catch(() => {})
    return stopPoll
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll])

  async function startSolve() {
    setMsg(null)
    setState('running')
    setElapsed(0)
    runStartRef.current = Date.now()
    try {
      await fetch(`/api/solve${q}`, { method: 'POST' })
    } catch {
      /* poll will pick it up */
    }
    pollRef.current = setInterval(() => void poll(), 3000)
    void poll()
  }

  const blockingErrors = preflight.filter((p) => p.status === 'error')
  const warnings = preflight.filter((p) => p.status === 'warn')
  const okCount = preflight.filter((p) => p.status === 'ok').length

  const phase: 1 | 2 | 3 = state === 'running' ? 2 : state === 'done' || result.hasResult ? 3 : 1
  const canSolve = blockingErrors.length === 0 && state !== 'running'

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Solve</div>
          <h1>Generate schedule</h1>
          <div className="sub">
            The solver places every section into a (room, instructor, day, time) tuple while respecting your rules. Usually ~5–10 minutes.
          </div>
        </div>
        <div className="page-actions">
          {result.hasResult && (
            <Button
              variant="secondary"
              icon={<ArrowRight size={14} />}
              onClick={() => router.push(`/s/${scheduleId}/schedule`)}
            >
              View schedule
            </Button>
          )}
        </div>
      </header>

      <PhaseStrip phase={phase} />

      {/* Workload summary */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {stats.map((s) => (
          <div key={s.label} className="kpi">
            <div className="label">{s.label}</div>
            <div className="value">{s.value}</div>
            {s.hint && <div className="sub">{s.hint}</div>}
          </div>
        ))}
      </section>

      {/* Phase 1 — Prepare */}
      <PhaseCard
        index={1}
        title="Prepare"
        description="Validate inputs before solving. Blocking issues must be fixed first."
        active={phase === 1}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {preflight.map((p) => (
            <div
              key={p.label}
              className="card-flat flex items-start gap-3"
              style={{ padding: '10px 12px' }}
            >
              <StatusIcon status={p.status} />
              <div className="flex-fill">
                <div className="text-body-sm" style={{ fontWeight: 600 }}>
                  {p.label}
                </div>
                <div className="text-caption">{p.detail}</div>
                {p.hint && <div className="text-caption" style={{ marginTop: 2 }}>{p.hint}</div>}
              </div>
              {p.href && (
                <Link href={p.href} className="btn btn-ghost btn-sm">
                  Fix <ChevronRight size={12} />
                </Link>
              )}
            </div>
          ))}
        </div>

        {blockingErrors.length > 0 && (
          <div
            className="card-flat flex items-center gap-3"
            style={{
              padding: '10px 14px',
              marginTop: 10,
              background: 'var(--danger-soft)',
              borderColor: 'var(--danger-strong)',
              color: 'var(--cck-red-dark)',
            }}
          >
            <AlertTriangle size={16} />
            <span className="text-body-sm">
              <strong>{blockingErrors.length}</strong> blocking issue{blockingErrors.length === 1 ? '' : 's'} must be fixed before the solver can start.
            </span>
          </div>
        )}
        {blockingErrors.length === 0 && warnings.length > 0 && (
          <div
            className="card-flat flex items-center gap-3"
            style={{
              padding: '10px 14px',
              marginTop: 10,
              background: 'var(--warn-soft)',
              borderColor: 'var(--warn-strong)',
              color: 'var(--warn)',
            }}
          >
            <AlertTriangle size={16} />
            <span className="text-body-sm">
              {warnings.length} warning{warnings.length === 1 ? '' : 's'}. The solver will still run.
            </span>
          </div>
        )}
        {blockingErrors.length === 0 && (
          <div className="text-caption" style={{ marginTop: 10 }}>
            <CheckCircle2 size={12} style={{ verticalAlign: -2, color: 'var(--success)' }} /> {okCount} of {preflight.length} checks passing.
          </div>
        )}
      </PhaseCard>

      {/* Phase 2 — Optimize */}
      <PhaseCard
        index={2}
        title="Optimize"
        description="Run the CP-SAT solver. You can leave this page — it keeps running."
        active={phase === 2}
      >
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-label">Mode</span>
            <Segment<SolveMode>
              value={mode}
              onChange={(v) => state !== 'running' && setMode(v)}
              size="sm"
              options={[
                { value: 'check', label: 'Check' },
                { value: 'default', label: 'Default' },
                { value: 'interactive', label: 'Interactive' },
              ]}
            />
            <span className="text-caption" style={{ marginLeft: 4 }}>
              {mode === 'check' && 'Feasibility only — answers in seconds.'}
              {mode === 'default' && 'Full optimization — best quality.'}
              {mode === 'interactive' && 'Manual overrides allowed.'}
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {state === 'running' ? (
              <>
                <Button variant="secondary" icon={<Square size={12} />} disabled>
                  Stop
                </Button>
                <Button
                  variant="primary"
                  loading
                  icon={<Loader2 size={14} />}
                  disabled
                >
                  Solving…
                </Button>
              </>
            ) : (
              <Button
                variant="primary"
                icon={<Play size={14} />}
                onClick={startSolve}
                disabled={!canSolve}
              >
                {result.hasResult ? 'Re-run solver' : 'Run solver'}
              </Button>
            )}
          </div>
        </div>

        {state === 'running' && (
          <div style={{ marginTop: 16 }}>
            <div className="flex items-center gap-3 mb-2">
              <Loader2 size={14} className="animate-spin" />
              <span className="text-body-sm" style={{ fontWeight: 600 }}>
                Solving · {fmtElapsed(elapsed)}
              </span>
              <span className="text-caption">Typical: 5–10 min. Safe to leave this page.</span>
            </div>
            <Progress value={Math.min(elapsed / 60000, 10)} max={10} />
            <div className="grid grid-cols-3 gap-3 mt-3">
              <RunMetric label="Mode" value={mode} />
              <RunMetric label="Elapsed" value={fmtElapsed(elapsed)} mono />
              <RunMetric label="Phase" value="Searching solutions" />
            </div>
          </div>
        )}

        {state === 'error' && msg && (
          <div
            className="card-flat flex items-center gap-3"
            style={{
              padding: '10px 14px',
              marginTop: 12,
              background: 'var(--danger-soft)',
              borderColor: 'var(--danger-strong)',
              color: 'var(--cck-red-dark)',
            }}
          >
            <AlertTriangle size={16} />
            <span className="text-body-sm">{msg}</span>
            <Button size="sm" variant="ghost" icon={<RotateCw size={12} />} onClick={startSolve} style={{ marginLeft: 'auto' }}>
              Retry
            </Button>
          </div>
        )}
      </PhaseCard>

      {/* Phase 3 — Assign */}
      <PhaseCard
        index={3}
        title="Assign & review"
        description="Inspect the result, then promote it to the published schedule."
        active={phase === 3}
        last
      >
        {result.hasResult ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="card-flat" style={{ padding: 14 }}>
              <div className="text-label">Placement</div>
              <div className="value text-h1 tabular" style={{ marginTop: 4 }}>
                {result.placed} <span className="text-caption">/ {result.total}</span>
              </div>
              <Progress value={result.total > 0 ? (result.placed / result.total) * 100 : 0} />
              <div className="text-caption" style={{ marginTop: 6 }}>
                {result.total > 0 ? Math.round((result.placed / result.total) * 100) : 0}% of sections placed
              </div>
            </div>
            <div className="card-flat" style={{ padding: 14 }}>
              <div className="text-label">Generated</div>
              <div className="text-h3 tabular" style={{ marginTop: 4 }}>
                {lastSolvedAt ?? '—'}
              </div>
              <div className="text-caption" style={{ marginTop: 4 }}>
                {msg ?? 'Last completed run'}
              </div>
            </div>
            <div className="card-flat flex flex-col gap-2" style={{ padding: 14 }}>
              <div className="text-label">Next</div>
              <Link href={`/s/${scheduleId}/schedule`} className="btn btn-primary">
                Open schedule <ArrowRight size={14} />
              </Link>
              <Link href={`/s/${scheduleId}/sections`} className="btn btn-secondary">
                Review sections
              </Link>
              <Link href={`/s/${scheduleId}/issues`} className="btn btn-ghost btn-sm">
                See data issues
              </Link>
            </div>
          </div>
        ) : (
          <div className="text-caption" style={{ padding: 8 }}>
            No run yet. Start the solver above to populate this section.
          </div>
        )}
      </PhaseCard>

      {/* Run history */}
      <section id="runs" style={{ marginTop: 32 }}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <h2 className="text-h2">Run history</h2>
            <p className="text-caption" style={{ marginTop: 2 }}>
              Local cache of the last {runs.length === 0 ? 'few' : runs.length} solver runs on this browser.
            </p>
          </div>
        </div>
        {runs.length === 0 ? (
          <div className="card-flat" style={{ padding: 20, textAlign: 'center', color: 'var(--muted)' }}>
            <span className="text-body-sm">No runs recorded yet. Each completed solve will show up here.</span>
          </div>
        ) : (
          <div className="card-flat" style={{ overflow: 'auto' }}>
            <table className="cck">
              <thead>
                <tr>
                  <th>Started</th>
                  <th>Mode</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Placement</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => {
                  const pct = r.total > 0 ? Math.round((r.placed / r.total) * 100) : 0
                  return (
                    <tr key={r.startedAt}>
                      <td>{fmtRel(r.startedAt)}</td>
                      <td><Badge tone="muted">{r.mode}</Badge></td>
                      <td>
                        {r.state === 'done' ? (
                          <Badge tone="green" dot>solved</Badge>
                        ) : (
                          <Badge tone="red" dot>failed</Badge>
                        )}
                      </td>
                      <td className="tabular">{fmtElapsed(r.durationMs)}</td>
                      <td className="tabular">
                        {r.placed}/{r.total} · {pct}%
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  )
}

function PhaseStrip({ phase }: { phase: 1 | 2 | 3 }) {
  const items = [
    { idx: 1, label: 'Prepare', icon: <ListChecks size={14} /> },
    { idx: 2, label: 'Optimize', icon: <CircleDot size={14} /> },
    { idx: 3, label: 'Assign & review', icon: <CheckCircle2 size={14} /> },
  ]
  return (
    <div className="card-flat flex items-center gap-2" style={{ padding: '10px 14px', marginBottom: 18 }}>
      {items.map((it, i) => {
        const done = it.idx < phase
        const active = it.idx === phase
        return (
          <div key={it.idx} className="flex items-center gap-2 flex-fill">
            <span
              className="flex items-center justify-center rounded-full"
              style={{
                width: 24,
                height: 24,
                background: done ? 'var(--success)' : active ? 'var(--accent)' : 'var(--surface-3)',
                color: done || active ? '#fff' : 'var(--muted)',
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {done ? <CheckCircle2 size={12} /> : it.idx}
            </span>
            <span className="flex items-center gap-1.5">
              {it.icon}
              <span style={{ fontWeight: active ? 700 : 500, fontSize: 13 }}>{it.label}</span>
            </span>
            {i < items.length - 1 && (
              <span style={{ flex: 1, height: 1, background: 'var(--line)', margin: '0 8px' }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PhaseCard({
  index,
  title,
  description,
  active,
  last,
  children,
}: {
  index: number
  title: string
  description: string
  active?: boolean
  last?: boolean
  children: React.ReactNode
}) {
  return (
    <section
      className="card-flat"
      style={{
        marginBottom: last ? 0 : 16,
        padding: 18,
        borderColor: active ? 'var(--accent)' : undefined,
        boxShadow: active ? '0 0 0 3px var(--accent-ring)' : undefined,
      }}
    >
      <div className="flex items-start gap-3 mb-3">
        <span
          className="flex items-center justify-center rounded-full"
          style={{
            width: 26,
            height: 26,
            background: active ? 'var(--accent)' : 'var(--surface-3)',
            color: active ? '#fff' : 'var(--muted)',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {index}
        </span>
        <div className="flex-fill">
          <div className="text-h3">{title}</div>
          <div className="text-caption" style={{ marginTop: 2 }}>{description}</div>
        </div>
        <Clock size={14} color="var(--muted)" />
      </div>
      {children}
    </section>
  )
}

function RunMetric({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="card-flat" style={{ padding: '8px 12px' }}>
      <div className="text-label">{label}</div>
      <div className={`text-body-sm ${mono ? 'tabular text-mono' : ''}`} style={{ fontWeight: 600, marginTop: 2 }}>
        {value}
      </div>
    </div>
  )
}

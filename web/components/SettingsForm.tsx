'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SchedulerConfig, Window } from '../lib/config'
import { Button, useToast } from './ui'

const ALL_DAYS = ['Sa', 'Su', 'M', 'T', 'W', 'Th'] as const

function minToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function TimeRange({ win, onChange }: { win: Window; onChange: (w: Window) => void }) {
  const invalid = win.endMin <= win.startMin
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        className="input"
        style={{ width: 132 }}
        value={minToHHMM(win.startMin)}
        onChange={(e) => onChange({ ...win, startMin: hhmmToMin(e.target.value) })}
      />
      <span className="text-caption">to</span>
      <input
        type="time"
        className="input"
        style={{ width: 132, borderColor: invalid ? 'var(--danger)' : undefined }}
        value={minToHHMM(win.endMin)}
        onChange={(e) => onChange({ ...win, endMin: hhmmToMin(e.target.value) })}
      />
      {invalid && <span className="field-error">End must be after start</span>}
    </div>
  )
}

function Row({
  label,
  hint,
  children,
  last,
}: {
  label: string
  hint?: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-3 gap-3"
      style={{
        padding: '16px 0',
        borderBottom: last ? 'none' : '1px solid var(--line-soft)',
      }}
    >
      <div>
        <div className="text-body-sm" style={{ fontWeight: 600 }}>{label}</div>
        {hint && <div className="text-caption" style={{ marginTop: 2 }}>{hint}</div>}
      </div>
      <div className="md:col-span-2">{children}</div>
    </div>
  )
}

export function SettingsForm({
  initial,
  scheduleId,
}: {
  initial: SchedulerConfig
  scheduleId: string
}) {
  const [cfg, setCfg] = useState<SchedulerConfig>(initial)
  const [busy, setBusy] = useState(false)
  const router = useRouter()
  const toast = useToast()

  const dirty = useMemo(() => JSON.stringify(cfg) !== JSON.stringify(initial), [cfg, initial])
  const hasErrors =
    cfg.operatingWindow.endMin <= cfg.operatingWindow.startMin ||
    cfg.buckets.morning.endMin <= cfg.buckets.morning.startMin ||
    cfg.buckets.midday.endMin <= cfg.buckets.midday.startMin ||
    cfg.buckets.evening.endMin <= cfg.buckets.evening.startMin ||
    (cfg.mondayBlock.enabled && cfg.mondayBlock.endMin <= cfg.mondayBlock.startMin)

  async function save() {
    setBusy(true)
    try {
      const res = await fetch(`/api/config?schedule=${encodeURIComponent(scheduleId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Save failed')
      toast.push({
        title: 'Settings saved',
        description: 'Changes apply on the next solver run.',
        tone: 'success',
      })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Save failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Policy</div>
          <h1>Term settings</h1>
          <div className="sub">
            Term-wide knobs the solver reads on every run. Changes here apply across all rules and stages.
          </div>
        </div>
        <div className="page-actions">
          {dirty && (
            <Button variant="secondary" onClick={() => setCfg(initial)} disabled={busy}>
              Reset
            </Button>
          )}
          <Button variant="primary" onClick={save} loading={busy} disabled={!dirty || hasErrors}>
            Save settings
          </Button>
        </div>
      </header>

      {dirty && (
        <div
          className="card-flat flex items-center gap-3"
          style={{
            padding: '8px 14px',
            marginBottom: 14,
            background: 'var(--warn-soft)',
            borderColor: 'var(--warn-strong)',
            color: 'var(--warn)',
          }}
        >
          <span className="text-body-sm">You have unsaved changes.</span>
        </div>
      )}

      <div className="card" style={{ padding: '4px 20px' }}>
        <Row label="Operating days" hint="Days the solver may place classes on.">
          <div className="flex flex-wrap gap-1.5">
            {ALL_DAYS.map((d) => {
              const on = cfg.operatingDays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setCfg({
                      ...cfg,
                      operatingDays: on
                        ? cfg.operatingDays.filter((x) => x !== d)
                        : [...cfg.operatingDays, d],
                    })
                  }
                  className={`badge ${on ? 'solid' : 'muted'}`}
                  style={{ cursor: 'pointer', borderColor: on ? 'var(--ink)' : undefined, padding: '4px 10px' }}
                >
                  {d}
                </button>
              )
            })}
          </div>
        </Row>

        <Row label="Operating window" hint="Earliest start and latest end for any class.">
          <TimeRange win={cfg.operatingWindow} onChange={(w) => setCfg({ ...cfg, operatingWindow: w })} />
        </Row>

        <Row label="Reserved block" hint="A college-wide hold (e.g. Monday assembly).">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-body-sm">
              <input
                type="checkbox"
                checked={cfg.mondayBlock.enabled}
                onChange={(e) =>
                  setCfg({ ...cfg, mondayBlock: { ...cfg.mondayBlock, enabled: e.target.checked } })
                }
              />
              Enabled
            </label>
            <select
              className="select"
              style={{ width: 90 }}
              value={cfg.mondayBlock.day}
              onChange={(e) =>
                setCfg({ ...cfg, mondayBlock: { ...cfg.mondayBlock, day: e.target.value } })
              }
              disabled={!cfg.mondayBlock.enabled}
            >
              {ALL_DAYS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <TimeRange
              win={{ startMin: cfg.mondayBlock.startMin, endMin: cfg.mondayBlock.endMin }}
              onChange={(w) =>
                setCfg({
                  ...cfg,
                  mondayBlock: { ...cfg.mondayBlock, startMin: w.startMin, endMin: w.endMin },
                })
              }
            />
          </div>
        </Row>

        <Row label="Morning bucket" hint="Preferred window for morning sections.">
          <TimeRange
            win={cfg.buckets.morning}
            onChange={(w) => setCfg({ ...cfg, buckets: { ...cfg.buckets, morning: w } })}
          />
        </Row>
        <Row label="Midday bucket">
          <TimeRange
            win={cfg.buckets.midday}
            onChange={(w) => setCfg({ ...cfg, buckets: { ...cfg.buckets, midday: w } })}
          />
        </Row>
        <Row label="Evening bucket" last>
          <TimeRange
            win={cfg.buckets.evening}
            onChange={(w) => setCfg({ ...cfg, buckets: { ...cfg.buckets, evening: w } })}
          />
        </Row>
      </div>
    </main>
  )
}

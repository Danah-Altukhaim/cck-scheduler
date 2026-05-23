'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { SchedulerConfig, Window } from '../lib/config'

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

function TimeRange({
  win,
  onChange,
}: {
  win: Window
  onChange: (w: Window) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="time"
        className="border border-cck-line rounded px-2 py-1 text-sm"
        value={minToHHMM(win.startMin)}
        onChange={(e) => onChange({ ...win, startMin: hhmmToMin(e.target.value) })}
      />
      <span className="text-cck-muted text-sm">to</span>
      <input
        type="time"
        className="border border-cck-line rounded px-2 py-1 text-sm"
        value={minToHHMM(win.endMin)}
        onChange={(e) => onChange({ ...win, endMin: hhmmToMin(e.target.value) })}
      />
    </div>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 py-3 border-b border-cck-line last:border-0">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-cck-muted mt-0.5">{hint}</div>}
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
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const router = useRouter()

  async function save() {
    setBusy(true)
    setMsg(null)
    try {
      const res = await fetch(`/api/config?schedule=${encodeURIComponent(scheduleId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cfg),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Save failed')
      setMsg({ text: 'Settings saved. They apply on the next solve.', ok: true })
      router.refresh()
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : 'Save failed', ok: false })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/s/${scheduleId}/constraints`}
        className="inline-flex items-center gap-1 text-sm text-cck-muted hover:text-cck-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Set rules
      </Link>
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-cck-muted mt-1">
            Term-wide knobs the solver reads on every run.
          </p>
        </div>
        <button onClick={save} disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </header>

      {msg && (
        <div
          className={`border rounded-md bg-white px-3 py-2 text-sm ${
            msg.ok ? 'border-cck-line text-cck-muted' : 'border-cck-red text-cck-red'
          }`}
        >
          {msg.text}
        </div>
      )}

      <div className="border border-cck-line rounded-md bg-white px-4">
        <Row label="Operating days" hint="Days classes may be scheduled.">
          <div className="flex flex-wrap gap-3">
            {ALL_DAYS.map((d) => (
              <label key={d} className="flex items-center gap-1.5 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.operatingDays.includes(d)}
                  onChange={(e) =>
                    setCfg({
                      ...cfg,
                      operatingDays: e.target.checked
                        ? [...cfg.operatingDays, d]
                        : cfg.operatingDays.filter((x) => x !== d),
                    })
                  }
                />
                {d}
              </label>
            ))}
          </div>
        </Row>

        <Row label="Operating window" hint="Earliest start and latest end for any class.">
          <TimeRange win={cfg.operatingWindow} onChange={(w) => setCfg({ ...cfg, operatingWindow: w })} />
        </Row>

        <Row label="Reserved block" hint="A college-wide hold (e.g. Monday assembly).">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={cfg.mondayBlock.enabled}
                onChange={(e) =>
                  setCfg({ ...cfg, mondayBlock: { ...cfg.mondayBlock, enabled: e.target.checked } })
                }
              />
              enabled
            </label>
            <select
              className="border border-cck-line rounded px-2 py-1 text-sm"
              value={cfg.mondayBlock.day}
              onChange={(e) =>
                setCfg({ ...cfg, mondayBlock: { ...cfg.mondayBlock, day: e.target.value } })
              }
            >
              {ALL_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
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
        <Row label="Evening bucket">
          <TimeRange
            win={cfg.buckets.evening}
            onChange={(w) => setCfg({ ...cfg, buckets: { ...cfg.buckets, evening: w } })}
          />
        </Row>

        <Row
          label="Working-student share"
          hint="Fraction of demand placed in evening sections (0–1)."
        >
          <input
            type="number"
            step="0.05"
            min="0"
            max="1"
            className="border border-cck-line rounded px-2 py-1 text-sm w-28"
            value={cfg.workingStudentShare}
            onChange={(e) => setCfg({ ...cfg, workingStudentShare: Number(e.target.value) })}
          />
        </Row>
      </div>
    </div>
  )
}

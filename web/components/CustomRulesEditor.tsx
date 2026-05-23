'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CustomRule, CustomRuleType } from '../lib/config'

const ALL_DAYS = ['Sa', 'Su', 'M', 'T', 'W', 'Th']

type ParamKind = 'text' | 'number' | 'time' | 'days'
interface ParamSpec {
  name: string
  label: string
  kind: ParamKind
}

// The constraint-type library. Each type maps to a CP-SAT constraint the
// solver applies (see scripts/cp_solve.py).
export const RULE_TYPES: Record<
  CustomRuleType,
  { label: string; kind: 'hard' | 'soft'; desc: string; params: ParamSpec[] }
> = {
  instructor_unavailable: {
    label: 'Instructor unavailable',
    kind: 'hard',
    desc: 'An instructor cannot teach during a time window on the given days.',
    params: [
      { name: 'instructor_id', label: 'Instructor ID', kind: 'text' },
      { name: 'days', label: 'Days', kind: 'days' },
      { name: 'startMin', label: 'From', kind: 'time' },
      { name: 'endMin', label: 'To', kind: 'time' },
    ],
  },
  room_reserved: {
    label: 'Room reserved',
    kind: 'hard',
    desc: 'A room is held (no classes) during a window on the given days.',
    params: [
      { name: 'room_code', label: 'Room code', kind: 'text' },
      { name: 'days', label: 'Days', kind: 'days' },
      { name: 'startMin', label: 'From', kind: 'time' },
      { name: 'endMin', label: 'To', kind: 'time' },
    ],
  },
  course_time_window: {
    label: 'Course time window',
    kind: 'hard',
    desc: 'Every section of a course must fall within a time window.',
    params: [
      { name: 'course_code', label: 'Course code', kind: 'text' },
      { name: 'startMin', label: 'From', kind: 'time' },
      { name: 'endMin', label: 'To', kind: 'time' },
    ],
  },
  no_overlap_pair: {
    label: 'Courses must not overlap',
    kind: 'hard',
    desc: 'Two courses can never be scheduled at the same time.',
    params: [
      { name: 'course_a', label: 'Course A', kind: 'text' },
      { name: 'course_b', label: 'Course B', kind: 'text' },
    ],
  },
  prefer_time: {
    label: 'Prefer time window',
    kind: 'soft',
    desc: 'A course is preferred within a window. A penalty applies outside it.',
    params: [
      { name: 'course_code', label: 'Course code', kind: 'text' },
      { name: 'startMin', label: 'From', kind: 'time' },
      { name: 'endMin', label: 'To', kind: 'time' },
      { name: 'weight', label: 'Penalty weight', kind: 'number' },
    ],
  },
}

function minToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}
function hhmmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return (h ?? 0) * 60 + (m ?? 0)
}

function summarize(rule: CustomRule): string {
  const p = rule.params
  const fmt = (v: unknown) => (typeof v === 'number' ? minToHHMM(v) : String(v))
  switch (rule.type) {
    case 'instructor_unavailable':
      return `${p.instructor_id} · ${(p.days as string[])?.join(',')} · ${fmt(p.startMin)}–${fmt(p.endMin)}`
    case 'room_reserved':
      return `${p.room_code} · ${(p.days as string[])?.join(',')} · ${fmt(p.startMin)}–${fmt(p.endMin)}`
    case 'course_time_window':
      return `${p.course_code} · ${fmt(p.startMin)}–${fmt(p.endMin)}`
    case 'no_overlap_pair':
      return `${p.course_a} ✕ ${p.course_b}`
    case 'prefer_time':
      return `${p.course_code} · ${fmt(p.startMin)}–${fmt(p.endMin)} · weight ${p.weight}`
    default:
      return ''
  }
}

export function CustomRulesEditor({
  initialRules,
  scheduleId,
}: {
  initialRules: CustomRule[]
  scheduleId: string
}) {
  const q = `schedule=${encodeURIComponent(scheduleId)}`
  const [rules, setRules] = useState<CustomRule[]>(initialRules)
  const [mode, setMode] = useState<null | 'new' | { edit: string }>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<CustomRuleType>('instructor_unavailable')
  const [enabled, setEnabled] = useState(true)
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function defaultsFor(t: CustomRuleType): Record<string, unknown> {
    const p: Record<string, unknown> = {}
    for (const f of RULE_TYPES[t].params) {
      if (f.kind === 'days') p[f.name] = []
      else if (f.kind === 'time') p[f.name] = f.name === 'endMin' ? 720 : 480
      else if (f.kind === 'number') p[f.name] = 3
      else p[f.name] = ''
    }
    return p
  }

  function openNew() {
    setName('')
    setType('instructor_unavailable')
    setEnabled(true)
    setParams(defaultsFor('instructor_unavailable'))
    setError(null)
    setMode('new')
  }

  function openEdit(rule: CustomRule) {
    setName(rule.name)
    setType(rule.type)
    setEnabled(rule.enabled)
    setParams({ ...rule.params })
    setError(null)
    setMode({ edit: rule.id })
  }

  function changeType(t: CustomRuleType) {
    setType(t)
    setParams(defaultsFor(t))
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const isNew = mode === 'new'
      const payload = { name, type, kind: RULE_TYPES[type].kind, enabled, params }
      const url = isNew
        ? `/api/rules?${q}`
        : `/api/rules/${(mode as { edit: string }).edit}?${q}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = (await res.json()) as { rule?: CustomRule; error?: string }
      if (!res.ok || !data.rule) throw new Error(data.error || 'Save failed')
      setRules((prev) =>
        isNew
          ? [...prev, data.rule!]
          : prev.map((r) => (r.id === data.rule!.id ? data.rule! : r)),
      )
      setMode(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Delete this rule?')) return
    setBusy(true)
    try {
      await fetch(`/api/rules/${id}?${q}`, { method: 'DELETE' })
      setRules((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function toggle(rule: CustomRule) {
    const next = { ...rule, enabled: !rule.enabled }
    setRules((prev) => prev.map((r) => (r.id === rule.id ? next : r)))
    await fetch(`/api/rules/${rule.id}?${q}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: next.enabled }),
    })
    router.refresh()
  }

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custom rules</h2>
          <p className="text-sm text-cck-muted">
            {rules.length} custom rule{rules.length === 1 ? '' : 's'}, added to the built-ins above.
          </p>
        </div>
        <button onClick={openNew} disabled={busy || mode !== null} className="btn-primary">
          + Add rule
        </button>
      </div>

      {error && (
        <div className="border border-cck-red rounded-md bg-white px-3 py-2 text-sm text-cck-red">
          {error}
        </div>
      )}

      {mode !== null && (
        <div className="border border-cck-line rounded-md bg-white p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Rule name</span>
              <input
                className="w-full border border-cck-line rounded px-2 py-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Constraint type</span>
              <select
                className="w-full border border-cck-line rounded px-2 py-1"
                value={type}
                disabled={mode !== 'new'}
                onChange={(e) => changeType(e.target.value as CustomRuleType)}
              >
                {(Object.keys(RULE_TYPES) as CustomRuleType[]).map((t) => (
                  <option key={t} value={t}>
                    {RULE_TYPES[t].label} ({RULE_TYPES[t].kind})
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="text-xs text-cck-muted">{RULE_TYPES[type].desc}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RULE_TYPES[type].params.map((f) => (
              <label key={f.name} className="text-sm space-y-1 block">
                <span className="text-cck-muted">{f.label}</span>
                {f.kind === 'days' ? (
                  <div className="flex flex-wrap gap-2">
                    {ALL_DAYS.map((d) => {
                      const arr = (params[f.name] as string[]) ?? []
                      return (
                        <label key={d} className="flex items-center gap-1 text-xs">
                          <input
                            type="checkbox"
                            checked={arr.includes(d)}
                            onChange={(e) =>
                              setParams({
                                ...params,
                                [f.name]: e.target.checked
                                  ? [...arr, d]
                                  : arr.filter((x) => x !== d),
                              })
                            }
                          />
                          {d}
                        </label>
                      )
                    })}
                  </div>
                ) : f.kind === 'time' ? (
                  <input
                    type="time"
                    className="w-full border border-cck-line rounded px-2 py-1"
                    value={minToHHMM((params[f.name] as number) ?? 0)}
                    onChange={(e) => setParams({ ...params, [f.name]: hhmmToMin(e.target.value) })}
                  />
                ) : (
                  <input
                    type={f.kind === 'number' ? 'number' : 'text'}
                    className="w-full border border-cck-line rounded px-2 py-1"
                    value={String(params[f.name] ?? '')}
                    onChange={(e) =>
                      setParams({
                        ...params,
                        [f.name]: f.kind === 'number' ? Number(e.target.value) : e.target.value,
                      })
                    }
                  />
                )}
              </label>
            ))}
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            enabled
          </label>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save rule'}
            </button>
            <button onClick={() => setMode(null)} disabled={busy} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="border border-cck-line rounded-md bg-white overflow-x-auto">
        <table className="cck">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Kind</th>
              <th>Definition</th>
              <th>Enabled</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="text-sm text-cck-muted">
                  No custom rules yet. The 14 + 9 built-ins above are always active.
                </td>
              </tr>
            )}
            {rules.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td>
                <td className="text-sm">{RULE_TYPES[r.type]?.label ?? r.type}</td>
                <td>
                  <span className={`badge ${r.kind === 'hard' ? 'red' : 'muted'}`}>{r.kind}</span>
                </td>
                <td className="text-sm">{summarize(r)}</td>
                <td>
                  <button onClick={() => toggle(r)} className="text-sm text-cck-red hover:underline">
                    {r.enabled ? 'on' : 'off'}
                  </button>
                </td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <button
                    onClick={() => openEdit(r)}
                    disabled={busy || mode !== null}
                    className="text-sm text-cck-red hover:underline disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    disabled={busy || mode !== null}
                    className="text-sm text-cck-muted hover:underline ml-3 disabled:opacity-40"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

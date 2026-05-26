'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { CustomRule, CustomRuleType } from '../lib/config'
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  Sheet,
  useToast,
  type Column,
} from './ui'

const ALL_DAYS = ['Sa', 'Su', 'M', 'T', 'W', 'Th']

type ParamKind = 'text' | 'number' | 'time' | 'days'
interface ParamSpec {
  name: string
  label: string
  kind: ParamKind
}

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
  const router = useRouter()
  const toast = useToast()
  const [rules, setRules] = useState<CustomRule[]>(initialRules)
  const [mode, setMode] = useState<null | 'new' | { edit: string }>(null)
  const [name, setName] = useState('')
  const [type, setType] = useState<CustomRuleType>('instructor_unavailable')
  const [enabled, setEnabled] = useState(true)
  const [params, setParams] = useState<Record<string, unknown>>({})
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustomRule | null>(null)

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
    setMode('new')
  }

  function openEdit(rule: CustomRule) {
    setName(rule.name)
    setType(rule.type)
    setEnabled(rule.enabled)
    setParams({ ...rule.params })
    setMode({ edit: rule.id })
  }

  function changeType(t: CustomRuleType) {
    setType(t)
    setParams(defaultsFor(t))
  }

  async function save() {
    setBusy(true)
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
        isNew ? [...prev, data.rule!] : prev.map((r) => (r.id === data.rule!.id ? data.rule! : r)),
      )
      setMode(null)
      toast.push({ title: isNew ? 'Rule added' : 'Rule updated', tone: 'success' })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Save failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function performDelete(r: CustomRule) {
    setBusy(true)
    try {
      await fetch(`/api/rules/${r.id}?${q}`, { method: 'DELETE' })
      setRules((prev) => prev.filter((x) => x.id !== r.id))
      toast.push({ title: 'Rule deleted', tone: 'success' })
      router.refresh()
    } finally {
      setBusy(false)
      setDeleteTarget(null)
    }
  }

  async function toggle(rule: CustomRule) {
    const next = { ...rule, enabled: !rule.enabled }
    setRules((prev) => prev.map((r) => (r.id === rule.id ? next : r)))
    try {
      await fetch(`/api/rules/${rule.id}?${q}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: next.enabled }),
      })
      router.refresh()
    } catch {
      // revert
      setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)))
      toast.push({ title: 'Could not save', tone: 'error' })
    }
  }

  async function setKind(rule: CustomRule, kind: 'hard' | 'soft') {
    const next = { ...rule, kind }
    setRules((prev) => prev.map((r) => (r.id === rule.id ? next : r)))
    try {
      await fetch(`/api/rules/${rule.id}?${q}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind }),
      })
      router.refresh()
    } catch {
      setRules((prev) => prev.map((r) => (r.id === rule.id ? rule : r)))
    }
  }

  const columns: Column<CustomRule>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Name',
        sortable: true,
        accessor: (r) => r.name,
        render: (r) => (
          <div>
            <div style={{ fontWeight: 600 }}>{r.name}</div>
            <div className="text-caption">{RULE_TYPES[r.type]?.label ?? r.type}</div>
          </div>
        ),
      },
      {
        key: 'definition',
        header: 'Definition',
        render: (r) => <span className="text-mono" style={{ fontSize: 12 }}>{summarize(r)}</span>,
      },
      {
        key: 'kind',
        header: 'On failure',
        width: 160,
        sortable: true,
        accessor: (r) => r.kind,
        render: (r) => (
          <select
            className="select"
            value={!r.enabled ? 'off' : r.kind === 'hard' ? 'required' : 'warning'}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v = e.target.value
              if (v === 'off') void toggle(r)
              else void setKind({ ...r, enabled: true }, v === 'required' ? 'hard' : 'soft')
            }}
            style={{ width: 130, fontSize: 12 }}
          >
            <option value="off">Off</option>
            <option value="warning">Warning</option>
            <option value="required">Required</option>
          </select>
        ),
      },
      {
        key: 'enabled',
        header: '',
        width: 80,
        align: 'right',
        render: (r) => (
          <Badge tone={r.enabled ? 'green' : 'muted'} dot>
            {r.enabled ? 'on' : 'off'}
          </Badge>
        ),
      },
      {
        key: '__actions',
        header: '',
        width: 70,
        align: 'right',
        render: (r) => (
          <div className="row-action flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              icon={<Pencil size={12} />}
              aria-label="Edit"
              onClick={(e) => {
                e.stopPropagation()
                openEdit(r)
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              icon={<Trash2 size={12} />}
              aria-label="Delete"
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(r)
              }}
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-h2">Custom rules</h2>
          <p className="text-caption" style={{ marginTop: 4 }}>
            Schedule-specific constraints layered on top of the built-in catalog. Set <strong>On failure</strong> per rule:
            <em> Off</em> — ignored, <em>Warning</em> — soft penalty in the objective, <em>Required</em> — hard block.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>
          New custom rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="card-flat">
          <EmptyState
            title="No custom rules yet"
            description="The built-in 14 hard + 9 soft rules below are always active. Add a custom rule to handle a one-off constraint."
            actions={
              <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>
                Add a rule
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          rows={rules}
          columns={columns}
          rowKey={(r) => r.id}
          storageKey="custom-rules"
          rowProps={(r) => ({
            onClick: () => openEdit(r),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      <Sheet
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === 'new' ? 'New custom rule' : 'Edit custom rule'}
        description={RULE_TYPES[type]?.desc}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setMode(null)} disabled={busy}>Cancel</Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={!name.trim()}>
              {mode === 'new' ? 'Add rule' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="field">
              <span className="field-label">Name</span>
              <input
                className="input"
                placeholder="e.g. Dr. Khalid not available Thursdays"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
            <label className="field">
              <span className="field-label">Constraint type</span>
              <select
                className="select"
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
          <div className="divider" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {RULE_TYPES[type].params.map((f) => (
              <label key={f.name} className="field">
                <span className="field-label">{f.label}</span>
                {f.kind === 'days' ? (
                  <div className="flex flex-wrap gap-1">
                    {ALL_DAYS.map((d) => {
                      const arr = (params[f.name] as string[]) ?? []
                      const on = arr.includes(d)
                      return (
                        <button
                          type="button"
                          key={d}
                          onClick={() =>
                            setParams({
                              ...params,
                              [f.name]: on ? arr.filter((x) => x !== d) : [...arr, d],
                            })
                          }
                          className={`badge ${on ? 'solid' : 'muted'}`}
                          style={{ cursor: 'pointer', borderColor: on ? 'var(--ink)' : undefined }}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                ) : f.kind === 'time' ? (
                  <input
                    type="time"
                    className="input"
                    value={minToHHMM((params[f.name] as number) ?? 0)}
                    onChange={(e) => setParams({ ...params, [f.name]: hhmmToMin(e.target.value) })}
                  />
                ) : (
                  <input
                    type={f.kind === 'number' ? 'number' : 'text'}
                    className="input"
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
          <label
            className="flex items-center gap-2 text-body-sm"
            style={{ marginTop: 8, padding: '8px 10px', background: 'var(--surface-2)', borderRadius: 'var(--radius-md)' }}
          >
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Enabled — the solver applies this rule. Disable to suspend without deleting.
          </label>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await performDelete(deleteTarget)
        }}
        title="Delete this custom rule?"
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
      />
    </section>
  )
}

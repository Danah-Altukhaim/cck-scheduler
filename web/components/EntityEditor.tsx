'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ChipInput } from './ChipInput'
import { SemesterBlocksEditor } from './SemesterBlocksEditor'
import { AvailabilityWindowsEditor } from './AvailabilityWindowsEditor'

export interface FieldSpec {
  name: string
  label: string
  kind:
    | 'text'
    | 'number'
    | 'boolean'
    | 'select'
    | 'tags'
    | 'json'
    | 'semester-blocks'
    | 'availability-windows'
  options?: string[]
  idField?: boolean
}

// Kinds whose form value is carried as a JSON string.
const JSON_KINDS = ['json', 'semester-blocks', 'availability-windows']

function parseJson(raw: string): unknown {
  try {
    return raw.trim() ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export interface ComputedColumn {
  key: string
  label: string
}

interface EntityEditorProps {
  scheduleId: string
  type: string
  idField: string
  fields: FieldSpec[]
  initialRows: Record<string, unknown>[]
  title: string
  subtitle?: string
  // id -> { columnKey: displayValue } for read-only analytics columns.
  computed?: Record<string, Record<string, string>>
  computedColumns?: ComputedColumn[]
}

type FormState = Record<string, string>

// ---- value <-> string coercion --------------------------------------------

function toFormValue(field: FieldSpec, value: unknown): string {
  if (value === undefined || value === null) return JSON_KINDS.includes(field.kind) ? '[]' : ''
  if (field.kind === 'tags') return Array.isArray(value) ? value.join(', ') : String(value)
  if (JSON_KINDS.includes(field.kind)) return JSON.stringify(value)
  if (field.kind === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function fromFormValue(field: FieldSpec, raw: string): unknown {
  const v = raw.trim()
  if (field.kind === 'number') return v === '' ? 0 : Number(v)
  if (field.kind === 'boolean') return v === 'true'
  if (field.kind === 'tags') return v === '' ? [] : v.split(',').map((s) => s.trim()).filter(Boolean)
  if (JSON_KINDS.includes(field.kind)) return parseJson(v)
  return v
}

function display(field: FieldSpec, value: unknown): string {
  if (value === undefined || value === null) return '-'
  if (field.kind === 'tags') return Array.isArray(value) ? value.join(', ') || '-' : String(value)
  if (field.kind === 'semester-blocks')
    return Array.isArray(value) ? `${value.length} block(s)` : '-'
  if (field.kind === 'availability-windows')
    return Array.isArray(value) ? `${value.length} window(s)` : '-'
  if (field.kind === 'json') return Array.isArray(value) ? `${value.length} item(s)` : 'set'
  if (field.kind === 'boolean') return value ? 'yes' : 'no'
  return String(value)
}

export function EntityEditor({
  scheduleId,
  type,
  idField,
  fields,
  initialRows,
  title,
  subtitle,
  computed,
  computedColumns,
}: EntityEditorProps) {
  const q = `?schedule=${encodeURIComponent(scheduleId)}`
  const [rows, setRows] = useState(initialRows)
  const [mode, setMode] = useState<null | 'new' | { edit: string }>(null)
  const [form, setForm] = useState<FormState>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  async function importFile(file: File) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/import/${type}${q}`, { method: 'POST', body: fd })
      const data = (await res.json()) as {
        ok?: boolean
        created?: number
        updated?: number
        error?: string
      }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Import failed')
      const listRes = await fetch(`/api/entities/${type}${q}`)
      const listData = (await listRes.json()) as { rows?: Record<string, unknown>[] }
      setRows(listData.rows ?? [])
      setNotice(`Imported: ${data.created ?? 0} added, ${data.updated ?? 0} updated`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  function openNew() {
    const f: FormState = {}
    for (const fld of fields) {
      f[fld.name] = fld.kind === 'boolean' ? 'false' : JSON_KINDS.includes(fld.kind) ? '[]' : ''
    }
    setForm(f)
    setError(null)
    setMode('new')
  }

  function openEdit(row: Record<string, unknown>) {
    const f: FormState = {}
    for (const fld of fields) f[fld.name] = toFormValue(fld, row[fld.name])
    setForm(f)
    setError(null)
    setMode({ edit: String(row[idField]) })
  }

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const body: Record<string, unknown> = {}
      for (const fld of fields) body[fld.name] = fromFormValue(fld, form[fld.name] ?? '')
      const isNew = mode === 'new'
      const url = isNew
        ? `/api/entities/${type}${q}`
        : `/api/entities/${type}/${encodeURIComponent((mode as { edit: string }).edit)}${q}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { row?: Record<string, unknown>; error?: string }
      if (!res.ok || !data.row) throw new Error(data.error || 'Save failed')
      setRows((prev) => {
        if (isNew) return [...prev, data.row!]
        return prev.map((r) => (String(r[idField]) === (mode as { edit: string }).edit ? data.row! : r))
      })
      setMode(null)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm(`Delete "${id}"? This cannot be undone.`)) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/entities/${type}/${encodeURIComponent(id)}${q}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed')
      setRows((prev) => prev.filter((r) => String(r[idField]) !== id))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <Link
        href={`/s/${scheduleId}/inputs`}
        className="inline-flex items-center gap-1 text-sm text-cck-muted hover:text-cck-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Set up inputs
      </Link>
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">{title}</h1>
          <p className="text-sm text-cck-muted mt-1">
            {rows.length} record{rows.length === 1 ? '' : 's'}
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy || mode !== null}
            className="btn-secondary"
          >
            Import spreadsheet
          </button>
          <button onClick={openNew} disabled={busy || mode !== null} className="btn-primary">
            + Add
          </button>
        </div>
      </header>

      {error && (
        <div className="border border-cck-red rounded-md bg-white px-3 py-2 text-sm text-cck-red">
          {error}
        </div>
      )}
      {notice && (
        <div className="border border-cck-line rounded-md bg-white px-3 py-2 text-sm text-cck-muted">
          {notice}
        </div>
      )}

      {mode !== null && (
        <div className="border border-cck-line rounded-md bg-white p-4 space-y-3">
          <div className="font-semibold text-sm">
            {mode === 'new' ? 'New record' : `Edit ${(mode as { edit: string }).edit}`}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((fld) => {
              const locked = !!fld.idField && mode !== 'new'
              const val = form[fld.name] ?? ''
              return (
                <label key={fld.name} className="text-sm space-y-1 block">
                  <span className="text-cck-muted">
                    {fld.label}
                    {fld.idField ? ' (id)' : ''}
                  </span>
                  {fld.kind === 'select' ? (
                    <select
                      className="w-full border border-cck-line rounded px-2 py-1"
                      value={val}
                      disabled={locked}
                      onChange={(e) => setForm({ ...form, [fld.name]: e.target.value })}
                    >
                      <option value="">-</option>
                      {(fld.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : fld.kind === 'boolean' ? (
                    <select
                      className="w-full border border-cck-line rounded px-2 py-1"
                      value={val || 'false'}
                      onChange={(e) => setForm({ ...form, [fld.name]: e.target.value })}
                    >
                      <option value="false">no</option>
                      <option value="true">yes</option>
                    </select>
                  ) : fld.kind === 'tags' ? (
                    <ChipInput
                      value={val ? val.split(',').map((s) => s.trim()).filter(Boolean) : []}
                      onChange={(arr) => setForm({ ...form, [fld.name]: arr.join(', ') })}
                      placeholder="type a value, then Enter"
                    />
                  ) : fld.kind === 'semester-blocks' ? (
                    <SemesterBlocksEditor
                      value={parseJson(val) as never}
                      onChange={(v) => setForm({ ...form, [fld.name]: JSON.stringify(v) })}
                    />
                  ) : fld.kind === 'availability-windows' ? (
                    <AvailabilityWindowsEditor
                      value={parseJson(val) as never}
                      onChange={(v) => setForm({ ...form, [fld.name]: JSON.stringify(v) })}
                    />
                  ) : fld.kind === 'json' ? (
                    <textarea
                      className="w-full border border-cck-line rounded px-2 py-1 font-mono text-xs"
                      rows={4}
                      value={val}
                      onChange={(e) => setForm({ ...form, [fld.name]: e.target.value })}
                    />
                  ) : (
                    <input
                      className="w-full border border-cck-line rounded px-2 py-1 disabled:bg-cck-line-soft"
                      type={fld.kind === 'number' ? 'number' : 'text'}
                      value={val}
                      disabled={locked}
                      onChange={(e) => setForm({ ...form, [fld.name]: e.target.value })}
                    />
                  )}
                </label>
              )
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save'}
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
              {fields.map((f) => (
                <th key={f.name}>{f.label}</th>
              ))}
              {(computedColumns ?? []).map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const id = String(row[idField])
              const comp = computed?.[id] ?? {}
              return (
                <tr key={id}>
                  {fields.map((f) => (
                    <td key={f.name}>{display(f, row[f.name])}</td>
                  ))}
                  {(computedColumns ?? []).map((c) => (
                    <td key={c.key}>{comp[c.key] ?? '-'}</td>
                  ))}
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => openEdit(row)}
                      disabled={busy || mode !== null}
                      className="text-sm text-cck-red hover:underline disabled:opacity-40 disabled:no-underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => remove(id)}
                      disabled={busy || mode !== null}
                      className="text-sm text-cck-muted hover:underline ml-3 disabled:opacity-40 disabled:no-underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

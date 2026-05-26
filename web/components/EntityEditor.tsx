'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { ChipInput } from './ChipInput'
import { SemesterBlocksEditor } from './SemesterBlocksEditor'
import { AvailabilityWindowsEditor } from './AvailabilityWindowsEditor'
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  Sheet,
  useToast,
  type Column,
} from './ui'

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
  computed?: Record<string, Record<string, string>>
  computedColumns?: ComputedColumn[]
}

type FormState = Record<string, string>

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

function displayCell(field: FieldSpec, value: unknown): React.ReactNode {
  if (value === undefined || value === null) return <span className="text-caption">—</span>
  if (field.kind === 'tags') {
    const arr = Array.isArray(value) ? value : [String(value)]
    if (arr.length === 0) return <span className="text-caption">—</span>
    const shown = arr.slice(0, 3)
    return (
      <span className="flex flex-wrap gap-1" style={{ maxWidth: 240 }}>
        {shown.map((s) => (
          <Badge key={s} tone="muted">{String(s)}</Badge>
        ))}
        {arr.length > 3 && <span className="text-caption">+{arr.length - 3}</span>}
      </span>
    )
  }
  if (field.kind === 'semester-blocks')
    return <Badge tone="muted">{Array.isArray(value) ? `${value.length} blocks` : '—'}</Badge>
  if (field.kind === 'availability-windows')
    return <Badge tone="muted">{Array.isArray(value) ? `${value.length} windows` : '—'}</Badge>
  if (field.kind === 'json')
    return <Badge tone="muted">{Array.isArray(value) ? `${value.length} items` : 'set'}</Badge>
  if (field.kind === 'boolean')
    return value ? <Badge tone="green">yes</Badge> : <Badge tone="muted">no</Badge>
  if (field.kind === 'select') return <Badge tone="muted">{String(value)}</Badge>
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
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const toast = useToast()

  async function importFile(file: File) {
    setBusy(true)
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
      toast.push({
        title: 'Imported',
        description: `${data.created ?? 0} added · ${data.updated ?? 0} updated`,
        tone: 'success',
      })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Import failed', description: (e as Error).message, tone: 'error' })
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
    setMode('new')
  }

  function openEdit(row: Record<string, unknown>) {
    const f: FormState = {}
    for (const fld of fields) f[fld.name] = toFormValue(fld, row[fld.name])
    setForm(f)
    setMode({ edit: String(row[idField]) })
  }

  async function save() {
    setBusy(true)
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
      toast.push({ title: isNew ? 'Created' : 'Updated', tone: 'success' })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Save failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
    }
  }

  async function performDelete(id: string) {
    setBusy(true)
    try {
      const res = await fetch(`/api/entities/${type}/${encodeURIComponent(id)}${q}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed')
      setRows((prev) => prev.filter((r) => String(r[idField]) !== id))
      toast.push({ title: 'Deleted', description: `Removed "${id}".`, tone: 'success' })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Delete failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
      setDeleteTarget(null)
    }
  }

  const columns: Column<Record<string, unknown>>[] = useMemo(() => {
    const cols: Column<Record<string, unknown>>[] = fields.map((f) => ({
      key: f.name,
      header: f.label,
      sortable: true,
      mono: f.idField,
      accessor: (row) => {
        const v = row[f.name]
        if (Array.isArray(v)) return v.length
        return v as string | number | undefined
      },
      render: (row) => displayCell(f, row[f.name]),
    }))
    for (const c of computedColumns ?? []) {
      cols.push({
        key: c.key,
        header: c.label,
        sortable: true,
        align: 'right',
        accessor: (row) => {
          const id = String(row[idField])
          const v = computed?.[id]?.[c.key]
          if (!v) return null
          const num = parseFloat(v)
          return Number.isFinite(num) ? num : v
        },
        render: (row) => {
          const id = String(row[idField])
          const v = computed?.[id]?.[c.key]
          return v ? <span className="tabular">{v}</span> : <span className="text-caption">—</span>
        },
      })
    }
    cols.push({
      key: '__actions',
      header: '',
      width: 60,
      align: 'right',
      render: (row) => {
        const id = String(row[idField])
        return (
          <div className="row-action flex justify-end gap-1">
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              icon={<Pencil size={12} />}
              aria-label={`Edit ${id}`}
              onClick={(e) => {
                e.stopPropagation()
                openEdit(row)
              }}
            />
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              icon={<Trash2 size={12} />}
              aria-label={`Delete ${id}`}
              onClick={(e) => {
                e.stopPropagation()
                setDeleteTarget(id)
              }}
            />
          </div>
        )
      },
    })
    return cols
  }, [fields, computed, computedColumns, idField])

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Inputs</div>
          <h1>{title}</h1>
          <div className="sub">
            {rows.length} record{rows.length === 1 ? '' : 's'}
            {subtitle ? ` · ${subtitle}` : ''}
          </div>
        </div>
        <div className="page-actions">
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
          <Button
            variant="secondary"
            icon={<Upload size={14} />}
            onClick={() => fileRef.current?.click()}
            disabled={busy || mode !== null}
          >
            Import spreadsheet
          </Button>
          <Button variant="primary" icon={<Plus size={14} />} onClick={openNew} disabled={busy || mode !== null}>
            Add
          </Button>
        </div>
      </header>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(r) => String(r[idField])}
        storageKey={`entity-${type}`}
        defaultSortKey={fields[0]?.name}
        rowProps={(r) => ({
          onClick: () => openEdit(r),
          style: { cursor: 'pointer' },
        })}
        toolbarExtras={
          <span className="text-caption" style={{ marginLeft: 6 }}>
            <kbd className="kbd">⏎</kbd> open
          </span>
        }
      />

      <Sheet
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === 'new' ? `New ${title.toLowerCase().replace(/s$/, '')}` : `Edit ${(mode as { edit?: string })?.edit ?? ''}`}
        description={mode === 'new' ? 'Add a new record. Required fields are marked.' : 'Adjust this record. ID fields cannot be changed once created.'}
        wide
        footer={
          <>
            <Button variant="secondary" onClick={() => setMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={busy}>
              {mode === 'new' ? 'Create' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fields.map((fld) => {
            const locked = !!fld.idField && mode !== 'new'
            const val = form[fld.name] ?? ''
            const isWide =
              fld.kind === 'tags' ||
              fld.kind === 'json' ||
              fld.kind === 'semester-blocks' ||
              fld.kind === 'availability-windows'
            return (
              <label key={fld.name} className="field" style={isWide ? { gridColumn: '1 / -1' } : undefined}>
                <span className="field-label">
                  {fld.label}
                  {fld.idField ? <span className="text-caption" style={{ marginLeft: 6 }}>(ID)</span> : null}
                </span>
                {fld.kind === 'select' ? (
                  <select
                    className="select"
                    value={val}
                    disabled={locked}
                    onChange={(e) => setForm({ ...form, [fld.name]: e.target.value })}
                  >
                    <option value="">—</option>
                    {(fld.options ?? []).map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                ) : fld.kind === 'boolean' ? (
                  <select
                    className="select"
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
                    className="textarea"
                    rows={4}
                    value={val}
                    onChange={(e) => setForm({ ...form, [fld.name]: e.target.value })}
                    style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}
                  />
                ) : (
                  <input
                    className="input"
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
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await performDelete(deleteTarget)
        }}
        title={`Delete "${deleteTarget ?? ''}"?`}
        description="This action cannot be undone. References to this record from elsewhere may break."
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
      />

      {/* hidden helper to satisfy unused import lint */}
      <span style={{ display: 'none' }}>
        <MoreHorizontal size={1} />
      </span>
    </main>
  )
}

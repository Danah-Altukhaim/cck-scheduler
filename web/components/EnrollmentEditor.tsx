'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Trash2, Upload, UserPlus } from 'lucide-react'
import type { EnrollmentRecord } from '../lib/data'
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

interface MajorOption {
  program_code: string
  name: string
}

const LANGUAGES = [
  { value: 'both', label: 'Both' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
]

interface FormState {
  major: string
  language: string
  working_student: boolean
  puc: boolean
  count: number
}

export function EnrollmentEditor({
  scheduleId,
  initialRows,
  majors,
}: {
  scheduleId: string
  initialRows: EnrollmentRecord[]
  majors: MajorOption[]
}) {
  const [rows, setRows] = useState<EnrollmentRecord[]>(initialRows)
  const [mode, setMode] = useState<null | 'new' | { edit: string }>(null)
  const [form, setForm] = useState<FormState>({
    major: '',
    language: 'both',
    working_student: false,
    puc: true,
    count: 0,
  })
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const toast = useToast()
  const q = `?schedule=${encodeURIComponent(scheduleId)}`

  const majorName = (code: string) => majors.find((m) => m.program_code === code)?.name ?? code
  const total = rows.reduce((s, r) => s + (r.count || 0), 0)

  async function importFile(file: File) {
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/enrollment/import${q}`, { method: 'POST', body: fd })
      const data = (await res.json()) as { ok?: boolean; imported?: number; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Import failed')
      const listRes = await fetch(`/api/enrollment${q}`)
      const listData = (await listRes.json()) as { rows?: EnrollmentRecord[] }
      setRows(listData.rows ?? [])
      toast.push({
        title: 'Enrollment imported',
        description: `${data.imported ?? 0} row(s) loaded.`,
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
    setForm({
      major: majors[0]?.program_code ?? '',
      language: 'both',
      working_student: false,
      puc: true,
      count: 0,
    })
    setMode('new')
  }

  function openEdit(r: EnrollmentRecord) {
    setForm({
      major: r.major,
      language: r.language,
      working_student: r.working_student,
      puc: r.puc,
      count: r.count,
    })
    setMode({ edit: r.id })
  }

  async function save() {
    if (!form.major || form.count < 0) return
    setBusy(true)
    try {
      const isNew = mode === 'new'
      const url = isNew ? `/api/enrollment${q}` : `/api/enrollment/${(mode as { edit: string }).edit}${q}`
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = (await res.json()) as { row?: EnrollmentRecord; error?: string }
      if (!res.ok || !data.row) throw new Error(data.error || 'Save failed')
      setRows((prev) =>
        isNew ? [...prev, data.row!] : prev.map((r) => (r.id === data.row!.id ? data.row! : r)),
      )
      setMode(null)
      toast.push({ title: isNew ? 'Row added' : 'Row updated', tone: 'success' })
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
      const res = await fetch(`/api/enrollment/${id}${q}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRows((prev) => prev.filter((r) => r.id !== id))
      toast.push({ title: 'Row deleted', tone: 'success' })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Delete failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
      setDeleteTarget(null)
    }
  }

  const columns: Column<EnrollmentRecord>[] = useMemo(
    () => [
      {
        key: 'major',
        header: 'Major',
        sortable: true,
        accessor: (r) => majorName(r.major),
        render: (r) => <div style={{ fontWeight: 600 }}>{majorName(r.major)}</div>,
      },
      {
        key: 'language',
        header: 'Language',
        sortable: true,
        width: 110,
        accessor: (r) => r.language,
        render: (r) => (
          <Badge tone="muted">
            {LANGUAGES.find((l) => l.value === r.language)?.label ?? r.language}
          </Badge>
        ),
      },
      {
        key: 'working',
        header: 'Profile',
        sortable: true,
        width: 110,
        accessor: (r) => (r.working_student ? 'working' : 'daytime'),
        render: (r) => (
          <Badge tone={r.working_student ? 'amber' : 'muted'}>
            {r.working_student ? 'working' : 'daytime'}
          </Badge>
        ),
      },
      {
        key: 'puc',
        header: 'Funding',
        sortable: true,
        width: 110,
        accessor: (r) => (r.puc ? 'puc' : 'self'),
        render: (r) => <Badge tone="muted">{r.puc ? 'PUC' : 'self'}</Badge>,
      },
      {
        key: 'count',
        header: 'Students',
        sortable: true,
        align: 'right',
        width: 90,
        accessor: (r) => r.count,
        render: (r) => <span className="tabular">{r.count}</span>,
      },
      {
        key: '__actions',
        header: '',
        align: 'right',
        width: 80,
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
                setDeleteTarget(r.id)
              }}
            />
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [majors],
  )

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Inputs</div>
          <h1>Enrollment</h1>
          <div className="sub">
            Projected students this term, by major and profile · {rows.length} row{rows.length === 1 ? '' : 's'} · {total.toLocaleString()} students total. This drives how many sections open.
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
            Add enrollment
          </Button>
        </div>
      </header>

      {rows.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<UserPlus size={22} />}
            title="No enrollment entered"
            description="Until you add rows or upload a sheet, demand is estimated from the previous term's schedule."
            actions={
              <Button variant="primary" icon={<Plus size={14} />} onClick={openNew}>
                Add first row
              </Button>
            }
          />
        </div>
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(r) => r.id}
          storageKey="enrollment"
          defaultSortKey="major"
          rowProps={(r) => ({
            onClick: () => openEdit(r),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      <Sheet
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === 'new' ? 'New enrollment row' : 'Edit enrollment row'}
        description="Each row says how many students of a given major/language profile to expect this term."
        footer={
          <>
            <Button variant="secondary" onClick={() => setMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" onClick={save} loading={busy} disabled={!form.major || form.count < 0}>
              {mode === 'new' ? 'Add row' : 'Save changes'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="field">
            <span className="field-label">Major</span>
            <select className="select" value={form.major} onChange={(e) => setForm({ ...form, major: e.target.value })}>
              {majors.length === 0 && <option value="">(no majors)</option>}
              {majors.map((m) => (
                <option key={m.program_code} value={m.program_code}>{m.name}</option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              <span className="field-label">Language</span>
              <select className="select" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span className="field-label">Student count</span>
              <input
                type="number"
                min={0}
                className="input"
                value={form.count}
                onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
              />
            </label>
            <label className="field">
              <span className="field-label">Profile</span>
              <select
                className="select"
                value={form.working_student ? 'yes' : 'no'}
                onChange={(e) => setForm({ ...form, working_student: e.target.value === 'yes' })}
              >
                <option value="no">Daytime students</option>
                <option value="yes">Working — need evening sections</option>
              </select>
            </label>
            <label className="field">
              <span className="field-label">Funding</span>
              <select
                className="select"
                value={form.puc ? 'puc' : 'self'}
                onChange={(e) => setForm({ ...form, puc: e.target.value === 'puc' })}
              >
                <option value="puc">PUC-funded</option>
                <option value="self">Self-funded</option>
              </select>
            </label>
          </div>
        </div>
      </Sheet>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await performDelete(deleteTarget)
        }}
        title="Delete this enrollment row?"
        description="The forecast for this group will be removed from the term plan."
        confirmLabel="Delete"
        tone="danger"
        busy={busy}
      />
    </main>
  )
}

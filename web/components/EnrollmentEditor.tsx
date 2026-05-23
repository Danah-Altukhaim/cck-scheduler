'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Upload } from 'lucide-react'
import type { EnrollmentRecord } from '../lib/data'

interface MajorOption {
  program_code: string
  name: string
}

const LANGUAGES = [
  { value: 'both', label: 'Both' },
  { value: 'en', label: 'English' },
  { value: 'ar', label: 'Arabic' },
]

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
  const [form, setForm] = useState({
    major: '',
    language: 'both',
    working_student: false,
    puc: true,
    count: 0,
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const q = `?schedule=${encodeURIComponent(scheduleId)}`

  async function importFile(file: File) {
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/enrollment/import${q}`, { method: 'POST', body: fd })
      const data = (await res.json()) as { ok?: boolean; imported?: number; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Import failed')
      const listRes = await fetch(`/api/enrollment${q}`)
      const listData = (await listRes.json()) as { rows?: EnrollmentRecord[] }
      setRows(listData.rows ?? [])
      setNotice(`Imported ${data.imported ?? 0} enrollment row(s) from the sheet.`)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setBusy(false)
    }
  }

  const majorName = (code: string) => majors.find((m) => m.program_code === code)?.name ?? code
  const total = rows.reduce((s, r) => s + (r.count || 0), 0)

  function openNew() {
    setForm({
      major: majors[0]?.program_code ?? '',
      language: 'both',
      working_student: false,
      puc: true,
      count: 0,
    })
    setError(null)
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
    setError(null)
    setMode({ edit: r.id })
  }

  async function save() {
    setBusy(true)
    setError(null)
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
        isNew
          ? [...prev, data.row!]
          : prev.map((r) => (r.id === data.row!.id ? data.row! : r)),
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
    if (!confirm('Delete this enrollment row?')) return
    setBusy(true)
    try {
      await fetch(`/api/enrollment/${id}${q}`, { method: 'DELETE' })
      setRows((prev) => prev.filter((r) => r.id !== id))
      router.refresh()
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
          <h1 className="text-2xl font-bold">Enrollment</h1>
          <p className="text-sm text-cck-muted mt-1">
            Projected students this term, by major and profile: {rows.length} row
            {rows.length === 1 ? '' : 's'}, {total} students total. This drives how many sections
            open.
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
            <Upload className="h-4 w-4" /> Upload sheet
          </button>
          <button onClick={openNew} disabled={busy || mode !== null} className="btn-primary">
            + Add enrollment
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
        <div className="card p-4 space-y-3">
          <div className="font-semibold text-sm">
            {mode === 'new' ? 'New enrollment row' : 'Edit enrollment row'}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Major</span>
              <select
                className="w-full border border-cck-line rounded-lg px-2 py-1.5 bg-white"
                value={form.major}
                onChange={(e) => setForm({ ...form, major: e.target.value })}
              >
                {majors.length === 0 && <option value="">(no majors)</option>}
                {majors.map((m) => (
                  <option key={m.program_code} value={m.program_code}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Language</span>
              <select
                className="w-full border border-cck-line rounded-lg px-2 py-1.5 bg-white"
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Student count</span>
              <input
                type="number"
                min={0}
                className="w-full border border-cck-line rounded-lg px-2 py-1.5"
                value={form.count}
                onChange={(e) => setForm({ ...form, count: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Working students</span>
              <select
                className="w-full border border-cck-line rounded-lg px-2 py-1.5 bg-white"
                value={form.working_student ? 'yes' : 'no'}
                onChange={(e) => setForm({ ...form, working_student: e.target.value === 'yes' })}
              >
                <option value="no">No (daytime students)</option>
                <option value="yes">Yes (need evening sections)</option>
              </select>
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Funding</span>
              <select
                className="w-full border border-cck-line rounded-lg px-2 py-1.5 bg-white"
                value={form.puc ? 'puc' : 'self'}
                onChange={(e) => setForm({ ...form, puc: e.target.value === 'puc' })}
              >
                <option value="puc">PUC-funded</option>
                <option value="self">Self-funded</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !form.major} className="btn-primary">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setMode(null)} disabled={busy} className="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="cck">
          <thead>
            <tr>
              <th>Major</th>
              <th>Language</th>
              <th>Working</th>
              <th>Funding</th>
              <th className="num" style={{ textAlign: 'right' }}>Students</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="text-sm text-cck-muted">
                  No enrollment entered yet. Until you add rows, demand is estimated from last
                  term&apos;s schedule.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{majorName(r.major)}</td>
                <td>{LANGUAGES.find((l) => l.value === r.language)?.label ?? r.language}</td>
                <td>
                  <span className={`badge ${r.working_student ? 'amber' : 'muted'}`}>
                    {r.working_student ? 'working' : 'daytime'}
                  </span>
                </td>
                <td>
                  <span className="badge muted">{r.puc ? 'PUC' : 'self-funded'}</span>
                </td>
                <td className="num" style={{ textAlign: 'right' }}>{r.count}</td>
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
    </div>
  )
}

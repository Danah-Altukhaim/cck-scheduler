'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ManualSection } from '@/lib/data'
import type { Day } from '@/lib/format'
import { DAY_LABEL, OPERATING_DAYS, minToHHMM } from '@/lib/format'

interface CourseLite {
  code: string
  name_en: string
}
interface InstructorLite {
  id: string
  name: string
}
interface RoomLite {
  code: string
  display_name: string
  capacity: number
}

interface Props {
  scheduleId: string
  initial: ManualSection[]
  courses: CourseLite[]
  instructors: InstructorLite[]
  rooms: RoomLite[]
}

// HH:MM → minutes since 00:00
function parseHM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1]!)
  const mi = Number(m[2]!)
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return null
  return h * 60 + mi
}

const EMPTY = {
  course_code: '',
  language: 'en' as 'en' | 'ar' | 'both',
  enrollment_cap: 1,
  reason: '',
  day: 'Su' as Day,
  start_hhmm: '09:00',
  end_hhmm: '10:15',
  room_code: '',
  instructor_id: '',
}

export function ManualSectionsEditor({
  scheduleId,
  initial,
  courses,
  instructors,
  rooms,
}: Props) {
  const q = `?schedule=${encodeURIComponent(scheduleId)}`
  const router = useRouter()
  const [rows, setRows] = useState<ManualSection[]>(initial)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setBusy(true)
    setError(null)
    try {
      const start_min = parseHM(form.start_hhmm)
      const end_min = parseHM(form.end_hhmm)
      if (start_min === null || end_min === null) throw new Error('Invalid time (use HH:MM)')
      if (end_min <= start_min) throw new Error('End time must be after start time')
      const body: Omit<ManualSection, 'id'> = {
        course_code: form.course_code,
        language: form.language,
        enrollment_cap: Number(form.enrollment_cap) || 1,
        reason: form.reason || undefined,
        day: form.day,
        start_min,
        end_min,
        room_code: form.room_code,
        instructor_id: form.instructor_id,
      }
      const res = await fetch(`/api/manual-sections${q}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = (await res.json()) as { row?: ManualSection; error?: string }
      if (!res.ok || !data.row) throw new Error(data.error || 'Save failed')
      setRows((p) => [...p, data.row!])
      setOpen(false)
      setForm(EMPTY)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this independent section?')) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(`/api/manual-sections/${encodeURIComponent(id)}${q}`, {
        method: 'DELETE',
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !data.ok) throw new Error(data.error || 'Delete failed')
      setRows((p) => p.filter((r) => r.id !== id))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  const courseMap = new Map(courses.map((c) => [c.code, c]))
  const instMap = new Map(instructors.map((i) => [i.id, i]))

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-semibold">Independent sections</h2>
          <p className="text-sm text-cck-muted">
            Customized sections for students who need an off-pattern placement. Pinned: the solver
            keeps these in place and schedules around them.
          </p>
        </div>
        <button
          onClick={() => {
            setOpen(true)
            setError(null)
          }}
          disabled={busy || open}
          className="btn-primary"
        >
          + Add independent section
        </button>
      </div>

      {error && (
        <div className="border border-cck-red rounded-md bg-white px-3 py-2 text-sm text-cck-red">
          {error}
        </div>
      )}

      {open && (
        <div className="border border-cck-line rounded-md bg-white p-4 space-y-3">
          <div className="font-semibold text-sm">New independent section</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Course</span>
              <select
                className="w-full border border-cck-line rounded px-2 py-1"
                value={form.course_code}
                onChange={(e) => setForm({ ...form, course_code: e.target.value })}
              >
                <option value="">— select —</option>
                {courses.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name_en}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Language</span>
              <select
                className="w-full border border-cck-line rounded px-2 py-1"
                value={form.language}
                onChange={(e) =>
                  setForm({ ...form, language: e.target.value as 'en' | 'ar' | 'both' })
                }
              >
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Cap</span>
              <input
                type="number"
                min={1}
                className="w-full border border-cck-line rounded px-2 py-1"
                value={form.enrollment_cap}
                onChange={(e) => setForm({ ...form, enrollment_cap: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Day</span>
              <select
                className="w-full border border-cck-line rounded px-2 py-1"
                value={form.day}
                onChange={(e) => setForm({ ...form, day: e.target.value as Day })}
              >
                {OPERATING_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {DAY_LABEL[d]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Start (HH:MM)</span>
              <input
                className="w-full border border-cck-line rounded px-2 py-1"
                value={form.start_hhmm}
                onChange={(e) => setForm({ ...form, start_hhmm: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">End (HH:MM)</span>
              <input
                className="w-full border border-cck-line rounded px-2 py-1"
                value={form.end_hhmm}
                onChange={(e) => setForm({ ...form, end_hhmm: e.target.value })}
              />
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Room</span>
              <select
                className="w-full border border-cck-line rounded px-2 py-1"
                value={form.room_code}
                onChange={(e) => setForm({ ...form, room_code: e.target.value })}
              >
                <option value="">— select —</option>
                {rooms.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.display_name} ({r.capacity})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1 block">
              <span className="text-cck-muted">Instructor</span>
              <select
                className="w-full border border-cck-line rounded px-2 py-1"
                value={form.instructor_id}
                onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}
              >
                <option value="">— select —</option>
                {instructors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1 block md:col-span-2 lg:col-span-3">
              <span className="text-cck-muted">Reason (optional)</span>
              <input
                className="w-full border border-cck-line rounded px-2 py-1"
                placeholder="e.g. Independent study for John Doe (graduating senior)"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy} className="btn-primary">
              {busy ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => {
                setOpen(false)
                setForm(EMPTY)
              }}
              disabled={busy}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="border border-cck-line rounded-md bg-white overflow-x-auto">
          <table className="cck">
            <thead>
              <tr>
                <th>Course</th>
                <th>Lang</th>
                <th>Cap</th>
                <th>Day</th>
                <th>Time</th>
                <th>Room</th>
                <th>Instructor</th>
                <th>Reason</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div className="font-medium">{r.course_code}</div>
                    <div className="text-xs text-cck-muted">
                      {courseMap.get(r.course_code)?.name_en ?? ''}
                    </div>
                  </td>
                  <td>{r.language}</td>
                  <td className="num" style={{ textAlign: 'right' }}>
                    {r.enrollment_cap}
                  </td>
                  <td>{DAY_LABEL[r.day]}</td>
                  <td>
                    {minToHHMM(r.start_min)}–{minToHHMM(r.end_min)}
                  </td>
                  <td>{r.room_code}</td>
                  <td>{instMap.get(r.instructor_id)?.name ?? r.instructor_id}</td>
                  <td className="text-xs text-cck-muted">{r.reason ?? ''}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busy}
                      className="text-sm text-cck-muted hover:underline disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

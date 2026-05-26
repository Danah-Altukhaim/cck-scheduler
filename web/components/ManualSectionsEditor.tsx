'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import type { ManualSection } from '@/lib/data'
import { DAY_LABEL, OPERATING_DAYS, minToHHMM, type Day } from '@/lib/format'
import { Badge, Button, ConfirmDialog, Dialog, useToast } from './ui'

interface CourseLite { code: string; name_en: string }
interface InstructorLite { id: string; name: string }
interface RoomLite { code: string; display_name: string; capacity: number }

interface Props {
  scheduleId: string
  initial: ManualSection[]
  courses: CourseLite[]
  instructors: InstructorLite[]
  rooms: RoomLite[]
}

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
  const toast = useToast()
  const [rows, setRows] = useState<ManualSection[]>(initial)
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [busy, setBusy] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ManualSection | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  async function save() {
    setValidationError(null)
    setBusy(true)
    try {
      const start_min = parseHM(form.start_hhmm)
      const end_min = parseHM(form.end_hhmm)
      if (start_min === null || end_min === null) throw new Error('Invalid time format (use HH:MM)')
      if (end_min <= start_min) throw new Error('End time must be after start time')
      const room = rooms.find((r) => r.code === form.room_code)
      if (room && form.enrollment_cap > room.capacity) {
        throw new Error(`Cap (${form.enrollment_cap}) exceeds room capacity (${room.capacity})`)
      }
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
      toast.push({ title: 'Section added', tone: 'success' })
      router.refresh()
    } catch (e) {
      setValidationError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function performDelete(r: ManualSection) {
    setBusy(true)
    try {
      const res = await fetch(`/api/manual-sections/${encodeURIComponent(r.id)}${q}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Delete failed')
      setRows((p) => p.filter((x) => x.id !== r.id))
      toast.push({ title: 'Section removed', tone: 'success' })
      router.refresh()
    } catch (e) {
      toast.push({ title: 'Delete failed', description: (e as Error).message, tone: 'error' })
    } finally {
      setBusy(false)
      setDeleteTarget(null)
    }
  }

  const courseMap = new Map(courses.map((c) => [c.code, c]))
  const instMap = new Map(instructors.map((i) => [i.id, i]))

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <div>
          <h2 className="text-h2">Independent sections</h2>
          <p className="text-caption" style={{ marginTop: 4 }}>
            Customized sections for students who need an off-pattern placement. The solver pins these and schedules around them.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={14} />} onClick={() => { setOpen(true); setValidationError(null) }}>
          Add independent section
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="card-flat" style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
          <span className="text-body-sm">No independent sections yet.</span>
        </div>
      ) : (
        <div className="card-flat" style={{ overflow: 'auto' }}>
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
                <th style={{ width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.course_code}</div>
                    <div className="text-caption">{courseMap.get(r.course_code)?.name_en}</div>
                  </td>
                  <td><Badge tone="muted">{r.language}</Badge></td>
                  <td className="num">{r.enrollment_cap}</td>
                  <td>{DAY_LABEL[r.day]}</td>
                  <td className="tabular">{minToHHMM(r.start_min)}–{minToHHMM(r.end_min)}</td>
                  <td>{r.room_code}</td>
                  <td>{instMap.get(r.instructor_id)?.name ?? r.instructor_id}</td>
                  <td className="text-caption">{r.reason ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Button
                      size="sm"
                      variant="ghost"
                      iconOnly
                      icon={<Trash2 size={12} />}
                      aria-label="Remove"
                      onClick={() => setDeleteTarget(r)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="New independent section"
        description="The solver will pin this section in place and route around it."
        width="wide"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button
              variant="primary"
              onClick={save}
              loading={busy}
              disabled={!form.course_code || !form.room_code || !form.instructor_id}
            >
              Add section
            </Button>
          </>
        }
      >
        {validationError && (
          <div
            className="card-flat"
            style={{
              padding: '8px 12px',
              marginBottom: 12,
              background: 'var(--danger-soft)',
              borderColor: 'var(--danger-strong)',
              color: 'var(--cck-red-dark)',
              fontSize: 13,
            }}
          >
            {validationError}
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="field md:col-span-2">
            <span className="field-label">Course</span>
            <select
              className="select"
              value={form.course_code}
              onChange={(e) => setForm({ ...form, course_code: e.target.value })}
            >
              <option value="">— select —</option>
              {courses.map((c) => (
                <option key={c.code} value={c.code}>{c.code} · {c.name_en}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Cap</span>
            <input
              type="number"
              min={1}
              className="input"
              value={form.enrollment_cap}
              onChange={(e) => setForm({ ...form, enrollment_cap: Number(e.target.value) })}
            />
          </label>
          <label className="field">
            <span className="field-label">Language</span>
            <select
              className="select"
              value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value as 'en' | 'ar' | 'both' })}
            >
              <option value="en">English</option>
              <option value="ar">Arabic</option>
              <option value="both">Both</option>
            </select>
          </label>
          <label className="field">
            <span className="field-label">Day</span>
            <select
              className="select"
              value={form.day}
              onChange={(e) => setForm({ ...form, day: e.target.value as Day })}
            >
              {OPERATING_DAYS.map((d) => (
                <option key={d} value={d}>{DAY_LABEL[d]}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">Start time</span>
            <input
              type="time"
              className="input"
              value={form.start_hhmm}
              onChange={(e) => setForm({ ...form, start_hhmm: e.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">End time</span>
            <input
              type="time"
              className="input"
              value={form.end_hhmm}
              onChange={(e) => setForm({ ...form, end_hhmm: e.target.value })}
            />
          </label>
          <label className="field md:col-span-2">
            <span className="field-label">Room</span>
            <select
              className="select"
              value={form.room_code}
              onChange={(e) => setForm({ ...form, room_code: e.target.value })}
            >
              <option value="">— select —</option>
              {rooms.map((r) => (
                <option key={r.code} value={r.code}>{r.display_name} (cap {r.capacity})</option>
              ))}
            </select>
          </label>
          <label className="field md:col-span-3">
            <span className="field-label">Instructor</span>
            <select
              className="select"
              value={form.instructor_id}
              onChange={(e) => setForm({ ...form, instructor_id: e.target.value })}
            >
              <option value="">— select —</option>
              {instructors.map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </label>
          <label className="field md:col-span-3">
            <span className="field-label">Reason (optional)</span>
            <input
              className="input"
              placeholder="e.g. Independent study for John Doe (graduating senior)"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
            <span className="field-hint">Free-text note that travels with this section in the schedule export.</span>
          </label>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget) await performDelete(deleteTarget)
        }}
        title="Remove this independent section?"
        description="The solver will no longer pin it; you can re-add it later if needed."
        confirmLabel="Remove"
        tone="danger"
        busy={busy}
      />
    </section>
  )
}

// Small helpers shared across ingestion parsers and the solver.

import type { Day, IngestWarning } from '../model/types.js'

// Strip prefixes (Mr./Mrs./Dr./Ms./Mr ), trailing commas, double-spaces, and
// HTML escapes that show up in the rosters (&apos; → ').
export function normalizeName(raw: string): string {
  if (!raw) return ''
  return raw
    .replace(/&apos;/g, "'")
    .replace(/’/g, "'") // curly apostrophe
    .replace(/^(Mr|Mrs|Ms|Dr)\.?\s+/i, '')
    .replace(/,$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Strip honorifics AND middle initials/short bits for fuzzy match.
// 'Mr. Mohamed Awad Farhan Sanhat' vs 'Mohamed Awad Farhan Sanhat'.
export function nameKey(raw: string): string {
  return normalizeName(raw)
    .toLowerCase()
    .replace(/[\.\,]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Build a slug-style id from a canonical name.
export function nameToId(raw: string): string {
  return nameKey(raw)
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Convert HH:MM strings (or HH:MM:SS) to absolute minute-of-day.
export function timeToMin(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(s.trim())
  if (!m) return null
  const h = Number(m[1]!)
  const mm = Number(m[2]!)
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

export function minToTime(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

// Parse a slot like '09:30-10:45' or '17:00-18:50'.
export function parseSlot(raw: string): { start_min: number; end_min: number } | null {
  if (!raw) return null
  const parts = String(raw).split('-')
  if (parts.length !== 2) return null
  const a = timeToMin(parts[0]!)
  const b = timeToMin(parts[1]!)
  if (a == null || b == null || b <= a) return null
  return { start_min: a, end_min: b }
}

// Map source-data day codes onto our enum, deduplicating ('M,Th,Th' → ['M','Th']).
const DAY_ALIASES: Record<string, Day> = {
  sa: 'Sa',
  saturday: 'Sa',
  su: 'Su',
  sun: 'Su',
  sunday: 'Su',
  m: 'M',
  mon: 'M',
  monday: 'M',
  t: 'T',
  tu: 'T',
  tue: 'T',
  tues: 'T',
  tuesday: 'T',
  w: 'W',
  wed: 'W',
  wednesday: 'W',
  th: 'Th',
  thu: 'Th',
  thur: 'Th',
  thursday: 'Th',
}
export function parseDays(raw: string): {
  days: Day[]
  warnings: { code: string; message: string }[]
} {
  const out: Day[] = []
  const warnings: { code: string; message: string }[] = []
  if (!raw) return { days: out, warnings }
  const tokens = String(raw)
    .split(/[,\s\/]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  for (const t of tokens) {
    const lower = t.toLowerCase()
    const d = DAY_ALIASES[lower]
    if (!d) {
      warnings.push({ code: 'DAY_UNKNOWN', message: `Unknown day token '${t}'` })
      continue
    }
    if (out.includes(d)) {
      warnings.push({ code: 'DAY_DUPLICATE', message: `Duplicate day '${d}' in '${raw}'` })
      continue
    }
    out.push(d)
  }
  return { days: out, warnings }
}

// Normalize a room string from a SIS row.
// Inputs we've seen: 'Building one/B2-027', 'Building one/LAB-015', 'Maple Leaf',
// 'LAB B2-031', 'B2-04'. We split on '/' and take the trailing slug, then
// uppercase and squash spaces. Returns the canonical key + the raw alias for
// the room registry.
export function normalizeRoomKey(raw: string): { key: string; raw: string } {
  const r = String(raw || '').trim()
  if (!r) return { key: '', raw: r }
  // Drop any 'Building one/' prefix.
  const stripped = r.replace(/^Building\s+one\s*\/\s*/i, '').replace(/^building\s*\/\s*/i, '')
  // 'B2-04' → 'B2-004' equivalence is room-registry's job; here we just
  // produce a canonical token: uppercase, single spaces.
  const key = stripped
    .replace(/\s+/g, ' ')
    .replace(/\s*-\s*/g, '-')
    .trim()
    .toUpperCase()
  return { key, raw: r }
}

// Convenience constructor for warnings.
export function warn(
  severity: IngestWarning['severity'],
  code: string,
  message: string,
  file?: string,
  row?: number | string,
): IngestWarning {
  const w: IngestWarning = { severity, code, message }
  if (file !== undefined) w.file = file
  if (row !== undefined) w.row = row
  return w
}

// Convert a number-or-string-or-null cell to a clean string, or null.
export function cellStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (typeof v === 'number') return String(v)
  if (typeof v === 'string') {
    const s = v.trim()
    return s.length ? s : null
  }
  return String(v)
}

export function cellNum(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  const s = String(v).trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

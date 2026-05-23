// Write layer for a schedule's term plan. `lib/data.ts` reads JSON for
// rendering; this module mutates it so the browser can manage the inputs.
//
// Each schedule's term-plan.json is the live store. Every editable entity is
// an array on the plan keyed by a unique id field.

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { clearDataCache, type TermPlan, type EnrollmentRecord, type ManualSection } from './data'
import { scheduleDir } from './paths'

// Editable entity types → the plan array they live on + their unique id field.
export const ENTITY_TYPES = {
  rooms: { key: 'rooms', idField: 'code' },
  instructors: { key: 'instructors', idField: 'id' },
  courses: { key: 'courses', idField: 'code' },
  majors: { key: 'majors', idField: 'program_code' },
  'merged-groups': { key: 'merged_groups', idField: 'id' },
} as const

export type EntityType = keyof typeof ENTITY_TYPES

// Fields that hold arrays — a spreadsheet cell for one of these is a
// comma/semicolon-separated string and must be split on import.
export const ARRAY_FIELDS: Record<EntityType, string[]> = {
  rooms: ['aliases'],
  instructors: ['certifications', 'name_aliases', 'source'],
  courses: ['certified_instructors', 'offered_languages', 'programs'],
  majors: [],
  'merged-groups': ['course_codes'],
}

// Fields that hold nested JSON — default to [] when absent on import.
export const JSON_FIELDS: Record<EntityType, string[]> = {
  rooms: [],
  instructors: ['availability_windows'],
  courses: [],
  majors: ['semester_blocks'],
  'merged-groups': [],
}

export function isEntityType(t: string): t is EntityType {
  return t in ENTITY_TYPES
}

type Row = Record<string, unknown>

function planPath(scheduleId: string): string {
  return join(scheduleDir(scheduleId), 'term-plan.json')
}

export function readPlan(scheduleId: string): TermPlan {
  return JSON.parse(readFileSync(planPath(scheduleId), 'utf8')) as TermPlan
}

export function writePlan(scheduleId: string, plan: TermPlan): void {
  writeFileSync(planPath(scheduleId), JSON.stringify(plan, null, 2))
  clearDataCache(scheduleId)
}

function rowsOf(plan: TermPlan, type: EntityType): Row[] {
  const arr = (plan as unknown as Record<string, unknown>)[ENTITY_TYPES[type].key]
  return Array.isArray(arr) ? (arr as Row[]) : []
}

export function listEntities(scheduleId: string, type: EntityType): Row[] {
  return rowsOf(readPlan(scheduleId), type)
}

export function createEntity(scheduleId: string, type: EntityType, row: Row): Row {
  const { idField } = ENTITY_TYPES[type]
  const id = row[idField]
  if (id === undefined || id === null || id === '') {
    throw new Error(`Missing "${idField}"`)
  }
  const plan = readPlan(scheduleId)
  const rows = rowsOf(plan, type)
  if (rows.some((r) => r[idField] === id)) {
    throw new Error(`A record with ${idField} "${String(id)}" already exists`)
  }
  rows.push(row)
  writePlan(scheduleId, plan)
  return row
}

export function updateEntity(
  scheduleId: string,
  type: EntityType,
  id: string,
  row: Row,
): Row {
  const { idField } = ENTITY_TYPES[type]
  const plan = readPlan(scheduleId)
  const rows = rowsOf(plan, type)
  const idx = rows.findIndex((r) => String(r[idField]) === id)
  if (idx < 0) throw new Error(`No ${type} record with ${idField} "${id}"`)
  // Merge so fields a caller didn't send are preserved; keep the id field
  // stable since renaming a key would orphan references elsewhere.
  rows[idx] = { ...rows[idx], ...row, [idField]: rows[idx]![idField] }
  writePlan(scheduleId, plan)
  return rows[idx]!
}

// Bulk import: upsert each row (matched on the id field). Array fields that
// arrive as strings are split; missing JSON fields default to [].
export function importEntities(
  scheduleId: string,
  type: EntityType,
  incoming: Row[],
): { created: number; updated: number } {
  const { idField } = ENTITY_TYPES[type]
  const plan = readPlan(scheduleId)
  const rows = rowsOf(plan, type)
  const byId = new Map(rows.map((r, i) => [String(r[idField]), i]))
  let created = 0
  let updated = 0

  for (const raw of incoming) {
    const row: Row = {}
    for (const [k, v] of Object.entries(raw)) {
      if (ARRAY_FIELDS[type].includes(k) && typeof v === 'string') {
        row[k] = v.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
      } else if (JSON_FIELDS[type].includes(k) && typeof v === 'string') {
        try {
          row[k] = v.trim() ? JSON.parse(v) : []
        } catch {
          row[k] = []
        }
      } else {
        row[k] = v
      }
    }
    const id = row[idField]
    if (id === undefined || id === null || id === '') continue
    for (const jf of JSON_FIELDS[type]) if (row[jf] === undefined) row[jf] = []
    for (const af of ARRAY_FIELDS[type]) if (row[af] === undefined) row[af] = []

    const existing = byId.get(String(id))
    if (existing !== undefined) {
      rows[existing] = { ...rows[existing], ...row, [idField]: rows[existing]![idField] }
      updated++
    } else {
      rows.push(row)
      byId.set(String(id), rows.length - 1)
      created++
    }
  }
  writePlan(scheduleId, plan)
  return { created, updated }
}

export function deleteEntity(scheduleId: string, type: EntityType, id: string): void {
  const { idField } = ENTITY_TYPES[type]
  const plan = readPlan(scheduleId)
  const rows = rowsOf(plan, type)
  const next = rows.filter((r) => String(r[idField]) !== id)
  if (next.length === rows.length) throw new Error(`No ${type} record with ${idField} "${id}"`)
  ;(plan as unknown as Record<string, unknown>)[ENTITY_TYPES[type].key] = next
  writePlan(scheduleId, plan)
}

// ---- enrollment records (synthetic id, no natural key) --------------------

export function listEnrollment(scheduleId: string): EnrollmentRecord[] {
  return readPlan(scheduleId).enrollment ?? []
}

export function createEnrollment(
  scheduleId: string,
  rec: Omit<EnrollmentRecord, 'id'>,
): EnrollmentRecord {
  const plan = readPlan(scheduleId)
  const record: EnrollmentRecord = { ...rec, id: `enr-${Date.now().toString(36)}` }
  plan.enrollment = [...(plan.enrollment ?? []), record]
  writePlan(scheduleId, plan)
  return record
}

export function updateEnrollment(
  scheduleId: string,
  id: string,
  patch: Partial<EnrollmentRecord>,
): EnrollmentRecord {
  const plan = readPlan(scheduleId)
  const arr = plan.enrollment ?? []
  const idx = arr.findIndex((r) => r.id === id)
  if (idx < 0) throw new Error(`No enrollment record "${id}"`)
  arr[idx] = { ...arr[idx]!, ...patch, id }
  plan.enrollment = arr
  writePlan(scheduleId, plan)
  return arr[idx]!
}

export function deleteEnrollment(scheduleId: string, id: string): void {
  const plan = readPlan(scheduleId)
  plan.enrollment = (plan.enrollment ?? []).filter((r) => r.id !== id)
  writePlan(scheduleId, plan)
}

// Bulk-append enrollment rows (from a spreadsheet upload).
export function importEnrollment(
  scheduleId: string,
  recs: Omit<EnrollmentRecord, 'id'>[],
): number {
  const plan = readPlan(scheduleId)
  const base = Date.now().toString(36)
  const stamped: EnrollmentRecord[] = recs.map((r, i) => ({ ...r, id: `enr-${base}-${i}` }))
  plan.enrollment = [...(plan.enrollment ?? []), ...stamped]
  writePlan(scheduleId, plan)
  return stamped.length
}

// ---- manual / independent sections ----------------------------------------
//
// The Schedule Process and Rules doc requires "the ability to create
// customized schedules for students who require independent sections".
// We store these on the term plan and treat them as pinned inputs to the
// solver (Stage 1 won't generate or remove them; Stage 2 must respect them).

export function listManualSections(scheduleId: string): ManualSection[] {
  return readPlan(scheduleId).manual_sections ?? []
}

export function createManualSection(
  scheduleId: string,
  rec: Omit<ManualSection, 'id'>,
): ManualSection {
  const plan = readPlan(scheduleId)
  const record: ManualSection = { ...rec, id: `ms-${Date.now().toString(36)}` }
  plan.manual_sections = [...(plan.manual_sections ?? []), record]
  writePlan(scheduleId, plan)
  return record
}

export function updateManualSection(
  scheduleId: string,
  id: string,
  patch: Partial<ManualSection>,
): ManualSection {
  const plan = readPlan(scheduleId)
  const arr = plan.manual_sections ?? []
  const idx = arr.findIndex((r) => r.id === id)
  if (idx < 0) throw new Error(`No manual section "${id}"`)
  arr[idx] = { ...arr[idx]!, ...patch, id }
  plan.manual_sections = arr
  writePlan(scheduleId, plan)
  return arr[idx]!
}

export function deleteManualSection(scheduleId: string, id: string): void {
  const plan = readPlan(scheduleId)
  plan.manual_sections = (plan.manual_sections ?? []).filter((r) => r.id !== id)
  writePlan(scheduleId, plan)
}

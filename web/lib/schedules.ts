// Schedule registry. A "schedule" is a named project with its own folder
// under data/schedules/<id>/ holding term-plan.json, config.json and (once
// solved) schedule.json. data/base-template/ holds reusable starter data.

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  copyFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { TermPlan } from './data'
import { DEFAULT_CONFIG } from './config'
import { SCHEDULES_DIR, BASE_TEMPLATE_DIR, scheduleDir } from './paths'

const INDEX_PATH = join(SCHEDULES_DIR, 'index.json')

export interface ScheduleMeta {
  id: string
  label: string
  createdAt: number
  lastSolvedAt: number | null
  placed: number
  total: number
}

export { scheduleDir }

export function scheduleExists(id: string): boolean {
  return existsSync(join(scheduleDir(id), 'term-plan.json'))
}

export function listSchedules(): ScheduleMeta[] {
  if (!existsSync(INDEX_PATH)) return []
  try {
    return JSON.parse(readFileSync(INDEX_PATH, 'utf8')) as ScheduleMeta[]
  } catch {
    return []
  }
}

export function getScheduleMeta(id: string): ScheduleMeta | null {
  return listSchedules().find((s) => s.id === id) ?? null
}

function writeIndex(rows: ScheduleMeta[]): void {
  mkdirSync(SCHEDULES_DIR, { recursive: true })
  writeFileSync(INDEX_PATH, JSON.stringify(rows, null, 2))
}

// An empty-but-valid term plan — keeps the term config, drops all entities.
function blankPlan(): TermPlan {
  let base: Partial<TermPlan> = {}
  try {
    base = JSON.parse(readFileSync(join(BASE_TEMPLATE_DIR, 'term-plan.json'), 'utf8'))
  } catch {
    /* base template missing — fall through to a bare plan */
  }
  return {
    generated_at: new Date().toISOString(),
    term: base.term ?? {
      year: 2026,
      season: 'Fall',
      operating_days: ['Su', 'M', 'T', 'W', 'Th'],
      operating_window: { start_min: 480, end_min: 1190 },
    },
    rooms: [],
    instructors: [],
    courses: [],
    majors: [],
    merged_groups: [],
    sections: [],
    baseline_assignments: [],
    rule_doc_snippets: {},
    equivalencies_summary: { cck_rows: 0, paaet_rows: 0, note: '' },
    reports: [],
  } as TermPlan
}

// `source`: 'blank', 'base' (the base template), or an existing schedule id.
export function createSchedule(label: string, source: string): ScheduleMeta {
  const id = `sch-${Date.now().toString(36)}`
  const dir = scheduleDir(id)
  mkdirSync(dir, { recursive: true })

  if (source === 'blank') {
    writeFileSync(join(dir, 'term-plan.json'), JSON.stringify(blankPlan(), null, 2))
    writeFileSync(join(dir, 'config.json'), JSON.stringify(DEFAULT_CONFIG, null, 2))
  } else {
    const srcDir = source === 'base' ? BASE_TEMPLATE_DIR : scheduleDir(source)
    copyFileSync(join(srcDir, 'term-plan.json'), join(dir, 'term-plan.json'))
    const srcConfig = join(srcDir, 'config.json')
    if (existsSync(srcConfig)) {
      copyFileSync(srcConfig, join(dir, 'config.json'))
    } else {
      writeFileSync(join(dir, 'config.json'), JSON.stringify(DEFAULT_CONFIG, null, 2))
    }
  }

  const meta: ScheduleMeta = {
    id,
    label: label.trim() || 'Untitled schedule',
    createdAt: Date.now(),
    lastSolvedAt: null,
    placed: 0,
    total: 0,
  }
  writeIndex([...listSchedules(), meta])
  return meta
}

export function renameSchedule(id: string, label: string): void {
  const rows = listSchedules()
  const row = rows.find((s) => s.id === id)
  if (!row) throw new Error('schedule not found')
  row.label = label.trim() || row.label
  writeIndex(rows)
}

export function deleteSchedule(id: string): void {
  const rows = listSchedules().filter((s) => s.id !== id)
  writeIndex(rows)
  rmSync(scheduleDir(id), { recursive: true, force: true })
}

export function updateScheduleStats(
  id: string,
  stats: { placed: number; total: number; lastSolvedAt: number },
): void {
  const rows = listSchedules()
  const row = rows.find((s) => s.id === id)
  if (!row) return
  row.placed = stats.placed
  row.total = stats.total
  row.lastSolvedAt = stats.lastSolvedAt
  writeIndex(rows)
}

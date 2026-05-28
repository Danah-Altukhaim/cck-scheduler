// Scheduler configuration — the tunable "preset" knobs plus custom rules.
//
// Stored in data/config.json, separate from term-plan.json so it survives a
// re-import of source spreadsheets. run-solve.ts reads this and applies it.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { clearDataCache } from './data'
import { scheduleDir } from './paths'

function configPath(scheduleId: string): string {
  return join(scheduleDir(scheduleId), 'config.json')
}

export interface Window {
  startMin: number
  endMin: number
}

export type CustomRuleType =
  | 'instructor_unavailable'
  | 'room_reserved'
  | 'course_time_window'
  | 'no_overlap_pair'
  | 'prefer_time'

export interface CustomRule {
  id: string
  name: string
  type: CustomRuleType
  kind: 'hard' | 'soft'
  enabled: boolean
  params: Record<string, unknown>
}

export interface SchedulerConfig {
  operatingDays: string[]
  operatingWindow: Window
  mondayBlock: { enabled: boolean; day: string; startMin: number; endMin: number }
  buckets: { morning: Window; midday: Window; evening: Window }
  customRules: CustomRule[]
}

export const DEFAULT_CONFIG: SchedulerConfig = {
  operatingDays: ['Su', 'M', 'T', 'W', 'Th'],
  operatingWindow: { startMin: 480, endMin: 1190 },
  mondayBlock: { enabled: true, day: 'M', startMin: 660, endMin: 720 },
  buckets: {
    morning: { startMin: 480, endMin: 720 },
    midday: { startMin: 660, endMin: 960 },
    evening: { startMin: 960, endMin: 1190 },
  },
  customRules: [],
}

export function getConfig(scheduleId: string): SchedulerConfig {
  const path = configPath(scheduleId)
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<SchedulerConfig>
    // Merge over defaults so a partial/old config file still works.
    return {
      ...DEFAULT_CONFIG,
      ...raw,
      operatingWindow: { ...DEFAULT_CONFIG.operatingWindow, ...raw.operatingWindow },
      mondayBlock: { ...DEFAULT_CONFIG.mondayBlock, ...raw.mondayBlock },
      buckets: { ...DEFAULT_CONFIG.buckets, ...raw.buckets },
      customRules: raw.customRules ?? [],
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveConfig(scheduleId: string, config: SchedulerConfig): void {
  writeFileSync(configPath(scheduleId), JSON.stringify(config, null, 2))
  clearDataCache(scheduleId)
}

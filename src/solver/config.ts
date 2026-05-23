// Solver-side reader for data/config.json — the settings + custom rules the
// web UI writes. run-solve.ts and cp_export.ts consume this.

import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

export interface Window {
  startMin: number
  endMin: number
}

export interface CustomRule {
  id: string
  name: string
  type: string
  kind: 'hard' | 'soft'
  enabled: boolean
  params: Record<string, unknown>
}

export interface SolverConfig {
  operatingDays: string[]
  operatingWindow: Window
  mondayBlock: { enabled: boolean; day: string; startMin: number; endMin: number }
  buckets: { morning: Window; midday: Window; evening: Window }
  workingStudentShare: number
  customRules: CustomRule[]
}

export const DEFAULT_CONFIG: SolverConfig = {
  operatingDays: ['Su', 'M', 'T', 'W', 'Th'],
  operatingWindow: { startMin: 480, endMin: 1190 },
  mondayBlock: { enabled: true, day: 'M', startMin: 660, endMin: 720 },
  buckets: {
    morning: { startMin: 480, endMin: 720 },
    midday: { startMin: 660, endMin: 960 },
    evening: { startMin: 960, endMin: 1190 },
  },
  workingStudentShare: 0.2,
  customRules: [],
}

export function loadConfig(dataDir: string): SolverConfig {
  const path = join(dataDir, 'config.json')
  if (!existsSync(path)) return { ...DEFAULT_CONFIG }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Partial<SolverConfig>
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

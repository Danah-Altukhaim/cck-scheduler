// Filesystem paths for the data layer. Standalone (no imports) so every other
// lib module can depend on it without creating an import cycle.

import { join } from 'node:path'

export const DATA_DIR = join(process.cwd(), '..', 'data')
export const SCHEDULES_DIR = join(DATA_DIR, 'schedules')
export const BASE_TEMPLATE_DIR = join(DATA_DIR, 'base-template')

export function scheduleDir(id: string): string {
  return join(SCHEDULES_DIR, id)
}

// Client-safe types and helpers. Anything importable by a client component
// must live here (or in a file that doesn't pull in node:fs). lib/data.ts
// re-exports these for backwards compatibility with existing imports.

export type Day = 'Sa' | 'Su' | 'M' | 'T' | 'W' | 'Th'
export type TimeBucket = 'morning' | 'midday' | 'evening'

export const OPERATING_DAYS: Day[] = ['Su', 'M', 'T', 'W', 'Th']
export const DAY_LABEL: Record<Day, string> = {
  Sa: 'Sat',
  Su: 'Sun',
  M: 'Mon',
  T: 'Tue',
  W: 'Wed',
  Th: 'Thu',
}

export function minToHHMM(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

export function durationMin(a: { start_min: number; end_min: number }): number {
  return a.end_min - a.start_min
}

export function courseClass(code: string): string {
  const prefix = code.match(/^[A-Z]+/)?.[0]?.toLowerCase()
  return prefix ? `b-${prefix}` : ''
}

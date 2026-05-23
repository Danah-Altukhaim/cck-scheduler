import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import { clearDataCache } from '@/lib/data'
import { scheduleDir } from '@/lib/paths'
import { updateScheduleStats } from '@/lib/schedules'

export const dynamic = 'force-dynamic'
// The solve runs in the background; this request returns immediately.
export const maxDuration = 60

const SCHEDULER_ROOT = join(process.cwd(), '..')

interface SolveStatus {
  state: 'idle' | 'running' | 'done' | 'error'
  startedAt: number | null
  finishedAt: number | null
  exitCode: number | null
  log: string
}

// Which schedule is currently solving (one at a time — two CP-SAT runs would
// thrash the CPU). null when idle.
let running: string | null = null

function statusPath(sid: string): string {
  return join(scheduleDir(sid), 'solve-status.json')
}
function writeStatus(sid: string, s: SolveStatus): void {
  try {
    writeFileSync(statusPath(sid), JSON.stringify(s, null, 2))
  } catch {
    /* best-effort */
  }
}
function readStatus(sid: string): SolveStatus {
  try {
    return JSON.parse(readFileSync(statusPath(sid), 'utf8')) as SolveStatus
  } catch {
    return { state: 'idle', startedAt: null, finishedAt: null, exitCode: null, log: '' }
  }
}

// GET /api/solve?schedule=:id — solve status for the UI to poll.
export async function GET(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  const s = readStatus(sid)
  let elapsedMs = 0
  if (s.state === 'running' && s.startedAt) elapsedMs = Date.now() - s.startedAt
  else if (s.startedAt && s.finishedAt) elapsedMs = s.finishedAt - s.startedAt
  return NextResponse.json({ ...s, running: running === sid, elapsedMs })
}

// POST /api/solve?schedule=:id — start a background solve for this schedule.
export async function POST(req: NextRequest) {
  const sid = req.nextUrl.searchParams.get('schedule')
  if (!sid) return NextResponse.json({ error: 'schedule required' }, { status: 400 })
  if (running) {
    return NextResponse.json({ ok: true, alreadyRunning: true, runningSchedule: running })
  }
  running = sid
  const startedAt = Date.now()
  writeStatus(sid, { state: 'running', startedAt, finishedAt: null, exitCode: null, log: '' })

  const dir = scheduleDir(sid)
  const child = spawn('npm', ['run', 'solve', '--', dir], { cwd: SCHEDULER_ROOT })
  let log = ''
  const append = (d: Buffer) => {
    log += d.toString()
    if (log.length > 12000) log = log.slice(-12000)
  }
  child.stdout?.on('data', append)
  child.stderr?.on('data', append)
  child.on('close', (code) => {
    running = null
    writeStatus(sid, {
      state: code === 0 ? 'done' : 'error',
      startedAt,
      finishedAt: Date.now(),
      exitCode: code,
      log,
    })
    clearDataCache(sid)
    try {
      const res = JSON.parse(readFileSync(join(dir, 'cp-result.json'), 'utf8')) as {
        sections_placed: number
        sections_total: number
      }
      updateScheduleStats(sid, {
        placed: res.sections_placed,
        total: res.sections_total,
        lastSolvedAt: Date.now(),
      })
    } catch {
      /* result file missing — leave index stats unchanged */
    }
  })
  child.on('error', (err) => {
    running = null
    writeStatus(sid, {
      state: 'error',
      startedAt,
      finishedAt: Date.now(),
      exitCode: null,
      log: `${log}\n${err.message}`,
    })
  })

  return NextResponse.json({ ok: true, started: true })
}

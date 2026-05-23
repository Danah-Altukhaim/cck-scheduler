'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type SolveState = 'idle' | 'running' | 'done' | 'error'

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function SolveButton({ scheduleId }: { scheduleId: string }) {
  const [state, setState] = useState<SolveState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [msg, setMsg] = useState<string | null>(null)
  const router = useRouter()
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const q = `?schedule=${encodeURIComponent(scheduleId)}`

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/solve${q}`, { method: 'GET' })
      const d = (await res.json()) as {
        state: SolveState
        running: boolean
        elapsedMs: number
        log: string
      }
      setElapsed(d.elapsedMs ?? 0)
      if (d.state === 'running') {
        setState('running')
      } else if (d.state === 'done') {
        setState('done')
        stopPoll()
        const line = (d.log ?? '')
          .split('\n')
          .find((l) => l.includes('Solver:'))
          ?.trim()
        setMsg(line ?? 'Solve complete')
        router.refresh()
      } else if (d.state === 'error') {
        setState('error')
        stopPoll()
        setMsg('Solve failed. Check the terminal running the dev server')
      } else {
        setState('idle')
        stopPoll()
      }
    } catch {
      /* transient — keep polling */
    }
  }, [router])

  const startPoll = useCallback(() => {
    stopPoll()
    void poll()
    pollRef.current = setInterval(() => void poll(), 3000)
  }, [poll])

  // If a solve is already running (e.g. the page was reloaded mid-solve),
  // resume showing its progress.
  useEffect(() => {
    fetch(`/api/solve${q}`)
      .then((r) => r.json())
      .then((d: { state: SolveState }) => {
        if (d.state === 'running') {
          setState('running')
          startPoll()
        }
      })
      .catch(() => {})
    return stopPoll
  }, [startPoll])

  async function solve() {
    setMsg(null)
    setState('running')
    setElapsed(0)
    try {
      await fetch(`/api/solve${q}`, { method: 'POST' })
    } catch {
      /* the poll will pick up the real state */
    }
    startPoll()
  }

  const busy = state === 'running'
  return (
    <div className="flex items-center gap-3">
      {busy && (
        <span className="text-sm text-cck-muted">
          Solving… {fmtElapsed(elapsed)} · takes ~10 min, you can leave this page
        </span>
      )}
      {!busy && msg && (
        <span className={`text-sm ${state === 'error' ? 'text-cck-red' : 'text-cck-muted'}`}>
          {msg}
        </span>
      )}
      <button onClick={solve} disabled={busy} className="btn-primary">
        {busy ? 'Solving…' : 'Run solver'}
      </button>
    </div>
  )
}

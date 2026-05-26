import type { ReactNode } from 'react'

type Tone = 'default' | 'red' | 'amber' | 'green' | 'blue' | 'muted' | 'solid'

export function Badge({
  tone = 'default',
  dot,
  children,
  className = '',
}: {
  tone?: Tone
  dot?: boolean
  children: ReactNode
  className?: string
}) {
  const toneClass = tone === 'default' ? '' : tone
  return (
    <span className={`badge ${toneClass} ${className}`.trim()}>
      {dot && <span className="dot" />}
      {children}
    </span>
  )
}

export function StatusIcon({
  status,
  className = '',
}: {
  status: 'ok' | 'warn' | 'error' | 'info' | 'pending'
  className?: string
}) {
  const map = {
    ok:      { fg: 'var(--success)',  bg: 'var(--success-soft)',  ring: 'var(--success-strong)' },
    warn:    { fg: 'var(--warn)',     bg: 'var(--warn-soft)',     ring: 'var(--warn-strong)' },
    error:   { fg: 'var(--danger)',   bg: 'var(--danger-soft)',   ring: 'var(--danger-strong)' },
    info:    { fg: 'var(--info)',     bg: 'var(--info-soft)',     ring: 'var(--info-strong)' },
    pending: { fg: 'var(--muted)',    bg: 'var(--surface-3)',     ring: 'var(--line)' },
  }
  const c = map[status]
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full ${className}`}
      style={{
        width: 16,
        height: 16,
        background: c.bg,
        border: `1px solid ${c.ring}`,
        color: c.fg,
      }}
      aria-label={status}
    >
      {status === 'ok' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 5l2 2 4-4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {status === 'warn' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 2.5v3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="5" cy="7.6" r="0.8" fill="currentColor" />
        </svg>
      )}
      {status === 'error' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M3 3l4 4M7 3l-4 4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      )}
      {status === 'info' && (
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path d="M5 4.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="5" cy="3" r="0.8" fill="currentColor" />
        </svg>
      )}
      {status === 'pending' && <span className="dot" style={{ background: c.fg, width: 4, height: 4 }} />}
    </span>
  )
}

'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronDown, Check, Plus, HelpCircle, Search } from 'lucide-react'
import type { ScheduleMeta } from '@/lib/schedules'

interface Crumb {
  label: string
  href?: string
}

const CRUMB_LABELS: Record<string, string> = {
  schedule: 'Schedule',
  sections: 'Sections',
  instructors: 'Instructors',
  rooms: 'Rooms',
  courses: 'Courses',
  majors: 'Majors',
  merged: 'Merged groups',
  enrollment: 'Enrollment',
  rules: 'Rules',
  constraints: 'Rules',
  settings: 'Term settings',
  policy: 'Policy coverage',
  generate: 'Generate',
  issues: 'Issues',
  inputs: 'Inputs',
}

export function Topbar({
  schedule,
  schedules,
  crumbs: crumbsProp,
  onOpenPalette,
}: {
  schedule: ScheduleMeta
  schedules: ScheduleMeta[]
  crumbs?: Crumb[]
  onOpenPalette: () => void
}) {
  const router = useRouter()
  const pathname = usePathname() ?? ''
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const switcherRef = useRef<HTMLDivElement | null>(null)
  const [hostMac, setHostMac] = useState(true)

  useEffect(() => {
    setHostMac(typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform))
  }, [])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (switcherRef.current && !switcherRef.current.contains(e.target as Node)) {
        setSwitcherOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  function switchTo(s: ScheduleMeta) {
    setSwitcherOpen(false)
    // map current sub-path on the new schedule
    const sub = pathname.replace(/^\/s\/[^/]+/, '')
    router.push(`/s/${s.id}${sub}`)
  }

  const crumbs: Crumb[] = useMemo(() => {
    if (crumbsProp) return crumbsProp
    const m = pathname.match(/^\/s\/[^/]+(\/.*)?$/)
    if (!m) return []
    const rest = (m[1] ?? '').replace(/^\//, '').split('/').filter(Boolean)
    if (rest.length === 0) return [{ label: 'Dashboard' }]
    const first = rest[0]
    const label = CRUMB_LABELS[first] ?? first
    return [{ label }]
  }, [pathname, crumbsProp])

  return (
    <header className="topbar">
      <div className="crumbs">
        <div ref={switcherRef} style={{ position: 'relative' }}>
          <button
            onClick={() => setSwitcherOpen((s) => !s)}
            className="btn btn-ghost btn-sm"
            style={{ gap: 6, fontWeight: 600, color: 'var(--ink)' }}
            aria-haspopup="listbox"
            aria-expanded={switcherOpen}
          >
            {schedule.label}
            <ChevronDown size={12} />
          </button>
          {switcherOpen && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-lg)',
                width: 260,
                padding: 6,
                zIndex: 20,
              }}
              role="listbox"
            >
              <div className="text-label" style={{ padding: '8px 10px 4px' }}>Switch schedule</div>
              {schedules.map((s) => {
                const active = s.id === schedule.id
                return (
                  <button
                    type="button"
                    key={s.id}
                    onClick={() => switchTo(s)}
                    role="option"
                    aria-selected={active}
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      gap: 8,
                      padding: '7px 8px',
                      background: active ? 'var(--accent-soft)' : 'transparent',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                      color: 'var(--ink)',
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.label}
                    </span>
                    <span className="text-caption" style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {s.lastSolvedAt ? `${s.placed}/${s.total}` : 'new'}
                    </span>
                    {active && <Check size={12} color="var(--accent)" />}
                  </button>
                )
              })}
              <div className="divider" style={{ margin: '6px 4px' }} />
              <Link
                href="/"
                onClick={() => setSwitcherOpen(false)}
                className="sidebar-item"
                style={{ fontSize: 12.5, color: 'var(--muted)' }}
              >
                <Plus size={14} /> Create or manage schedules
              </Link>
            </div>
          )}
        </div>
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="sep">/</span>
            {c.href ? (
              <Link href={c.href}>{c.label}</Link>
            ) : (
              <span className="current">{c.label}</span>
            )}
          </span>
        ))}
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onOpenPalette} className="cmd-trigger" type="button" aria-label="Open command palette">
          <Search size={13} />
          <span style={{ minWidth: 120, textAlign: 'left' }}>Jump to…</span>
          <kbd>{hostMac ? '⌘ K' : 'Ctrl K'}</kbd>
        </button>
        <Link href="/" className="btn btn-ghost btn-icon btn-sm" aria-label="Help" title="Help">
          <HelpCircle size={14} />
        </Link>
      </div>
    </header>
  )
}

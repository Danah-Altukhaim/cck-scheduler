'use client'

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'

export interface CommandItem {
  id: string
  group: string
  label: string
  hint?: string
  icon?: ReactNode
  shortcut?: string
  keywords?: string
  onSelect: () => void
}

export function CommandPalette({
  open,
  onClose,
  items,
}: {
  open: boolean
  onClose: () => void
  items: CommandItem[]
}) {
  const [q, setQ] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setActiveIdx(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return items
    return items.filter((it) => {
      const hay = `${it.label} ${it.group} ${it.keywords ?? ''} ${it.hint ?? ''}`.toLowerCase()
      return hay.includes(query)
    })
  }, [items, q])

  const grouped = useMemo(() => {
    const map = new Map<string, CommandItem[]>()
    for (const it of filtered) {
      const list = map.get(it.group) ?? []
      list.push(it)
      map.set(it.group, list)
    }
    return Array.from(map.entries())
  }, [filtered])

  const flat = filtered

  const move = useCallback((d: number) => {
    setActiveIdx((i) => {
      if (flat.length === 0) return 0
      return (i + d + flat.length) % flat.length
    })
  }, [flat.length])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        move(1)
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        move(-1)
      } else if (e.key === 'Enter') {
        e.preventDefault()
        flat[activeIdx]?.onSelect()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, move, flat, activeIdx, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  let runningIdx = -1

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <div className="cmd-palette" role="dialog" aria-modal="true" aria-label="Command palette">
        <div className="search">
          <Search size={16} color="var(--muted)" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setActiveIdx(0)
            }}
            placeholder="Search pages, sections, instructors, rooms…"
          />
          <kbd className="kbd">esc</kbd>
        </div>
        <div className="results">
          {flat.length === 0 ? (
            <div style={{ padding: '24px 12px', color: 'var(--muted)', textAlign: 'center', fontSize: 13 }}>
              No matches.
            </div>
          ) : (
            grouped.map(([group, list]) => (
              <div key={group}>
                <div className="group-label">{group}</div>
                {list.map((it) => {
                  runningIdx += 1
                  const isActive = runningIdx === activeIdx
                  return (
                    <div
                      key={it.id}
                      className={`result ${isActive ? 'active' : ''}`}
                      onMouseEnter={() => setActiveIdx(flat.indexOf(it))}
                      onClick={() => {
                        it.onSelect()
                        onClose()
                      }}
                    >
                      {it.icon}
                      <span>{it.label}</span>
                      {it.hint && (
                        <span className="meta" style={{ marginLeft: 6 }}>
                          {it.hint}
                        </span>
                      )}
                      {it.shortcut && <kbd className="kbd" style={{ marginLeft: 'auto' }}>{it.shortcut}</kbd>}
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
        <footer>
          <span><kbd>↑↓</kbd> navigate</span>
          <span><kbd>↵</kbd> select</span>
          <span><kbd>esc</kbd> close</span>
        </footer>
      </div>
    </>,
    document.body,
  )
}

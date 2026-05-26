'use client'

import { cloneElement, isValidElement, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface TriggerProps {
  onMouseEnter?: React.MouseEventHandler<HTMLElement>
  onMouseLeave?: React.MouseEventHandler<HTMLElement>
  onFocus?: React.FocusEventHandler<HTMLElement>
  onBlur?: React.FocusEventHandler<HTMLElement>
}

export function Tooltip({
  label,
  shortcut,
  side = 'top',
  children,
}: {
  label: ReactNode
  shortcut?: string
  side?: 'top' | 'bottom'
  children: ReactElement<TriggerProps>
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const enterTimer = useRef<number | null>(null)

  function show(target: HTMLElement) {
    if (enterTimer.current) window.clearTimeout(enterTimer.current)
    enterTimer.current = window.setTimeout(() => {
      const r = target.getBoundingClientRect()
      setPos({
        x: r.left + r.width / 2,
        y: side === 'top' ? r.top - 6 : r.bottom + 6,
      })
    }, 350)
  }
  function hide() {
    if (enterTimer.current) {
      window.clearTimeout(enterTimer.current)
      enterTimer.current = null
    }
    setPos(null)
  }

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent<HTMLElement>) => show(e.currentTarget),
        onMouseLeave: hide,
        onFocus: (e: React.FocusEvent<HTMLElement>) => show(e.currentTarget),
        onBlur: hide,
      })
    : children

  return (
    <>
      {trigger}
      {pos &&
        typeof document !== 'undefined' &&
        createPortal(
          <span
            className="tooltip"
            style={{
              left: pos.x,
              top: pos.y,
              transform: side === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
            role="tooltip"
          >
            {label}
            {shortcut && <kbd>{shortcut}</kbd>}
          </span>,
          document.body,
        )}
    </>
  )
}

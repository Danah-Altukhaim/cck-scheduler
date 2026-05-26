'use client'

import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null
  if (typeof document === 'undefined') return null

  return createPortal(
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <aside className={`sheet ${wide ? 'wide' : ''}`.trim()} role="dialog" aria-modal="true">
        <header className="flex items-start gap-3">
          <div className="flex-fill">
            {title && <div className="text-h2">{title}</div>}
            {description && (
              <div className="text-caption" style={{ marginTop: 4 }}>
                {description}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Close panel"
            type="button"
          >
            <X size={14} />
          </button>
        </header>
        <div className="body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </aside>
    </>,
    document.body,
  )
}

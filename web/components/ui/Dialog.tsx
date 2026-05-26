'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'default',
  closeOnBackdrop = true,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'default' | 'wide' | 'wider'
  closeOnBackdrop?: boolean
}) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>(
        'input, select, textarea, button, [tabindex]:not([tabindex="-1"])',
      )
      focusable?.focus()
    }
  }, [open])

  if (!open) return null
  if (typeof document === 'undefined') return null

  const panelClass = `panel ${width === 'wide' ? 'wide' : width === 'wider' ? 'wider' : ''}`.trim()

  return createPortal(
    <>
      <div className="scrim" onClick={closeOnBackdrop ? onClose : undefined} aria-hidden />
      <div className="dialog" role="dialog" aria-modal="true">
        <div className={panelClass} ref={panelRef}>
          {(title || description) && (
            <header>
              {title && <div className="text-h2">{title}</div>}
              {description && (
                <div className="text-caption" style={{ marginTop: 4 }}>
                  {description}
                </div>
              )}
            </header>
          )}
          <div className="body">{children}</div>
          {footer && <footer>{footer}</footer>}
        </div>
      </div>
    </>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  busy,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void | Promise<void>
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'default' | 'danger'
  busy?: boolean
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary" disabled={busy}>
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            disabled={busy}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </>
      }
    >
      <div />
    </Dialog>
  )
}

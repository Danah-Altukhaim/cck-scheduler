'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export type ToastTone = 'success' | 'error' | 'warn' | 'info'

interface ToastInput {
  title: string
  description?: ReactNode
  tone?: ToastTone
  action?: { label: string; onClick: () => void }
  duration?: number
}

interface ToastEntry extends ToastInput {
  id: number
}

interface Ctx {
  push: (t: ToastInput) => number
  dismiss: (id: number) => void
}

const ToastCtx = createContext<Ctx | null>(null)

export function useToast() {
  const ctx = useContext(ToastCtx)
  if (!ctx) {
    return {
      push: (_t: ToastInput) => 0,
      dismiss: (_id: number) => {},
    }
  }
  return ctx
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastEntry[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems((cur) => cur.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (t: ToastInput): number => {
      idRef.current += 1
      const id = idRef.current
      setItems((cur) => [...cur, { ...t, id }])
      const dur = t.duration ?? 4200
      if (dur > 0) {
        window.setTimeout(() => {
          setItems((cur) => cur.filter((x) => x.id !== id))
        }, dur)
      }
      return id
    },
    [],
  )

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <ToastCtx.Provider value={{ push, dismiss }}>
      {children}
      {mounted && typeof document !== 'undefined'
        ? createPortal(
            <div className="toast-stack" role="region" aria-live="polite">
              {items.map((t) => (
                <ToastItem key={t.id} item={t} onClose={() => dismiss(t.id)} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastCtx.Provider>
  )
}

function ToastItem({ item, onClose }: { item: ToastEntry; onClose: () => void }) {
  return (
    <div className={`toast ${item.tone ?? 'info'}`}>
      <div className="flex-fill">
        <div className="title">{item.title}</div>
        {item.description && <div className="desc">{item.description}</div>}
        {item.action && (
          <button className="action" onClick={item.action.onClick}>
            {item.action.label}
          </button>
        )}
      </div>
      <button className="close" onClick={onClose} aria-label="Dismiss notification">
        <X size={14} />
      </button>
    </div>
  )
}

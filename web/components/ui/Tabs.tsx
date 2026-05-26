'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export interface TabItem {
  href: string
  label: ReactNode
  count?: number
  match?: (pathname: string, href: string) => boolean
  icon?: ReactNode
}

export function Tabs({ items }: { items: TabItem[] }) {
  const pathname = usePathname() ?? ''
  return (
    <div className="tabs">
      {items.map((t) => {
        const active = t.match ? t.match(pathname, t.href) : pathname === t.href || pathname.startsWith(t.href + '/')
        return (
          <Link key={t.href} href={t.href} className={`tab ${active ? 'active' : ''}`.trim()}>
            {t.icon}
            <span>{t.label}</span>
            {typeof t.count === 'number' && <span className="count">{t.count}</span>}
          </Link>
        )
      })}
    </div>
  )
}

export function StaticTabs<T extends string>({
  items,
  value,
  onChange,
}: {
  items: { value: T; label: ReactNode; count?: number; icon?: ReactNode }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="tabs">
      {items.map((t) => (
        <button
          key={t.value}
          type="button"
          className={`tab ${value === t.value ? 'active' : ''}`.trim()}
          onClick={() => onChange(t.value)}
        >
          {t.icon}
          <span>{t.label}</span>
          {typeof t.count === 'number' && <span className="count">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

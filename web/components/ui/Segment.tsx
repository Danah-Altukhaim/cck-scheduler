'use client'

import type { ReactNode } from 'react'

export interface SegmentOption<T extends string> {
  value: T
  label: ReactNode
  icon?: ReactNode
}

export function Segment<T extends string>({
  value,
  onChange,
  options,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: SegmentOption<T>[]
  size?: 'sm' | 'md'
}) {
  return (
    <div className="segment" role="tablist">
      {options.map((opt) => (
        <button
          type="button"
          key={opt.value}
          className={value === opt.value ? 'active' : ''}
          onClick={() => onChange(opt.value)}
          role="tab"
          aria-selected={value === opt.value}
          style={size === 'sm' ? { padding: '3px 8px', fontSize: 11.5 } : undefined}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  )
}

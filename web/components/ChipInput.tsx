'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

// A friendly editor for a list of short strings (course codes, aliases, …).
// Type and press Enter or comma to add; click × to remove.
export function ChipInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [text, setText] = useState('')

  function commit() {
    const parts = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((p) => !value.includes(p))
    if (parts.length) onChange([...value, ...parts])
    setText('')
  }

  return (
    <div className="w-full border border-cck-line rounded-lg px-2 py-1.5 flex flex-wrap gap-1.5 items-center bg-white">
      {value.map((v) => (
        <span key={v} className="badge muted inline-flex items-center gap-1">
          {v}
          <button
            type="button"
            onClick={() => onChange(value.filter((x) => x !== v))}
            className="hover:text-cck-red"
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        className="flex-1 min-w-[100px] border-0 outline-none text-sm py-0.5 bg-transparent focus:shadow-none"
        value={text}
        placeholder={value.length ? '' : placeholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            commit()
          } else if (e.key === 'Backspace' && !text && value.length) {
            onChange(value.slice(0, -1))
          }
        }}
        onBlur={commit}
      />
    </div>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface Step {
  key: string
  label: string
  href: string
  // sub-paths (relative to /s/<id>) that count as being on this step
  match: string[]
}

const STEPS: Step[] = [
  {
    key: 'inputs',
    label: 'Set up inputs',
    href: '/inputs',
    match: ['/inputs', '/enrollment', '/courses', '/instructors', '/rooms', '/majors', '/merged'],
  },
  {
    key: 'constraints',
    label: 'Set rules',
    href: '/constraints',
    match: ['/constraints', '/settings', '/rules', '/policy'],
  },
  { key: 'generate', label: 'Generate', href: '/generate', match: ['/generate'] },
  { key: 'result', label: 'Schedule', href: '/schedule', match: ['/schedule', '/sections', '/issues'] },
]

export function Stepper({
  scheduleId,
  inputsDone,
  generated,
}: {
  scheduleId: string
  inputsDone: boolean
  generated: boolean
}) {
  const pathname = usePathname()
  const base = `/s/${scheduleId}`
  const sub = pathname.startsWith(base) ? pathname.slice(base.length) || '/inputs' : '/inputs'
  let activeIdx = STEPS.findIndex((s) => s.match.some((m) => sub === m || sub.startsWith(m + '/')))
  if (activeIdx < 0) activeIdx = 0

  const done = [inputsDone, false, generated, false]

  return (
    <div className="border-b border-cck-line bg-white">
      <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-2">
        {STEPS.map((step, i) => {
          const isActive = i === activeIdx
          const isDone = done[i]
          return (
            <div key={step.key} className="flex items-center gap-2">
              <Link
                href={`${base}${step.href}`}
                className="flex items-center gap-2 group"
                title={step.label}
              >
                <span
                  className="inline-flex items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    width: 24,
                    height: 24,
                    background: isActive ? '#006341' : isDone ? '#76B82A' : '#e7e2da',
                    color: isActive || isDone ? 'white' : '#8a8378',
                  }}
                >
                  {isDone && !isActive ? '✓' : i + 1}
                </span>
                <span
                  className={`text-sm ${
                    isActive ? 'font-semibold text-cck-ink' : 'text-cck-muted group-hover:text-cck-ink'
                  }`}
                >
                  {step.label}
                </span>
              </Link>
              {i < STEPS.length - 1 && (
                <span className="text-cck-muted mx-1" aria-hidden>
                  →
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

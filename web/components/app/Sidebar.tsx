'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarRange,
  ListChecks,
  DoorOpen,
  Users,
  BookOpen,
  GraduationCap,
  Layers,
  UserPlus,
  SlidersHorizontal,
  Cog,
  Play,
  History,
  AlertTriangle,
  FileCheck2,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'

interface SidebarCount {
  sections?: number
  instructors?: number
  rooms?: number
  courses?: number
  majors?: number
  merged?: number
  enrollment?: number
  rules?: number
  issues?: number
}

interface NavGroup {
  label: string
  items: NavItem[]
}
interface NavItem {
  key: string
  label: string
  href: string
  icon: LucideIcon
  count?: number
  badge?: ReactNode
  match?: string[]
}

export function Sidebar({
  scheduleId,
  counts,
  ready,
}: {
  scheduleId: string
  counts: SidebarCount
  /** True if inputs look complete enough to solve. Styles the Generate CTA. */
  ready: boolean
}) {
  const pathname = usePathname() ?? ''
  const base = `/s/${scheduleId}`

  const groups: NavGroup[] = [
    {
      label: 'Overview',
      items: [
        { key: 'overview', label: 'Dashboard', href: base, icon: LayoutDashboard, match: [base, `${base}/`, `${base}/inputs`] },
        { key: 'schedule', label: 'Schedule', href: `${base}/schedule`, icon: CalendarRange, match: [`${base}/schedule`] },
        { key: 'sections', label: 'Sections', href: `${base}/sections`, icon: ListChecks, count: counts.sections, match: [`${base}/sections`] },
      ],
    },
    {
      label: 'Inputs',
      items: [
        { key: 'instructors', label: 'Instructors', href: `${base}/instructors`, icon: Users, count: counts.instructors },
        { key: 'rooms', label: 'Rooms', href: `${base}/rooms`, icon: DoorOpen, count: counts.rooms },
        { key: 'courses', label: 'Courses', href: `${base}/courses`, icon: BookOpen, count: counts.courses },
        { key: 'majors', label: 'Majors', href: `${base}/majors`, icon: GraduationCap, count: counts.majors },
        { key: 'merged', label: 'Merged groups', href: `${base}/merged`, icon: Layers, count: counts.merged },
        { key: 'enrollment', label: 'Enrollment', href: `${base}/enrollment`, icon: UserPlus, count: counts.enrollment },
      ],
    },
    {
      label: 'Policy',
      items: [
        { key: 'rules', label: 'Rules', href: `${base}/rules`, icon: SlidersHorizontal, count: counts.rules, match: [`${base}/rules`, `${base}/constraints`] },
        { key: 'settings', label: 'Term settings', href: `${base}/settings`, icon: Cog },
        { key: 'policy', label: 'Policy coverage', href: `${base}/policy`, icon: FileCheck2 },
      ],
    },
    {
      label: 'Solve',
      items: [
        { key: 'generate', label: 'Generate', href: `${base}/generate`, icon: Play },
        { key: 'runs', label: 'Run history', href: `${base}/generate#runs`, icon: History },
        { key: 'issues', label: 'Issues', href: `${base}/issues`, icon: AlertTriangle, count: counts.issues, badge: counts.issues && counts.issues > 0 ? <span className="dot" style={{ background: 'var(--warn)' }} /> : null },
      ],
    },
  ]

  return (
    <nav className="sidebar" aria-label="Schedule navigation">
      <Link href="/" className="flex items-center gap-2 px-2 pb-3" style={{ textDecoration: 'none' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            background: 'var(--cck-green)',
            color: 'white',
            borderRadius: 6,
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '0.04em',
          }}
        >
          CCK
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>AI Scheduler</span>
      </Link>

      {groups.map((g) => (
        <div key={g.label}>
          <div className="sidebar-section">{g.label}</div>
          {g.items.map((it) => {
            const matches = it.match ?? [it.href]
            const active = matches.some((m) =>
              m === base
                ? pathname === base || pathname === `${base}/inputs` || pathname === `${base}/`
                : pathname === m || pathname.startsWith(m + '/'),
            )
            const Icon = it.icon
            const isGenerateCta = it.key === 'generate' && ready
            return (
              <Link
                key={it.key}
                href={it.href}
                className={`sidebar-item ${active ? 'active' : ''}`.trim()}
                style={isGenerateCta && !active ? { color: 'var(--accent)', fontWeight: 600 } : undefined}
              >
                <Icon className="icon" />
                <span>{it.label}</span>
                {it.badge}
                {typeof it.count === 'number' && it.count > 0 && (
                  <span className="count">{it.count}</span>
                )}
              </Link>
            )
          })}
        </div>
      ))}

      <div style={{ marginTop: 'auto', padding: '12px 4px 4px' }}>
        <Link href="/" className="sidebar-item" style={{ color: 'var(--muted)', fontSize: 12 }}>
          ← All schedules
        </Link>
      </div>
    </nav>
  )
}

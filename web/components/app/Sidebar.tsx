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
  PanelLeftClose,
  PanelLeftOpen,
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
  collapsed = false,
  onToggle,
}: {
  scheduleId: string
  counts: SidebarCount
  /** True if inputs look complete enough to solve. Styles the Generate CTA. */
  ready: boolean
  collapsed?: boolean
  onToggle?: () => void
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
    <nav
      className={`sidebar${collapsed ? ' collapsed' : ''}`}
      aria-label="Schedule navigation"
      data-collapsed={collapsed || undefined}
    >
      <div className="sidebar-header">
        <Link
          href="/"
          className="sidebar-brand"
          style={{ textDecoration: 'none' }}
          title={collapsed ? 'AI Scheduler' : undefined}
        >
          <span className="sidebar-brand-badge">CCK</span>
          <span className="sidebar-brand-label">AI Scheduler</span>
        </Link>
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            className="sidebar-toggle"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
          </button>
        )}
      </div>

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
                title={collapsed ? it.label : undefined}
                aria-label={collapsed ? it.label : undefined}
              >
                <Icon className="icon" />
                <span className="sidebar-item-label">{it.label}</span>
                {it.badge}
                {typeof it.count === 'number' && it.count > 0 && (
                  <span className="count">{it.count}</span>
                )}
              </Link>
            )
          })}
        </div>
      ))}

      <div className="sidebar-footer">
        <Link
          href="/"
          className="sidebar-item"
          style={{ color: 'var(--muted)', fontSize: 12 }}
          title={collapsed ? 'All schedules' : undefined}
          aria-label={collapsed ? 'All schedules' : undefined}
        >
          <span className="sidebar-footer-arrow">←</span>
          <span className="sidebar-item-label">All schedules</span>
        </Link>
      </div>
    </nav>
  )
}

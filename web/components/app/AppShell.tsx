'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'

const SIDEBAR_COLLAPSED_KEY = 'cck.sidebar.collapsed'
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
  AlertTriangle,
  FileCheck2,
  ExternalLink,
  Plus,
} from 'lucide-react'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { CommandPalette, type CommandItem } from '../ui/CommandPalette'
import type { ScheduleMeta } from '@/lib/schedules'

interface AppShellProps {
  scheduleId: string
  schedule: ScheduleMeta
  schedules: ScheduleMeta[]
  counts: {
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
  ready: boolean
  crumbs?: { label: string; href?: string }[]
  children: ReactNode
  /** Extra command palette items (e.g. jump-to-section, jump-to-instructor) */
  extraCommands?: CommandItem[]
}

export function AppShell({
  scheduleId,
  schedule,
  schedules,
  counts,
  ready,
  crumbs,
  children,
  extraCommands = [],
}: AppShellProps) {
  const router = useRouter()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
    } catch {}
  }, [])

  function toggleSidebar() {
    setCollapsed((c) => {
      const next = !c
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0')
      } catch {}
      return next
    })
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((s) => !s)
        return
      }
      if (paletteOpen) return
      // ignore shortcuts when typing
      if (target && /^(INPUT|TEXTAREA|SELECT)$/i.test(target.tagName)) return
      if (target?.isContentEditable) return
      if (e.key === '/' && !isMod) {
        e.preventDefault()
        setPaletteOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [paletteOpen])

  const base = `/s/${scheduleId}`

  const pageCommands: CommandItem[] = useMemo(
    () => [
      { id: 'go-dashboard',   group: 'Navigate', label: 'Dashboard',      icon: <LayoutDashboard size={14} />, onSelect: () => router.push(base) },
      { id: 'go-schedule',    group: 'Navigate', label: 'Schedule',       icon: <CalendarRange size={14} />,   onSelect: () => router.push(`${base}/schedule`) },
      { id: 'go-sections',    group: 'Navigate', label: 'Sections',       icon: <ListChecks size={14} />,      onSelect: () => router.push(`${base}/sections`) },
      { id: 'go-instructors', group: 'Navigate', label: 'Instructors',    icon: <Users size={14} />,           onSelect: () => router.push(`${base}/instructors`) },
      { id: 'go-rooms',       group: 'Navigate', label: 'Rooms',          icon: <DoorOpen size={14} />,        onSelect: () => router.push(`${base}/rooms`) },
      { id: 'go-courses',     group: 'Navigate', label: 'Courses',        icon: <BookOpen size={14} />,        onSelect: () => router.push(`${base}/courses`) },
      { id: 'go-majors',      group: 'Navigate', label: 'Majors',         icon: <GraduationCap size={14} />,   onSelect: () => router.push(`${base}/majors`) },
      { id: 'go-merged',      group: 'Navigate', label: 'Merged groups',  icon: <Layers size={14} />,          onSelect: () => router.push(`${base}/merged`) },
      { id: 'go-enrollment',  group: 'Navigate', label: 'Enrollment',     icon: <UserPlus size={14} />,        onSelect: () => router.push(`${base}/enrollment`) },
      { id: 'go-rules',       group: 'Policy',   label: 'Rules',          icon: <SlidersHorizontal size={14} />, onSelect: () => router.push(`${base}/rules`) },
      { id: 'go-settings',    group: 'Policy',   label: 'Term settings',  icon: <Cog size={14} />,             onSelect: () => router.push(`${base}/settings`) },
      { id: 'go-policy',      group: 'Policy',   label: 'Policy coverage',icon: <FileCheck2 size={14} />,      onSelect: () => router.push(`${base}/policy`) },
      { id: 'go-generate',    group: 'Solve',    label: 'Generate schedule', icon: <Play size={14} />,         shortcut: 'G', onSelect: () => router.push(`${base}/generate`) },
      { id: 'go-issues',      group: 'Solve',    label: 'Issues',         icon: <AlertTriangle size={14} />,   onSelect: () => router.push(`${base}/issues`) },
      { id: 'go-home',        group: 'Workspace',label: 'All schedules',  icon: <ExternalLink size={14} />,    onSelect: () => router.push('/') },
      ...schedules
        .filter((s) => s.id !== scheduleId)
        .map<CommandItem>((s) => ({
          id: `switch-${s.id}`,
          group: 'Switch schedule',
          label: s.label,
          hint: s.lastSolvedAt ? `${s.placed}/${s.total} placed` : 'not generated',
          icon: <CalendarRange size={14} />,
          onSelect: () => router.push(`/s/${s.id}`),
        })),
      {
        id: 'create-schedule',
        group: 'Workspace',
        label: 'Create new schedule',
        icon: <Plus size={14} />,
        onSelect: () => router.push('/?new=1'),
      },
    ],
    [router, base, schedules, scheduleId],
  )

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}`}>
      <Sidebar
        scheduleId={scheduleId}
        counts={counts}
        ready={ready}
        collapsed={collapsed}
        onToggle={toggleSidebar}
      />
      <Topbar
        schedule={schedule}
        schedules={schedules}
        crumbs={crumbs}
        onOpenPalette={() => setPaletteOpen(true)}
      />
      <div className="main">{children}</div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        items={[...pageCommands, ...extraCommands]}
      />
    </div>
  )
}

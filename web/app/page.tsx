import { listSchedules } from '../lib/schedules'
import { SchedulesList } from '../components/SchedulesList'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a href="/" className="flex items-center gap-2" style={{ textDecoration: 'none' }}>
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
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>AI Scheduler</span>
          </a>
          <span className="badge muted" style={{ marginLeft: 6 }}>Workspace</span>
        </div>
      </header>
      <main className="page">
        <SchedulesList initial={listSchedules()} />
      </main>
    </>
  )
}

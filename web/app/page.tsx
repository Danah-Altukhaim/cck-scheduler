import { listSchedules } from '../lib/schedules'
import { SchedulesList } from '../components/SchedulesList'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a
            href="/"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}
            aria-label="Canadian College of Kuwait — AI Scheduler"
          >
            <img
              src="/cck-logo.png"
              alt="Canadian College of Kuwait"
              height={28}
              style={{ height: 28, width: 'auto', display: 'block' }}
            />
            <span
              aria-hidden
              style={{ width: 1, height: 22, background: 'var(--line-strong)' }}
            />
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

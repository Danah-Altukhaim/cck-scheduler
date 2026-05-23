import { listSchedules } from '../lib/schedules'
import { SchedulesList } from '../components/SchedulesList'

export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="max-w-[1100px] mx-auto px-6 py-10">
      <SchedulesList initial={listSchedules()} />
    </main>
  )
}

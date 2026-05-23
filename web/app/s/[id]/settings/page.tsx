import { getConfig } from '@/lib/config'
import { SettingsForm } from '@/components/SettingsForm'

export const dynamic = 'force-dynamic'

export default function SettingsPage({ params }: { params: { id: string } }) {
  return <SettingsForm scheduleId={params.id} initial={getConfig(params.id)} />
}

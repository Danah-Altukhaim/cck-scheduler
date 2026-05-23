import { redirect } from 'next/navigation'

export default function ScheduleHome({ params }: { params: { id: string } }) {
  // The journey starts at step 1.
  redirect(`/s/${params.id}/inputs`)
}

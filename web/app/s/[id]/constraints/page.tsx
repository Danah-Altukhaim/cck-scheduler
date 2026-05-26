import { redirect } from 'next/navigation'

// The "Constraints" hub was a stepper-era page. With sidebar nav, every
// surface is reachable directly, so route /constraints to the Rules page.
export default function ConstraintsRedirect({ params }: { params: { id: string } }) {
  redirect(`/s/${params.id}/rules`)
}

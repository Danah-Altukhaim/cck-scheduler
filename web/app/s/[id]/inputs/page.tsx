import { redirect } from 'next/navigation'

// The dashboard at /s/[id] now serves as the inputs hub. Keep this route as a
// redirect so existing links don't 404.
export default function InputsRedirect({ params }: { params: { id: string } }) {
  redirect(`/s/${params.id}`)
}

import { getTermPlan } from '@/lib/data'
import { type FieldSpec } from '@/components/EntityEditor'
import { CoursesView } from './CoursesView'

export const dynamic = 'force-dynamic'

const FIELDS: FieldSpec[] = [
  { name: 'code', label: 'Course code', kind: 'text', idField: true },
  { name: 'name_en', label: 'Name (EN)', kind: 'text' },
  { name: 'name_ar', label: 'Name (AR)', kind: 'text' },
  { name: 'credits', label: 'Credits', kind: 'number' },
  { name: 'teaching_hours', label: 'Teaching hours (if ≠ credits)', kind: 'number' },
  { name: 'type', label: 'Type', kind: 'select', options: ['lecture', 'lab', 'lecture+lab'] },
  {
    name: 'lecture_pattern',
    label: 'Lecture pattern',
    kind: 'select',
    options: ['3x50', '2x75', '3x75', '2x120', 'lab+lecture', 'irregular'],
  },
  { name: 'requires_lab', label: 'Requires lab', kind: 'boolean' },
  { name: 'offered_languages', label: 'Offered languages', kind: 'tags' },
  { name: 'certified_instructors', label: 'Certified instructors (ids)', kind: 'tags' },
  { name: 'programs', label: 'Programs', kind: 'tags' },
]

export default function CoursesPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const plan = getTermPlan(sid)
  return (
    <CoursesView
      scheduleId={sid}
      fields={FIELDS}
      initialRows={plan.courses as unknown as Record<string, unknown>[]}
    />
  )
}

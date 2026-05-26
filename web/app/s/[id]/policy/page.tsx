import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui'

export const dynamic = 'force-dynamic'

// The 24 items from CCK's "Schedule Process and Rules" doc, each mapped to
// where on the site it's enforced or editable. Keeping this in one place so
// the registrar can verify policy coverage at a glance.
type Status = 'enforced' | 'editable' | 'reference' | 'documented'

interface PolicyItem {
  doc: string
  status: Status
  // Where on the site it lives. `seg` is appended to /s/<id>.
  link?: { seg: string; label: string }
  rule?: string // e.g. 'H7' or 'S4'
  note?: string
}

const ITEMS: PolicyItem[] = [
  {
    doc: 'Major sheet (attached) — programs and required courses per semester',
    status: 'editable',
    link: { seg: '/majors', label: 'Majors' },
  },
  {
    doc: 'Lantiv Timetabling System screenshots / PDFs from the last two semesters',
    status: 'reference',
    link: { seg: '/inputs#references', label: 'Reference documents' },
  },
  {
    doc: 'Previous SIS schedule attached',
    status: 'reference',
    link: { seg: '/inputs#references', label: 'Reference documents' },
  },
  {
    doc: 'List of labs and lectures (attached)',
    status: 'editable',
    link: { seg: '/courses', label: 'Courses (filter by Lab / Lecture)' },
  },
  {
    doc: 'Students study in two languages: Arabic and English',
    status: 'editable',
    link: { seg: '/enrollment', label: 'Enrollment (language per cohort)' },
  },
  {
    doc: 'Maximum course load per student is 23 credits',
    status: 'documented',
    rule: 'H11',
    note: 'Enforced at registration, not in the timetabling solver.',
  },
  {
    doc: 'PUC students must register for at least 12 credits during regular semesters',
    status: 'documented',
    rule: 'H11',
    note: 'PUC vs self-funded split is captured in Enrollment.',
  },
  {
    doc: 'Self-funded students may register between 3 and 23 credits',
    status: 'documented',
    rule: 'H11',
  },
  {
    doc: 'Courses scheduled to avoid conflicts for students following the major sheet plan',
    status: 'enforced',
    rule: 'H6',
    link: { seg: '/rules', label: 'Cohort no-conflict (H6)' },
  },
  {
    doc: 'General courses scheduled at times suitable across levels with instructor availability (e.g. Communication I, Omar Albarno 09:00–15:00)',
    status: 'enforced',
    rule: 'S1+S4',
    link: { seg: '/instructors', label: 'Instructor availability windows' },
    note: 'S4 prefers general courses in 09:00–14:00; S1 respects each instructor’s availability windows.',
  },
  {
    doc: 'Maximum teaching load per academic per day is 6 hours',
    status: 'enforced',
    rule: 'H8',
    link: { seg: '/instructors', label: 'Daily cap per instructor' },
  },
  {
    doc: 'Lecture duration follows credit hours: 3-credit → 3×50 or 2×75; 4-credit → 3×75 or 2×120',
    status: 'enforced',
    rule: 'H9',
    link: { seg: '/courses', label: 'Lecture pattern per course' },
  },
  {
    doc: 'CP and IAWD courses split between lecture and lab (4 credits = 2 h lecture + 2 h lab)',
    status: 'enforced',
    rule: 'H9',
    link: { seg: '/courses', label: 'Type = lecture+lab, pattern = lab+lecture' },
  },
  {
    doc: 'Some courses have credit hours that differ from actual teaching hours (to be confirmed with faculty)',
    status: 'editable',
    link: { seg: '/courses', label: 'Teaching hours field on Courses' },
  },
  {
    doc: "Each academic's timetable must be free of scheduling conflicts",
    status: 'enforced',
    rule: 'H1',
    link: { seg: '/rules', label: 'Instructor no double-booking (H1)' },
  },
  {
    doc: 'Rooms / halls must not be double-booked; no sessions overlap',
    status: 'enforced',
    rule: 'H2',
    link: { seg: '/rules', label: 'Room no double-booking (H2)' },
  },
  {
    doc: 'Section size must fit the assigned hall capacity',
    status: 'enforced',
    rule: 'H3',
    link: { seg: '/rooms', label: 'Room capacity' },
  },
  {
    doc: 'Fixed slot reserved for all academics on Monday 11:00–12:00 (no lectures scheduled)',
    status: 'enforced',
    rule: 'H7',
    link: { seg: '/settings', label: 'Reserved block (editable)' },
  },
  {
    doc: 'Merged courses (e.g. ACC0014 & ACC2201) must be scheduled in the same hall at the same time',
    status: 'enforced',
    rule: 'H5',
    link: { seg: '/merged', label: 'Merged groups' },
  },
  {
    doc: 'Ability to remove courses if HODs decide not to offer them',
    status: 'editable',
    link: { seg: '/courses', label: 'Delete on Courses page' },
  },
  {
    doc: 'Ability to set or modify academic staff schedules and availability',
    status: 'editable',
    link: { seg: '/instructors', label: 'Availability windows on Instructors' },
  },
  {
    doc: 'Ability to add new academic staff members',
    status: 'editable',
    link: { seg: '/instructors', label: '+ Add on Instructors' },
  },
  {
    doc: 'Ability to add or update hall details, including capacity',
    status: 'editable',
    link: { seg: '/rooms', label: 'Rooms editor' },
  },
  {
    doc: 'Ability to create customized schedules for students who require independent sections',
    status: 'editable',
    link: { seg: '/sections', label: 'Independent sections editor' },
  },
]

const BADGE_TONE: Record<Status, 'green' | 'red' | 'amber' | 'muted'> = {
  enforced: 'green',
  editable: 'amber',
  reference: 'muted',
  documented: 'muted',
}
const BADGE_LABEL: Record<Status, string> = {
  enforced: 'Enforced',
  editable: 'Editable',
  reference: 'Reference',
  documented: 'Documented',
}

export default function PolicyPage({ params }: { params: { id: string } }) {
  const base = `/s/${params.id}`
  const counts = ITEMS.reduce(
    (acc, it) => {
      acc[it.status]++
      return acc
    },
    { enforced: 0, editable: 0, reference: 0, documented: 0 } as Record<Status, number>,
  )

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Policy</div>
          <h1>Schedule Process and Rules — coverage</h1>
          <div className="sub">
            Every item from CCK&apos;s policy document, mapped to where it lives on this site.
          </div>
        </div>
      </header>

      <div className="flex flex-wrap gap-2 mb-5">
        <Badge tone="green" dot>{counts.enforced} enforced</Badge>
        <Badge tone="amber" dot>{counts.editable} editable</Badge>
        <Badge tone="muted" dot>{counts.documented} documented</Badge>
        <Badge tone="muted" dot>{counts.reference} reference</Badge>
      </div>

      <div className="card-flat" style={{ overflow: 'auto' }}>
        <table className="cck">
          <thead>
            <tr>
              <th style={{ width: 44 }}>#</th>
              <th>Policy item</th>
              <th style={{ width: 110 }}>Status</th>
              <th style={{ width: 80 }}>Rule</th>
              <th>Where on the site</th>
            </tr>
          </thead>
          <tbody>
            {ITEMS.map((it, i) => (
              <tr key={i}>
                <td className="num text-caption">{i + 1}</td>
                <td>
                  <div>{it.doc}</div>
                  {it.note && (
                    <div className="text-caption" style={{ marginTop: 4 }}>{it.note}</div>
                  )}
                </td>
                <td>
                  <Badge tone={BADGE_TONE[it.status]} dot>{BADGE_LABEL[it.status]}</Badge>
                </td>
                <td>
                  {it.rule ? <span className="text-mono" style={{ fontSize: 12 }}>{it.rule}</span> : <span className="text-caption">—</span>}
                </td>
                <td>
                  {it.link ? (
                    <Link
                      href={`${base}${it.link.seg}`}
                      style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: 13, fontWeight: 500 }}
                      className="inline-flex items-center gap-1"
                    >
                      {it.link.label} <ExternalLink size={11} />
                    </Link>
                  ) : (
                    <span className="text-caption">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}

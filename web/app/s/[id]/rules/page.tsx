import { getConfig } from '@/lib/config'
import { CustomRulesEditor } from '@/components/CustomRulesEditor'
import { Badge } from '@/components/ui'

export const dynamic = 'force-dynamic'

const RULES = [
  { id: 'H1', name: 'Instructor no double-booking', kind: 'hard', weight: 1, description: 'No instructor is scheduled to teach two sections at the same time.' },
  { id: 'H2', name: 'Room no double-booking', kind: 'hard', weight: 1, description: 'No room is double-booked at the same time.' },
  { id: 'H3', name: 'Capacity ≥ enrollment', kind: 'hard', weight: 1, description: 'Section enrollment cap ≤ room capacity.' },
  { id: 'H4', name: 'Labs in lab rooms', kind: 'hard', weight: 1, description: "Labs must be in lab-type or special-purpose rooms; lectures may not occupy pure labs." },
  { id: 'H5', name: 'Merged courses co-scheduled', kind: 'hard', weight: 1, description: 'Merged courses share the same room, time slot, and instructor.' },
  { id: 'H6', name: 'Cohort no-conflict', kind: 'hard', weight: 1, description: 'Required courses on the same major-sheet semester block must not overlap in time.' },
  { id: 'H7', name: 'Reserved block', kind: 'hard', weight: 1, description: 'A college-wide reserved hold (default: Monday 11:00–12:00). Configurable in Term settings.' },
  { id: 'H8', name: 'Daily teaching cap', kind: 'hard', weight: 1, description: 'Maximum 6 teaching hours per academic per day (12 for HOD).' },
  { id: 'H9', name: 'Duration matches credits', kind: 'hard', weight: 1, description: 'Lecture duration must match the credit-to-duration rule.' },
  { id: 'H10', name: 'Weekly teaching cap by rank', kind: 'hard', weight: 1, description: 'HOD 12h, Prof 15h, Assoc/Asst Prof 20h, Lecturer 25h, Instructor 30h.' },
  { id: 'H11', name: 'Student credit cap', kind: 'hard', weight: 1, description: '23 credits max; enforced at registration, not the solver.' },
  { id: 'H12', name: 'Operating window', kind: 'hard', weight: 1, description: 'Classes only within the operating days and window. Configurable in Term settings.' },
  { id: 'H13', name: 'Instructor certification', kind: 'hard', weight: 1, description: 'Instructor must be certified for the course.' },
  { id: 'H14', name: 'Section language matches bucket', kind: 'hard', weight: 1, description: 'Section language must match the demand bucket assigned by Stage 1.' },
  { id: 'S1', name: 'Honor instructor availability windows', kind: 'soft', weight: 5, description: 'Prefer slots inside each instructor’s stated availability.' },
  { id: 'S2', name: 'Minimize instructor day gaps', kind: 'soft', weight: 2, description: 'Compact teaching is preferred to scattered.' },
  { id: 'S3', name: 'Balance instructor loads within rank', kind: 'soft', weight: 2, description: 'Avoid maxing one PT while another is empty.' },
  { id: 'S4', name: 'General courses in core hours', kind: 'soft', weight: 3, description: 'GE/foundation courses preferred in 09:00–14:00.' },
  { id: 'S5', name: 'Evening sections for working students', kind: 'soft', weight: 4, description: 'Working-student sections should land after 17:00.' },
  { id: 'S6', name: 'Avoid floor-hopping back-to-back', kind: 'soft', weight: 1, description: "Don't put the same instructor in back-to-back classes on different floors." },
  { id: 'S7', name: 'Same room across weekly meetings', kind: 'soft', weight: 2, description: "Keep a course's multi-meeting pattern in the same room." },
  { id: 'S8', name: 'PUC priority over self-funded', kind: 'soft', weight: 1, description: 'When trade-offs are forced, prioritize PUC cohorts.' },
  { id: 'S9', name: 'Minimize disruption on re-solve', kind: 'soft', weight: 3, description: 'Keep pinned sections in place if possible.' },
] as const

export default function RulesPage({ params }: { params: { id: string } }) {
  const config = getConfig(params.id)
  const hard = RULES.filter((r) => r.kind === 'hard')
  const soft = RULES.filter((r) => r.kind === 'soft')

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Policy</div>
          <h1>Rules</h1>
          <div className="sub">
            {hard.length} hard + {soft.length} soft built-in rules · {config.customRules.length} custom
            rule{config.customRules.length === 1 ? '' : 's'}. Built-ins are always active; custom rules
            layer on top.
          </div>
        </div>
      </header>

      <section className="mb-8">
        <CustomRulesEditor scheduleId={params.id} initialRules={config.customRules} />
      </section>

      <section className="mb-8">
        <h2 className="text-h2 mb-1">Built-in hard rules</h2>
        <p className="text-caption mb-3">
          Always required. A solution that violates any of these is rejected before being reported.
        </p>
        <div className="card-flat" style={{ overflow: 'auto' }}>
          <table className="cck">
            <thead>
              <tr>
                <th style={{ width: 56 }}>ID</th>
                <th>Name</th>
                <th>Description</th>
                <th style={{ width: 110 }}>On failure</th>
              </tr>
            </thead>
            <tbody>
              {hard.map((r) => (
                <tr key={r.id}>
                  <td><Badge tone="red">{r.id}</Badge></td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td>{r.description}</td>
                  <td><Badge tone="red" dot>Required</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-h2 mb-1">Built-in soft rules</h2>
        <p className="text-caption mb-3">
          Solver objective terms. Higher weight = stronger preference, but a violation does not reject the solution.
        </p>
        <div className="card-flat" style={{ overflow: 'auto' }}>
          <table className="cck">
            <thead>
              <tr>
                <th style={{ width: 56 }}>ID</th>
                <th>Name</th>
                <th style={{ width: 80 }}>Weight</th>
                <th>Description</th>
                <th style={{ width: 110 }}>On failure</th>
              </tr>
            </thead>
            <tbody>
              {soft.map((r) => (
                <tr key={r.id}>
                  <td><Badge tone="muted">{r.id}</Badge></td>
                  <td style={{ fontWeight: 600 }}>{r.name}</td>
                  <td className="tabular">{r.weight}</td>
                  <td>{r.description}</td>
                  <td><Badge tone="amber" dot>Warning</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

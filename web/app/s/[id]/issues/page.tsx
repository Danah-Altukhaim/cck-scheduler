import { getTermPlan } from '@/lib/data'
import { IssuesView, type IssueGroup } from './IssuesView'

export const dynamic = 'force-dynamic'

const ISSUE_META: Record<string, { description: string; severity: IssueGroup['severity']; fix?: IssueGroup['fixHint'] }> = {
  DURATION_DEVIATION: {
    description: 'SIS slot duration outside the canonical {50, 75, 100, 120} set — likely a manual override.',
    severity: 'warn',
  },
  SLOT_PARSE_FAIL: {
    description: 'Slot string contains a `<br/>` separator we cannot disambiguate.',
    severity: 'warn',
  },
  DAY_FIVE_DAYS: {
    description: '5-day pattern in SIS (Su,M,T,W,Th). Almost certainly a typo for a 2- or 3-day pattern.',
    severity: 'warn',
  },
  DAY_DUPLICATE: {
    description: 'Day letter repeated in the day pattern (e.g. "M,Th,Th").',
    severity: 'warn',
  },
  DAY_MISSING: {
    description: 'Day column was empty in the SIS row. Kept but flagged.',
    severity: 'warn',
  },
  DAY_SATURDAY: {
    description: 'Saturday class. Saturday is off the academic week by default.',
    severity: 'warn',
  },
  METHOD_STRAY: {
    description: 'Teaching Method column held a value outside {Lecture, Lab}.',
    severity: 'warn',
  },
  CERT_COURSE_UNRESOLVED: {
    description: 'Certification row referenced a course name we could not match to a course code.',
    severity: 'warn',
  },
  INSTRUCTOR_GHOST: {
    description: 'Instructor appears in past schedules but is not in the current roster. Added as `missing-from-roster`.',
    severity: 'warn',
  },
  MAJOR_MISSING: {
    description: 'Program is in the catalog but has no plan-of-study sheet.',
    severity: 'error',
  },
}

export default function IssuesPage({ params }: { params: { id: string } }) {
  const plan = getTermPlan(params.id)

  const accumulator = new Map<string, IssueGroup>()
  for (const rep of plan.reports ?? []) {
    const byCode = new Map<string, string[]>()
    for (const w of rep.warnings) {
      if (!byCode.has(w.code)) byCode.set(w.code, [])
      byCode.get(w.code)!.push(w.message)
    }
    for (const [code, msgs] of byCode) {
      const meta = ISSUE_META[code] ?? { description: '—', severity: 'warn' as const }
      if (!accumulator.has(code)) {
        accumulator.set(code, {
          code,
          description: meta.description,
          severity: meta.severity,
          fixHint: meta.fix,
          total: 0,
          sources: [],
        })
      }
      const g = accumulator.get(code)!
      g.total += msgs.length
      g.sources.push({
        source: rep.source.split('/').pop() || rep.source,
        count: msgs.length,
        samples: msgs.slice(0, 3),
      })
    }
  }

  const groups = Array.from(accumulator.values())

  return <IssuesView groups={groups} scheduleId={params.id} />
}

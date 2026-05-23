import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getTermPlan } from '@/lib/data'

export const dynamic = 'force-dynamic'

const ISSUE_DESCRIPTIONS: Record<string, string> = {
  DURATION_DEVIATION: 'SIS slot duration not in {50, 75, 100, 120} canonical set. Likely manual override.',
  SLOT_PARSE_FAIL: 'Slot string contains "<br/>" separator we cannot disambiguate.',
  DAY_FIVE_DAYS: '5-day pattern in SIS (Su,M,T,W,Th). Almost certainly a typo for a 2- or 3-day pattern.',
  DAY_DUPLICATE: 'Day-letter repeated in the day pattern (e.g. "M,Th,Th").',
  DAY_MISSING: 'Day column was empty in the SIS row. Kept but flagged.',
  DAY_SATURDAY: 'Saturday class. Flagged because Sa is off-week by default.',
  METHOD_STRAY: 'Teaching Method column held a non-{Lecture, Lab} value.',
  CERT_COURSE_UNRESOLVED: 'Certification row referenced a course name we could not match to a code.',
  INSTRUCTOR_GHOST: 'Instructor appears in past schedules but not in the roster (added as missing-from-roster).',
  MAJOR_MISSING: 'Program is in the catalog but has no plan-of-study sheet in source.',
}

export default function IssuesPage({ params }: { params: { id: string } }) {
  const plan = getTermPlan(params.id)

  const grouped = new Map<string, { source: string; samples: string[]; count: number }[]>()
  for (const rep of plan.reports ?? []) {
    const codeBuckets = new Map<string, string[]>()
    for (const w of rep.warnings) {
      if (!codeBuckets.has(w.code)) codeBuckets.set(w.code, [])
      codeBuckets.get(w.code)!.push(w.message)
    }
    for (const [code, samples] of codeBuckets) {
      if (!grouped.has(code)) grouped.set(code, [])
      grouped.get(code)!.push({
        source: rep.source.split('/').pop() || rep.source,
        samples: samples.slice(0, 3),
        count: samples.length,
      })
    }
  }

  const codes = [...grouped.entries()]
    .map(([code, sources]) => ({ code, sources, total: sources.reduce((a, b) => a + b.count, 0) }))
    .sort((a, b) => b.total - a.total)

  return (
    <div className="space-y-5">
      <Link
        href={`/s/${params.id}/schedule`}
        className="inline-flex items-center gap-1 text-sm text-cck-muted hover:text-cck-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Schedule
      </Link>
      <header>
        <h1 className="text-2xl font-bold">Data quality issues</h1>
        <p className="text-sm text-cck-muted mt-1">
          {codes.length} distinct warning types from ingestion · {codes.reduce((a, b) => a + b.total, 0)} total
        </p>
      </header>

      {codes.length === 0 && (
        <div className="border border-cck-line rounded-md bg-white p-6 text-sm text-cck-muted">
          No data-quality issues recorded for this schedule.
        </div>
      )}
      <div className="space-y-4">
        {codes.map(({ code, sources, total }) => (
          <div key={code} className="border border-cck-line rounded-md bg-white p-4">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="badge red">{code}</span>
                <span className="ml-3 text-sm text-cck-muted">{ISSUE_DESCRIPTIONS[code] || '-'}</span>
              </div>
              <span className="text-lg font-bold font-mono">{total}</span>
            </div>
            <div className="mt-3 space-y-2">
              {sources.map((src, i) => (
                <div key={i} className="text-xs">
                  <span className="text-cck-muted">{src.source}</span>
                  <span className="ml-2 font-mono">({src.count})</span>
                  <ul className="mt-1 list-disc pl-5 text-cck-muted">
                    {src.samples.map((s, j) => (
                      <li key={j} className="font-mono text-[11px]">{s}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

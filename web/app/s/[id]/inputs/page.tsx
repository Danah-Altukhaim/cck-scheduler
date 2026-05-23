import Link from 'next/link'
import { BookOpen, Users, DoorOpen, GraduationCap, Layers, UserPlus, ArrowRight, FileText, Download } from 'lucide-react'
import { getTermPlan } from '@/lib/data'
import { listRefDocs, formatBytes } from '@/lib/docs'

export const dynamic = 'force-dynamic'

export default function InputsPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const base = `/s/${sid}`
  const plan = getTermPlan(sid)
  const students = (plan.enrollment ?? []).reduce((s, r) => s + (r.count || 0), 0)
  const refs = listRefDocs()

  const cards = [
    { seg: '/enrollment', name: 'Enrollment', count: students, Icon: UserPlus, desc: 'Projected students this term, by major, language and profile.' },
    { seg: '/courses', name: 'Courses', count: plan.courses.length, Icon: BookOpen, desc: 'The classes to schedule this term.' },
    { seg: '/instructors', name: 'Instructors', count: plan.instructors.length, Icon: Users, desc: 'Who can teach, and their weekly hour limits.' },
    { seg: '/rooms', name: 'Rooms', count: plan.rooms.length, Icon: DoorOpen, desc: 'Where classes can be held, and how many seats.' },
    { seg: '/majors', name: 'Majors', count: plan.majors.length, Icon: GraduationCap, desc: 'Programs and the courses each term requires.' },
    { seg: '/merged', name: 'Merged groups', count: plan.merged_groups.length, Icon: Layers, desc: 'Courses taught together as one class.' },
  ]

  return (
    <div className="space-y-7">
      <header>
        <div className="text-xs font-semibold text-cck-green uppercase tracking-wide">Step 1 of 4</div>
        <h1 className="text-3xl font-bold mt-1.5">Term inputs</h1>
        <p className="text-[15px] text-cck-muted mt-1.5 max-w-2xl">
          The dataset below defines the constraints for this term&rsquo;s schedule. Values are
          carried forward from the base template; adjust any that differ for the current term
          before proceeding.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <Link key={c.seg} href={`${base}${c.seg}`} className="card card-link p-5">
            <div className="flex items-start justify-between">
              <div
                className="flex items-center justify-center rounded-lg"
                style={{ width: 40, height: 40, background: '#e6f0eb' }}
              >
                <c.Icon className="h-5 w-5" style={{ color: '#006341' }} />
              </div>
              <div className="text-3xl font-bold tabular-nums leading-none">{c.count}</div>
            </div>
            <div className="font-semibold text-[15px] mt-4">{c.name}</div>
            <div className="text-sm text-cck-muted mt-0.5">{c.desc}</div>
            <div className="flex items-center gap-1 text-sm font-medium text-cck-green mt-3">
              Review &amp; edit <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>

      <section id="references" className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg font-semibold">Reference documents</h2>
          <p className="text-sm text-cck-muted">
            Source materials referenced by CCK&rsquo;s Schedule Process and Rules document.
          </p>
        </div>
        <div className="border border-cck-line rounded-md bg-white overflow-hidden">
          <table className="cck">
            <thead>
              <tr>
                <th>Document</th>
                <th>Maps to</th>
                <th style={{ width: 90 }}>Size</th>
                <th style={{ width: 90 }}>Status</th>
                <th style={{ width: 140, textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {refs.map((r) => (
                <tr key={r.slug}>
                  <td>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-cck-muted" />
                      <div>
                        <div className="font-medium">{r.label}</div>
                        <div className="text-xs text-cck-muted">{r.file}</div>
                      </div>
                    </div>
                  </td>
                  <td className="text-sm text-cck-muted">{r.policyHint}</td>
                  <td className="text-sm text-cck-muted">{formatBytes(r.size)}</td>
                  <td>
                    {r.exists ? (
                      <span className="badge green">loaded</span>
                    ) : (
                      <span className="badge red">missing</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {r.exists ? (
                      <>
                        <a
                          href={`/api/refs/${r.slug}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-cck-red hover:underline"
                        >
                          Open
                        </a>
                        <a
                          href={`/api/refs/${r.slug}?download=1`}
                          className="text-sm text-cck-muted hover:underline ml-3 inline-flex items-center gap-1"
                        >
                          <Download className="h-3 w-3" /> Download
                        </a>
                      </>
                    ) : (
                      <span className="text-sm text-cck-muted">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex items-center justify-end border-t border-cck-line pt-5">
        <Link href={`${base}/constraints`} className="btn-primary">
          Continue to Step 2: Rules <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

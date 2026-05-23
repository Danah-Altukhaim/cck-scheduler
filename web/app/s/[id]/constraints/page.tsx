import Link from 'next/link'
import { SlidersHorizontal, Scale, FileCheck, ArrowRight, ArrowLeft } from 'lucide-react'
import { getConfig } from '@/lib/config'

export const dynamic = 'force-dynamic'

export default function ConstraintsPage({ params }: { params: { id: string } }) {
  const sid = params.id
  const base = `/s/${sid}`
  const config = getConfig(sid)

  const cards = [
    {
      seg: '/settings',
      name: 'Settings',
      Icon: SlidersHorizontal,
      desc: 'Operating days and hours, the reserved block, time-of-day windows, and the working-student share.',
      summary: `${config.operatingDays.length} operating days`,
    },
    {
      seg: '/rules',
      name: 'Rules',
      Icon: Scale,
      desc: 'The 14 hard and 9 soft built-in rules, plus any custom rules you add for this term.',
      summary: `${config.customRules.length} custom rule${config.customRules.length === 1 ? '' : 's'}`,
    },
    {
      seg: '/policy',
      name: 'Policy coverage',
      Icon: FileCheck,
      desc: 'How every line of CCK’s Schedule Process and Rules document maps to this site.',
      summary: '24 items',
    },
  ]

  return (
    <div className="space-y-7">
      <header>
        <div className="text-xs font-semibold text-cck-green uppercase tracking-wide">Step 2 of 4</div>
        <h1 className="text-3xl font-bold mt-1.5">Set your rules</h1>
        <p className="text-[15px] text-cck-muted mt-1.5 max-w-2xl">
          Adjust the constraints the schedule must respect. The defaults work for a standard term.
          Change them only if this term is different.
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
              <span className="badge muted">{c.summary}</span>
            </div>
            <div className="font-semibold text-[15px] mt-4">{c.name}</div>
            <div className="text-sm text-cck-muted mt-0.5">{c.desc}</div>
            <div className="flex items-center gap-1 text-sm font-medium text-cck-green mt-3">
              Open <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-cck-line pt-5">
        <Link href={`${base}/inputs`} className="btn-secondary">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <Link href={`${base}/generate`} className="btn-primary">
          Continue to Step 3: Generate <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  )
}

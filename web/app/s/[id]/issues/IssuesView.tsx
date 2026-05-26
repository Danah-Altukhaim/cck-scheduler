'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CheckCircle2, ChevronRight, FileText, Search } from 'lucide-react'
import { Badge, EmptyState, Segment, StaticTabs, StatusIcon } from '@/components/ui'

export interface IssueGroup {
  code: string
  description: string
  severity: 'error' | 'warn' | 'info'
  fixHint?: { label: string; href: string }
  total: number
  sources: { source: string; count: number; samples: string[] }[]
}

export function IssuesView({ groups, scheduleId }: { groups: IssueGroup[]; scheduleId: string }) {
  void scheduleId
  const [tab, setTab] = useState<'all' | 'error' | 'warn'>('all')
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sort, setSort] = useState<'count' | 'severity' | 'code'>('count')

  const tally = useMemo(() => {
    const t = { all: groups.length, error: 0, warn: 0 }
    for (const g of groups) {
      if (g.severity === 'error') t.error++
      if (g.severity === 'warn') t.warn++
    }
    return t
  }, [groups])

  const filtered = useMemo(() => {
    let out = groups.slice()
    if (tab !== 'all') out = out.filter((g) => g.severity === tab)
    const q = search.trim().toLowerCase()
    if (q) out = out.filter((g) => `${g.code} ${g.description}`.toLowerCase().includes(q))
    if (sort === 'count') out.sort((a, b) => b.total - a.total)
    else if (sort === 'severity')
      out.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity))
    else out.sort((a, b) => a.code.localeCompare(b.code))
    return out
  }, [groups, tab, search, sort])

  function toggleExpand(code: string) {
    setExpanded((cur) => {
      const n = new Set(cur)
      if (n.has(code)) n.delete(code)
      else n.add(code)
      return n
    })
  }

  const totalIssues = groups.reduce((a, b) => a + b.total, 0)

  return (
    <main className="page">
      <header className="page-header">
        <div className="title-block">
          <div className="eyebrow">Solve</div>
          <h1>Data quality</h1>
          <div className="sub">
            {totalIssues === 0
              ? 'No issues recorded — every ingest report came back clean.'
              : `${groups.length} distinct warning type${groups.length === 1 ? '' : 's'} from ingestion · ${totalIssues} total occurrence${totalIssues === 1 ? '' : 's'}.`}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="kpi">
          <div className="label">Total occurrences</div>
          <div className="value">{totalIssues.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="label">Warning types</div>
          <div className="value">{tally.all}</div>
        </div>
        <div className="kpi" style={{ borderColor: tally.error > 0 ? 'var(--danger-strong)' : undefined }}>
          <div className="label" style={{ color: 'var(--danger)' }}>Blocking</div>
          <div className="value">{tally.error}</div>
        </div>
        <div className="kpi" style={{ borderColor: tally.warn > 0 ? 'var(--warn-strong)' : undefined }}>
          <div className="label" style={{ color: 'var(--warn)' }}>Warning</div>
          <div className="value">{tally.warn}</div>
        </div>
      </section>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <StaticTabs<'all' | 'error' | 'warn'>
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: 'All', count: tally.all },
            { value: 'error', label: 'Blocking', count: tally.error },
            { value: 'warn', label: 'Warning', count: tally.warn },
          ]}
        />
        <div style={{ position: 'relative', minWidth: 220, flex: 1 }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }}
          />
          <input
            type="search"
            className="input"
            placeholder="Search issue code or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 28 }}
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-label">Sort</span>
          <Segment<'count' | 'severity' | 'code'>
            value={sort}
            onChange={setSort}
            size="sm"
            options={[
              { value: 'count', label: 'Occurrences' },
              { value: 'severity', label: 'Severity' },
              { value: 'code', label: 'Code' },
            ]}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<CheckCircle2 size={22} color="var(--success)" />}
            title={groups.length === 0 ? 'No data-quality issues' : 'Nothing matches'}
            description={
              groups.length === 0
                ? 'Every ingest report came back clean for this schedule.'
                : 'Try a different search or switch tabs.'
            }
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((g) => {
            const isOpen = expanded.has(g.code)
            const tone: 'red' | 'amber' = g.severity === 'error' ? 'red' : 'amber'
            return (
              <div key={g.code} className="card-flat">
                <button
                  type="button"
                  onClick={() => toggleExpand(g.code)}
                  style={{
                    display: 'flex',
                    width: '100%',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <StatusIcon status={g.severity === 'error' ? 'error' : 'warn'} />
                  <Badge tone={tone}>{g.code}</Badge>
                  <div className="flex-fill">
                    <div className="text-body-sm">{g.description}</div>
                  </div>
                  <span className="text-h3 tabular">{g.total}</span>
                  <ChevronRight
                    size={16}
                    color="var(--muted)"
                    style={{ transform: isOpen ? 'rotate(90deg)' : undefined, transition: 'transform 150ms' }}
                  />
                </button>

                {isOpen && (
                  <div style={{ padding: '4px 16px 16px', borderTop: '1px solid var(--line-soft)' }}>
                    {g.fixHint && (
                      <div className="flex items-center gap-2 mb-3 text-body-sm">
                        <AlertTriangle size={13} color="var(--warn)" />
                        <span>Most efficient fix:</span>
                        <Link href={g.fixHint.href} className="btn btn-secondary btn-sm">
                          {g.fixHint.label} <ChevronRight size={12} />
                        </Link>
                      </div>
                    )}
                    <div className="text-label mb-2">By source</div>
                    <div className="flex flex-col gap-2">
                      {g.sources.map((src, i) => (
                        <div key={i} className="card-flat" style={{ padding: '10px 12px' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <FileText size={13} color="var(--muted)" />
                            <span className="text-body-sm" style={{ fontWeight: 600 }}>{src.source}</span>
                            <Badge tone="muted">{src.count} hit{src.count === 1 ? '' : 's'}</Badge>
                          </div>
                          <ul className="flex flex-col gap-1">
                            {src.samples.map((s, j) => (
                              <li
                                key={j}
                                className="text-mono"
                                style={{
                                  fontSize: 11.5,
                                  color: 'var(--muted)',
                                  background: 'var(--surface-2)',
                                  padding: '4px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                }}
                              >
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}

function severityWeight(s: IssueGroup['severity']): number {
  return s === 'error' ? 3 : s === 'warn' ? 2 : 1
}

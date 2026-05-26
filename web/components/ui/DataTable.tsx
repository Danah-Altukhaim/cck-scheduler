'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, Settings2, X } from 'lucide-react'
import { Button } from './Button'
import { EmptyState } from './EmptyState'

export interface Column<T> {
  key: string
  header: ReactNode
  /** Get the raw cell value for sorting/filtering. Defaults to row[key]. */
  accessor?: (row: T) => unknown
  render?: (row: T) => ReactNode
  sortable?: boolean
  align?: 'left' | 'right' | 'center'
  width?: number | string
  defaultHidden?: boolean
  /** Tells the table whether a column counts as "code" font. */
  mono?: boolean
}

export interface DataTableProps<T> {
  rows: T[]
  columns: Column<T>[]
  rowKey: (row: T) => string
  /** Wrap a row in something custom (e.g. add onClick / link) */
  rowProps?: (row: T) => React.HTMLAttributes<HTMLTableRowElement>
  /** Filter input text — searched against accessor for every visible column */
  search?: string
  /** Show top toolbar with search input + column-visibility toggle. */
  toolbar?: boolean
  /** Add a "Selected" toolbar showing N selected and bulk actions */
  bulkActions?: (selectedKeys: string[], clear: () => void) => ReactNode
  emptyState?: ReactNode
  /** Storage key for column visibility + sort persistence. */
  storageKey?: string
  /** Initial sort column key. */
  defaultSortKey?: string
  defaultSortDir?: 'asc' | 'desc'
  pageSize?: number | 'all'
  /** Render extra controls to the right of search input */
  toolbarExtras?: ReactNode
  className?: string
  /** Optional id used to namespace bulk-select state. */
  density?: 'cozy' | 'compact'
}

interface PersistedState {
  sortKey?: string
  sortDir?: 'asc' | 'desc'
  hidden?: string[]
}

function loadState(key?: string): PersistedState {
  if (!key) return {}
  try {
    const raw = window.localStorage.getItem(`dt:${key}`)
    return raw ? (JSON.parse(raw) as PersistedState) : {}
  } catch {
    return {}
  }
}
function saveState(key: string, state: PersistedState) {
  try {
    window.localStorage.setItem(`dt:${key}`, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowProps,
  search,
  toolbar = true,
  bulkActions,
  emptyState,
  storageKey,
  defaultSortKey,
  defaultSortDir = 'asc',
  pageSize = 50,
  toolbarExtras,
  className,
  density = 'cozy',
}: DataTableProps<T>) {
  const [innerSearch, setInnerSearch] = useState('')
  const effectiveSearch = (search ?? innerSearch).trim().toLowerCase()
  const [sortKey, setSortKey] = useState<string | undefined>(defaultSortKey)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir)
  const [hidden, setHidden] = useState<string[]>(
    columns.filter((c) => c.defaultHidden).map((c) => c.key),
  )
  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  // hydrate persisted state
  useEffect(() => {
    if (!storageKey) return
    const s = loadState(storageKey)
    if (s.sortKey) setSortKey(s.sortKey)
    if (s.sortDir) setSortDir(s.sortDir)
    if (s.hidden) setHidden(s.hidden)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    saveState(storageKey, { sortKey, sortDir, hidden })
  }, [storageKey, sortKey, sortDir, hidden])

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hidden.includes(c.key)),
    [columns, hidden],
  )

  const accessorOf = (col: Column<T>, row: T): unknown => {
    if (col.accessor) return col.accessor(row)
    // @ts-expect-error generic key access
    return row[col.key]
  }

  const filtered = useMemo(() => {
    if (!effectiveSearch) return rows
    return rows.filter((r) => {
      for (const col of columns) {
        const v = accessorOf(col, r)
        if (v == null) continue
        if (String(v).toLowerCase().includes(effectiveSearch)) return true
      }
      return false
    })
  }, [rows, columns, effectiveSearch])

  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    const col = columns.find((c) => c.key === sortKey)
    if (!col) return filtered
    const copy = [...filtered]
    copy.sort((a, b) => {
      const va = accessorOf(col, a)
      const vb = accessorOf(col, b)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      if (typeof va === 'number' && typeof vb === 'number') return sortDir === 'asc' ? va - vb : vb - va
      const sa = String(va)
      const sb = String(vb)
      const cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: 'base' })
      return sortDir === 'asc' ? cmp : -cmp
    })
    return copy
  }, [filtered, sortKey, sortDir, columns])

  const total = sorted.length
  const paged =
    pageSize === 'all'
      ? sorted
      : sorted.slice(page * pageSize, page * pageSize + pageSize)

  useEffect(() => {
    setPage(0)
  }, [effectiveSearch, sortKey, sortDir])

  function toggleSort(key: string) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
    } else if (sortDir === 'asc') {
      setSortDir('desc')
    } else {
      setSortKey(undefined)
    }
  }

  function toggleHidden(key: string) {
    setHidden((h) => (h.includes(key) ? h.filter((k) => k !== key) : [...h, key]))
  }

  function toggleSelected(key: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })
  }

  function selectAllOnPage(checked: boolean) {
    setSelected((s) => {
      const n = new Set(s)
      for (const r of paged) {
        const k = rowKey(r)
        if (checked) n.add(k)
        else n.delete(k)
      }
      return n
    })
  }

  const allOnPageChecked = paged.length > 0 && paged.every((r) => selected.has(rowKey(r)))
  const someOnPageChecked = paged.some((r) => selected.has(rowKey(r)))

  const padding = density === 'compact' ? '7px 12px' : '9px 14px'

  return (
    <div className={`flex flex-col gap-3 ${className ?? ''}`}>
      {toolbar && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--muted)',
              }}
            />
            <input
              type="text"
              className="input"
              placeholder="Search…"
              value={search ?? innerSearch}
              onChange={(e) => setInnerSearch(e.target.value)}
              style={{ paddingLeft: 28 }}
            />
            {(search ?? innerSearch).length > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setInnerSearch('')}
                aria-label="Clear search"
                style={{ position: 'absolute', right: 2, top: 2 }}
              >
                <X size={12} />
              </button>
            )}
          </div>
          {toolbarExtras}
          <div className="relative ml-auto">
            <Button
              variant="ghost"
              size="sm"
              icon={<Settings2 size={14} />}
              onClick={() => setShowColumnMenu((s) => !s)}
            >
              Columns
            </Button>
            {showColumnMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  right: 0,
                  background: 'var(--surface)',
                  border: '1px solid var(--line)',
                  borderRadius: 'var(--radius-lg)',
                  boxShadow: 'var(--shadow-lg)',
                  padding: 6,
                  minWidth: 200,
                  zIndex: 10,
                }}
                onMouseLeave={() => setShowColumnMenu(false)}
              >
                <div className="text-label" style={{ padding: '6px 8px' }}>
                  Show columns
                </div>
                {columns.map((c) => (
                  <label
                    key={c.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '6px 8px',
                      borderRadius: 6,
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={!hidden.includes(c.key)}
                      onChange={() => toggleHidden(c.key)}
                    />
                    {c.header}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {bulkActions && selected.size > 0 && (
        <div
          className="card-flat flex items-center gap-3"
          style={{ padding: '7px 12px', background: 'var(--accent-soft)' }}
        >
          <span className="text-body-sm" style={{ fontWeight: 600 }}>
            {selected.size} selected
          </span>
          <div className="flex-fill" />
          {bulkActions(Array.from(selected), () => setSelected(new Set()))}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
            icon={<X size={12} />}
            iconOnly
            aria-label="Clear selection"
          />
        </div>
      )}

      <div
        className="card-flat"
        style={{ overflow: 'auto', maxWidth: '100%' }}
      >
        <table className="cck">
          <thead>
            <tr>
              {bulkActions && (
                <th style={{ width: 40, padding }}>
                  <input
                    type="checkbox"
                    checked={allOnPageChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPageChecked && someOnPageChecked
                    }}
                    onChange={(e) => selectAllOnPage(e.target.checked)}
                    aria-label="Select all on page"
                  />
                </th>
              )}
              {visibleColumns.map((c) => {
                const active = sortKey === c.key
                return (
                  <th
                    key={c.key}
                    style={{
                      width: c.width,
                      textAlign: c.align ?? 'left',
                      padding,
                      cursor: c.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                  >
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      {c.header}
                      {c.sortable && (
                        <span style={{ color: active ? 'var(--ink)' : 'var(--muted-soft)' }}>
                          {active ? (
                            sortDir === 'asc' ? (
                              <ArrowUp size={11} />
                            ) : (
                              <ArrowDown size={11} />
                            )
                          ) : (
                            <ChevronsUpDown size={11} />
                          )}
                        </span>
                      )}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length + (bulkActions ? 1 : 0)}
                  style={{ padding: 0 }}
                >
                  {emptyState ?? (
                    <EmptyState
                      title="No matching rows"
                      description={
                        effectiveSearch
                          ? 'Try a different search term or clear the filter.'
                          : 'Add some data to get started.'
                      }
                    />
                  )}
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                const k = rowKey(row)
                const extra = rowProps?.(row) ?? {}
                const isSel = selected.has(k)
                return (
                  <tr key={k} {...extra} className={isSel ? 'selected' : extra.className}>
                    {bulkActions && (
                      <td style={{ padding }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSel}
                          onChange={() => toggleSelected(k)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {visibleColumns.map((c) => {
                      const val = c.render ? c.render(row) : (accessorOf(c, row) as ReactNode)
                      return (
                        <td
                          key={c.key}
                          style={{
                            textAlign: c.align ?? 'left',
                            padding,
                            fontFamily: c.mono ? 'JetBrains Mono, monospace' : undefined,
                            fontSize: c.mono ? 12.5 : undefined,
                          }}
                        >
                          {val as ReactNode}
                        </td>
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {pageSize !== 'all' && total > pageSize && (
        <div className="flex items-center gap-2 justify-end text-body-sm">
          <span className="text-caption">
            {page * pageSize + 1}–{Math.min((page + 1) * pageSize, total)} of {total}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setPage((p) => p + 1)}
            disabled={(page + 1) * pageSize >= total}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}

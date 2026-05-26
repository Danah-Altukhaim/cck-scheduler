export function Progress({
  value,
  max = 100,
  tone = 'default',
}: {
  value: number
  max?: number
  tone?: 'default' | 'warn' | 'danger'
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={`progress ${tone === 'default' ? '' : tone}`}>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

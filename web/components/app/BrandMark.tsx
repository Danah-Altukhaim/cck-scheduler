import type { CSSProperties } from 'react'

const BRAND_RED = '#e21c2a'
const BRAND_GREEN = '#006341'

interface BrandMarkProps {
  size?: number
  label?: string
  /** Compact mode renders only the maple leaf — fits in a narrow column. */
  compact?: boolean
  className?: string
  style?: CSSProperties
}

export function BrandMark({ size = 16, label, compact = false, className, style }: BrandMarkProps) {
  if (compact) {
    return (
      <span
        className={className}
        aria-label="Canadian College of Kuwait"
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
      >
        <MapleLeaf color={BRAND_RED} size={Math.round(size * 1.4)} />
      </span>
    )
  }
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0, ...style }}
    >
      <span
        aria-label="Canadian College of Kuwait"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, lineHeight: 1 }}
      >
        <span
          style={{
            fontWeight: 800,
            fontSize: size,
            color: BRAND_RED,
            letterSpacing: '-0.02em',
            fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
          }}
        >
          CCK
        </span>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 1.5,
            height: Math.round(size * 1.05),
            background: BRAND_GREEN,
            borderRadius: 1,
          }}
        />
        <MapleLeaf color={BRAND_RED} size={Math.round(size * 1.05)} />
      </span>
      {label && (
        <span
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: 'var(--ink)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            minWidth: 0,
          }}
        >
          {label}
        </span>
      )}
    </span>
  )
}

function MapleLeaf({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill={color}
      aria-hidden
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path d="M16 2.2l1.9 5.8 4.5-1.2-1.4 4.7 6.2-0.7-3.7 4.9 4 1.6-3.8 2.4 1.3 3.7-5.4-1 0.9 4.5-4.5-2.8-0.5 5.7-0.5-5.7-4.5 2.8 0.9-4.5-5.4 1 1.3-3.7-3.8-2.4 4-1.6-3.7-4.9 6.2 0.7-1.4-4.7 4.5 1.2z" />
    </svg>
  )
}

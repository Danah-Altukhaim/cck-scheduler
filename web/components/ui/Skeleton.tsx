export function Skeleton({
  width,
  height = 14,
  className = '',
  style,
}: {
  width?: number | string
  height?: number | string
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <span
      className={`skeleton inline-block ${className}`.trim()}
      style={{ width: width ?? '100%', height, ...(style ?? {}) }}
      aria-hidden="true"
    />
  )
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i}>
          <Skeleton width={`${60 + ((i * 13) % 30)}%`} />
        </td>
      ))}
    </tr>
  )
}

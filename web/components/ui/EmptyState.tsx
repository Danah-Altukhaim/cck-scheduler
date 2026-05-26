import type { ReactNode } from 'react'

export function EmptyState({
  icon,
  title,
  description,
  actions,
  className = '',
}: {
  icon?: ReactNode
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={`empty-state ${className}`.trim()}>
      {icon && <div className="icon-wrap">{icon}</div>}
      <div className="title">{title}</div>
      {description && <div className="desc">{description}</div>}
      {actions && <div className="actions">{actions}</div>}
    </div>
  )
}

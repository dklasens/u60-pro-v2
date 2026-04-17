interface CardProps {
  title?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
  tint?: 'blue' | 'orange' | 'purple' | 'green'
}

export default function Card({ title, children, className = '', action, tint }: CardProps) {
  const glassClass = tint
    ? `glass-tint-${tint}`
    : 'glass'
  return (
    <div className={`${glassClass} transition-all duration-200 hover:shadow-glass-elevated ${className}`}>
      {title && (
        <div className="flex items-center justify-between border-b border-divider px-5 py-3.5">
          <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

interface StatProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export function Stat({ label, value, sub, color = 'text-text-primary' }: StatProps) {
  return (
    <div>
      <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-text-muted">{sub}</p>}
    </div>
  )
}

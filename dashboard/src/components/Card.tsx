interface CardProps {
  title?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export default function Card({ title, children, className = '', action }: CardProps) {
  return (
    <div className={`bg-white/95 rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden ring-1 ring-slate-900/5 transition-all duration-150 ${className}`}>
      {title && (
        <div className="flex items-center justify-between bg-slate-50/80 backdrop-blur-md px-6 py-4 border-b border-slate-200/60">
          <h2 className="text-sm font-bold text-slate-800">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-6 space-y-5">{children}</div>
    </div>
  )
}

interface StatProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export function Stat({ label, value, sub, color = 'text-slate-800' }: StatProps) {
  return (
    <div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

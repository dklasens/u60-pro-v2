interface CardProps {
  title?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}

export default function Card({ title, children, className = '', action }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-macos-lg border border-black/5 transition-all duration-150 ${className}`}>
      {title && (
        <div className="flex items-center justify-between bg-white px-4 sm:px-6 py-4 border-b border-black/5 rounded-t-2xl">
          <h2 className="text-sm font-bold text-gray-900">{title}</h2>
          {action}
        </div>
      )}
      <div className="p-4 sm:p-6 space-y-5">{children}</div>
    </div>
  )
}

interface StatProps {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export function Stat({ label, value, sub, color = 'text-gray-900' }: StatProps) {
  return (
    <div>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

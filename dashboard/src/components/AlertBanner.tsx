import { useState, useEffect, useCallback } from 'react'
import { api, type BatteryDetail, type ThermalInfo } from '../api'

interface Alert {
  level: 'warning' | 'error'
  message: string
}

function deriveAlerts(battery: BatteryDetail | null, thermal: ThermalInfo | null): Alert[] {
  const alerts: Alert[] = []

  if (battery) {
    if (battery.temperature_c >= 50) {
      alerts.push({ level: 'error', message: `Battery temperature critically high (${battery.temperature_c.toFixed(0)}°C) — charging stopped` })
    } else if (battery.temperature_c >= 45) {
      alerts.push({ level: 'warning', message: `Battery temperature high (${battery.temperature_c.toFixed(0)}°C) — charging may be limited` })
    }

    const h = battery.health?.toLowerCase()
    if (h === 'overheat' || h === 'hot') {
      alerts.push({ level: 'error', message: `Battery health: ${battery.health}` })
    } else if (h === 'warm' && battery.temperature_c < 45) {
      alerts.push({ level: 'warning', message: `Battery health: ${battery.health}` })
    }

    if (battery.capacity <= 5 && battery.status !== 'Charging') {
      alerts.push({ level: 'error', message: `Battery critically low (${battery.capacity}%)` })
    } else if (battery.capacity <= 15 && battery.status !== 'Charging') {
      alerts.push({ level: 'warning', message: `Battery low (${battery.capacity}%)` })
    }
  }

  if (thermal?.cpu_temp_c != null) {
    if (thermal.cpu_temp_c >= 90) {
      alerts.push({ level: 'error', message: `CPU temperature critically high (${thermal.cpu_temp_c}°C) — performance throttled` })
    } else if (thermal.cpu_temp_c >= 75) {
      alerts.push({ level: 'warning', message: `CPU temperature elevated (${thermal.cpu_temp_c}°C)` })
    }
  }

  return alerts
}

export default function AlertBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const check = useCallback(async () => {
    try {
      const [battery, thermal] = await Promise.allSettled([
        api.batteryDetail(),
        api.thermal(),
      ])
      const b = battery.status === 'fulfilled' ? battery.value : null
      const t = thermal.status === 'fulfilled' ? thermal.value : null
      setAlerts(deriveAlerts(b, t))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    check()
    const id = setInterval(check, 30000)
    return () => clearInterval(id)
  }, [check])

  const visible = alerts.filter(a => !dismissed.has(a.message))
  if (visible.length === 0) return null

  return (
    <div className="space-y-1.5 mb-3">
      {visible.map((a, i) => (
        <div key={i} className={`bg-slate-50/80 backdrop-blur-sm rounded-2xl flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium border-l-4 ${
          a.level === 'error'
            ? 'border-l-red-400 text-red-700'
            : 'border-l-amber-400 text-amber-700'
        }`}>
          <span>{a.level === 'error' ? '\u26a0' : '\u26a0'}</span>
          <span className="flex-1">{a.message}</span>
          <button
            onClick={() => setDismissed(prev => new Set(prev).add(a.message))}
            className="ml-2 text-slate-400 hover:text-slate-800 transition-colors"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { api } from '../data/api'
import { usePoll, type PollResult } from '../data/poll'
import type { HomeData } from '../types'

/**
 * The home poll is the app's heartbeat: one batched request that feeds the
 * Home screen, the Signal group, the Modem data tab and the global alert
 * banner. Those screens read it instead of re-fetching the same ubus data.
 *
 * `fast` is set for the groups that render live radio data; elsewhere the poll
 * only feeds the alert banner, so it idles. Changing the interval does not
 * restart the loop (see `usePoll`), so switching groups costs no extra request.
 */
const HomeContext = createContext<PollResult<HomeData> | null>(null)

export function HomeProvider({ fast, children }: { fast: boolean; children: ReactNode }) {
  const poll = usePoll('home', api.home, fast ? 3000 : 15000)
  return <HomeContext.Provider value={poll}>{children}</HomeContext.Provider>
}

export function useHome(): PollResult<HomeData> {
  const ctx = useContext(HomeContext)
  if (!ctx) throw new Error('useHome outside HomeProvider')
  return ctx
}

// ── Alerts derived from the home poll (no extra requests) ─────────────────────

export interface Alert {
  level: 'warning' | 'error'
  message: string
}

export function deriveAlerts(data: HomeData | null): Alert[] {
  if (!data) return []
  const alerts: Alert[] = []
  const { battery, thermal } = data
  for (const [source, freshness] of Object.entries(data.sources ?? {})) {
    if (freshness.stale) {
      const age = freshness.age_ms == null ? 'no successful reading' : `last reading ${Math.floor(freshness.age_ms / 1000)}s ago`
      alerts.push({ level: 'warning', message: `${source.replaceAll('_', ' ')} unavailable: ${age}${freshness.error ? `. ${freshness.error}` : ''}` })
    }
  }
  if (data.charge_control_error) alerts.push({ level: 'error', message: `Charge control: ${data.charge_control_error}` })

  if (battery) {
    const temp = battery.temperature_c
    if (temp != null && temp >= 50) {
      alerts.push({ level: 'error', message: `Battery temperature critically high (${temp.toFixed(0)}°C)` })
    } else if (temp != null && temp >= 45) {
      alerts.push({ level: 'warning', message: `Battery temperature high (${temp.toFixed(0)}°C)` })
    }
    if (!battery.charging) {
      if (battery.percent <= 5) {
        alerts.push({ level: 'error', message: `Battery critically low (${battery.percent}%)` })
      } else if (battery.percent <= 15) {
        alerts.push({ level: 'warning', message: `Battery low (${battery.percent}%)` })
      }
    }
  }

  if (thermal?.cpu_temp_c != null) {
    if (thermal.cpu_temp_c >= 90) {
      alerts.push({ level: 'error', message: `CPU temperature critically high (${thermal.cpu_temp_c}°C)` })
    } else if (thermal.cpu_temp_c >= 75) {
      alerts.push({ level: 'warning', message: `CPU temperature elevated (${thermal.cpu_temp_c}°C)` })
    }
  }

  return alerts
}

export function useAlerts(): Alert[] {
  const { data, error } = useHome()
  return useMemo(() => [
    ...(error ? [{ level: 'error' as const, message: `Dashboard refresh failed; displayed readings may be old. ${error}` }] : []),
    ...deriveAlerts(data),
  ], [data, error])
}

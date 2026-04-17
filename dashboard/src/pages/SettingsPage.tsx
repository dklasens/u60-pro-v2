import { useState, useEffect, useCallback } from 'react'
import { api, formatBytes, type DeviceInfo, type ChargeControl, type SimInfo, type MemInfo, API_BASE } from '../api'
import Card from '../components/Card'

interface Props { onLogout: () => void }

export default function SettingsPage({ onLogout }: Props) {
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [charge, setCharge] = useState<ChargeControl | null>(null)
  const [sim, setSim] = useState<SimInfo | null>(null)
  const [imei, setImei] = useState('')
  const [mem, setMem] = useState<MemInfo | null>(null)
  const [top, setTop] = useState<{ pid?: number; name?: string; cpu_percent?: number; mem_kb?: number }[]>([])
  const [chargeMsg, setChargeMsg] = useState('')
  const [restartMsg, setRestartMsg] = useState('')

  const fetchAll = useCallback(async () => {
    const results = await Promise.allSettled([
      api.device(), api.chargeControlGet(), api.simInfo(),
      api.simImei(), api.memory(), api.top(),
    ])
    const [d, cc, s, i, m, p] = results
    if (d.status === 'fulfilled') setDevice(d.value)
    if (cc.status === 'fulfilled') setCharge(cc.value)
    if (s.status === 'fulfilled') setSim(s.value)
    if (i.status === 'fulfilled' && i.value) setImei(i.value.imei ?? '')
    if (m.status === 'fulfilled') setMem(m.value)
    if (p.status === 'fulfilled') setTop(Array.isArray(p.value) ? p.value.slice(0, 15) : [])
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 5000)
    return () => clearInterval(id)
  }, [fetchAll])

  function formatUptime(s?: number) {
    if (!s) return '—'
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60)
    return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(' ')
  }

  async function toggleCharging() {
    if (!charge) return
    try {
      const result = await api.chargeControlSet({ charging_stopped: !charge.charging_stopped })
      setCharge(result)
      setChargeMsg(charge.charging_stopped ? 'Charging resumed' : 'Charging stopped')
      setTimeout(() => setChargeMsg(''), 3000)
    } catch (e) {
      setChargeMsg(e instanceof Error ? e.message : 'Error')
    }
  }

  async function setChargeLimit(enabled: boolean, limit?: number) {
    try {
      const body: Record<string, unknown> = { charge_limit_enabled: enabled }
      if (limit != null) body.charge_limit = limit
      const result = await api.chargeControlSet(body)
      setCharge(result)
      setChargeMsg(enabled ? `Charge limit set to ${limit ?? charge?.charge_limit}%` : 'Charge limit disabled')
      setTimeout(() => setChargeMsg(''), 3000)
    } catch (e) {
      setChargeMsg(e instanceof Error ? e.message : 'Error')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Settings</h1>
        <button onClick={onLogout} className="rounded-pill bg-white/30 backdrop-blur-sm px-4 py-2 text-sm font-medium text-text-secondary hover:bg-white/50 transition-all duration-200">
          Sign out
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Device">
          <div className="space-y-2 text-sm">
            {([
              ['Model', device?.model],
              ['Firmware', device?.firmware],
              ['Uptime', formatUptime(device?.uptime_secs)],
              ['Load', device?.load_avg?.map(v => v.toFixed(2)).join(', ')],
              ['IMEI', imei],
            ] as const).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-2">
                <span className="text-text-muted">{l}</span>
                <span className="text-right font-medium text-text-primary font-mono text-xs break-all">{v ?? '—'}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="SIM Card">
          <div className="space-y-2 text-sm">
            {([
              ['Status', sim?.state],
              ['ICCID', sim?.iccid],
              ['IMSI', sim?.imsi],
              ['MCC/MNC', sim?.mcc && sim?.mnc ? `${sim.mcc}/${sim.mnc}` : undefined],
            ] as const).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-2">
                <span className="text-text-muted">{l}</span>
                <span className="text-right font-medium text-text-primary font-mono text-xs break-all">{v ?? '—'}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Charge Control */}
        <Card title="Charge Control">
          {charge ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Battery</span>
                <span className="text-text-primary">{charge.capacity}% — {charge.battery_status}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={toggleCharging}
                  className={`rounded-pill px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    charge.charging_stopped
                      ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20'
                      : 'bg-red-500/10 text-red-600 hover:bg-red-500/20'
                  }`}>
                  {charge.charging_stopped ? 'Resume Charging' : 'Stop Charging'}
                </button>
                {!charge.charge_limit_enabled ? (
                  <button onClick={() => setChargeLimit(true, 80)}
                    className="rounded-pill bg-white/30 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-white/50 transition-all duration-200">
                    Enable Limit (80%)
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <select value={charge.charge_limit}
                      onChange={e => setChargeLimit(true, parseInt(e.target.value))}
                      className="rounded-pill border border-divider bg-white/40 px-2 py-1 text-xs text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                      {[50, 60, 70, 75, 80, 85, 90, 95, 100].map(v =>
                        <option key={v} value={v}>Limit: {v}%</option>
                      )}
                    </select>
                    <button onClick={() => setChargeLimit(false)}
                      className="rounded-pill bg-white/30 px-2 py-1 text-xs text-text-muted hover:text-text-primary transition-colors">
                      Disable Limit
                    </button>
                  </div>
                )}
              </div>
              {chargeMsg && <p className="text-xs text-green-500">{chargeMsg}</p>}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Loading...</p>
          )}
        </Card>

        <Card title="Memory">
          {mem && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-muted">Usage</span>
                <span className="text-text-primary">{formatBytes(mem.used_kb * 1024)} / {formatBytes(mem.total_kb * 1024)} ({mem.usage_pct.toFixed(0)}%)</span>
              </div>
              <div className="h-2 rounded-full bg-white/30 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500" style={{ width: `${mem.usage_pct}%` }} />
              </div>
            </div>
          )}
        </Card>

        <Card title="Connection">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-text-muted">API</span>
              <span className="font-mono text-xs text-text-primary">{API_BASE}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-text-muted">Dashboard</span>
              <span className="font-mono text-xs text-text-primary">{window.location.origin}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Service Controls */}
      <Card title="Service Controls">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={async () => {
                setRestartMsg('Restarting agent...')
                try {
                  await api.restartAgent()
                  setRestartMsg('Agent restarting — reconnecting in a few seconds...')
                  setTimeout(() => window.location.reload(), 5000)
                } catch (e) {
                  setRestartMsg(e instanceof Error ? e.message : 'Failed to restart agent')
                }
              }}
              className="rounded-pill bg-amber-500/10 px-4 py-2 text-sm font-medium text-amber-600 hover:bg-amber-500/20 transition-all duration-200"
            >
              Restart Agent
            </button>
            <button
              onClick={() => {
                setRestartMsg('Reloading dashboard...')
                setTimeout(() => window.location.reload(), 500)
              }}
              className="rounded-pill bg-white/30 backdrop-blur-sm px-4 py-2 text-sm font-medium text-text-secondary hover:bg-white/50 transition-all duration-200"
            >
              Reload Dashboard
            </button>
          </div>
          <p className="text-xs text-text-muted">
            Restart Agent will kill and restart the backend service (briefly unavailable). Reload Dashboard refreshes this page.
          </p>
          {restartMsg && <p className="text-xs text-amber-500">{restartMsg}</p>}
        </div>
      </Card>

      {top.length > 0 && (
        <Card title="Top Processes">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-text-muted">
                  <th className="pb-1.5 pr-3 font-medium">PID</th>
                  <th className="pb-1.5 pr-3 font-medium">Name</th>
                  <th className="pb-1.5 pr-3 font-medium text-right">CPU%</th>
                  <th className="pb-1.5 font-medium text-right">Mem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {top.map(p => (
                  <tr key={p.pid} className="hover:bg-white/20 transition-colors">
                    <td className="py-1 pr-3 text-text-muted">{p.pid}</td>
                    <td className="py-1 pr-3 font-medium text-text-primary truncate max-w-[160px]">{p.name}</td>
                    <td className="py-1 pr-3 text-right text-text-secondary">{p.cpu_percent?.toFixed(1) ?? '—'}</td>
                    <td className="py-1 text-right text-text-secondary">{p.mem_kb ? formatBytes(p.mem_kb * 1024) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

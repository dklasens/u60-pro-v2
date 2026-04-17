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
        <h1 className="text-lg font-semibold text-white">Settings</h1>
        <button onClick={onLogout} className="rounded-lg bg-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-600">
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
                <span className="text-slate-400">{l}</span>
                <span className="text-right font-medium text-white font-mono text-xs break-all">{v ?? '—'}</span>
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
                <span className="text-slate-400">{l}</span>
                <span className="text-right font-medium text-white font-mono text-xs break-all">{v ?? '—'}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Charge Control */}
        <Card title="Charge Control">
          {charge ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Battery</span>
                <span className="text-white">{charge.capacity}% — {charge.battery_status}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={toggleCharging}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    charge.charging_stopped
                      ? 'bg-green-800/60 text-green-300 hover:bg-green-700/60'
                      : 'bg-red-800/60 text-red-300 hover:bg-red-700/60'
                  }`}>
                  {charge.charging_stopped ? 'Resume Charging' : 'Stop Charging'}
                </button>
                {!charge.charge_limit_enabled ? (
                  <button onClick={() => setChargeLimit(true, 80)}
                    className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-600">
                    Enable Limit (80%)
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <select value={charge.charge_limit}
                      onChange={e => setChargeLimit(true, parseInt(e.target.value))}
                      className="rounded-lg border border-slate-600 bg-slate-700 px-2 py-1 text-xs text-white">
                      {[50, 60, 70, 75, 80, 85, 90, 95, 100].map(v =>
                        <option key={v} value={v}>Limit: {v}%</option>
                      )}
                    </select>
                    <button onClick={() => setChargeLimit(false)}
                      className="rounded-lg bg-slate-700 px-2 py-1 text-xs text-slate-400 hover:text-white">
                      Disable Limit
                    </button>
                  </div>
                )}
              </div>
              {chargeMsg && <p className="text-xs text-green-400">{chargeMsg}</p>}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Loading...</p>
          )}
        </Card>

        <Card title="Memory">
          {mem && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400">Usage</span>
                <span className="text-white">{formatBytes(mem.used_kb * 1024)} / {formatBytes(mem.total_kb * 1024)} ({mem.usage_pct.toFixed(0)}%)</span>
              </div>
              <div className="h-2 rounded-full bg-slate-700">
                <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${mem.usage_pct}%` }} />
              </div>
            </div>
          )}
        </Card>

        <Card title="Connection">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">API</span>
              <span className="font-mono text-xs text-white">{API_BASE}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-slate-400">Dashboard</span>
              <span className="font-mono text-xs text-white">{window.location.origin}</span>
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
              className="rounded-lg bg-amber-800/50 px-4 py-2 text-sm font-medium text-amber-300 hover:bg-amber-700/50 transition"
            >
              Restart Agent
            </button>
            <button
              onClick={() => {
                setRestartMsg('Reloading dashboard...')
                setTimeout(() => window.location.reload(), 500)
              }}
              className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600 transition"
            >
              Reload Dashboard
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Restart Agent will kill and restart the backend service (briefly unavailable). Reload Dashboard refreshes this page.
          </p>
          {restartMsg && <p className="text-xs text-amber-400">{restartMsg}</p>}
        </div>
      </Card>

      {top.length > 0 && (
        <Card title="Top Processes">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-400">
                  <th className="pb-1.5 pr-3 font-medium">PID</th>
                  <th className="pb-1.5 pr-3 font-medium">Name</th>
                  <th className="pb-1.5 pr-3 font-medium text-right">CPU%</th>
                  <th className="pb-1.5 font-medium text-right">Mem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/30">
                {top.map(p => (
                  <tr key={p.pid}>
                    <td className="py-1 pr-3 text-slate-500">{p.pid}</td>
                    <td className="py-1 pr-3 font-medium text-white truncate max-w-[160px]">{p.name}</td>
                    <td className="py-1 pr-3 text-right text-slate-300">{p.cpu_percent?.toFixed(1) ?? '—'}</td>
                    <td className="py-1 text-right text-slate-300">{p.mem_kb ? formatBytes(p.mem_kb * 1024) : '—'}</td>
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

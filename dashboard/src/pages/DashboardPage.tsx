import {
  api, formatSpeed, formatBytes,
} from '../api'
import Card, { Stat } from '../components/Card'
import { usePolling } from '../hooks/usePolling'

function signalColor(rsrp?: number) {
  if (rsrp == null) return 'text-text-muted'
  if (rsrp > -80) return 'text-green-500'
  if (rsrp > -100) return 'text-yellow-500'
  return 'text-red-500'
}

function SignalBars({ bars }: { bars?: number }) {
  const n = bars ?? 0
  const color = n >= 4 ? '#22c55e' : n >= 2 ? '#eab308' : '#ef4444'
  const heights = [4, 7, 10, 13, 16]
  return (
    <div className="flex items-end gap-0.5">
      {heights.map((h, i) => (
        <div key={i} className="w-2.5 rounded-sm transition-colors"
          style={{ height: `${h}px`, backgroundColor: i < n ? color : '#cbd5e1' }} />
      ))}
    </div>
  )
}

function BatteryIcon({ percent, charging }: { percent: number; charging: boolean }) {
  const fill = percent > 20 ? (percent > 50 ? '#22c55e' : '#eab308') : '#ef4444'
  return (
    <div className="relative flex h-6 w-10 items-center">
      <div className="h-5 w-9 rounded border-2 border-slate-400">
        <div className="h-full rounded-sm transition-all" style={{ width: `${percent}%`, backgroundColor: fill }} />
      </div>
      <div className="absolute -right-1 h-2 w-1.5 rounded-r bg-slate-400" />
      {charging && <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white">&#x26A1;</span>}
    </div>
  )
}

function formatUptime(secs?: number) {
  if (!secs) return '—'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-text-secondary">{label}</span>
      <span className="truncate text-right font-medium text-text-primary">{value}</span>
    </div>
  )
}

export default function DashboardPage() {
  const { data, error } = usePolling(async () => {
    const results = await Promise.allSettled([
      api.signal(), api.battery(), api.speed(), api.device(),
      api.wan(), api.wan6(), api.cpu(), api.memory(), api.dataUsage(),
    ])
    const [sig, bat, spd, dev, w, w6, c, m, u] = results
    return {
      signal: sig.status === 'fulfilled' ? sig.value : null,
      battery: bat.status === 'fulfilled' ? bat.value : null,
      speed: spd.status === 'fulfilled' ? spd.value : null,
      device: dev.status === 'fulfilled' ? dev.value : null,
      wan: w.status === 'fulfilled' ? w.value : null,
      wan6: w6.status === 'fulfilled' ? w6.value : null,
      cpu: c.status === 'fulfilled' ? c.value : null,
      mem: m.status === 'fulfilled' ? m.value : null,
      usage: u.status === 'fulfilled' ? u.value : null,
    }
  }, 3000)

  const signal = data?.signal ?? null
  const battery = data?.battery ?? null
  const speed = data?.speed ?? null
  const device = data?.device ?? null
  const wan = data?.wan ?? null
  const wan6 = data?.wan6 ?? null
  const cpu = data?.cpu ?? null
  const mem = data?.mem ?? null
  const usage = data?.usage ?? null

  const primaryCarrier = signal?.lte_carriers?.[0] || signal?.nr_carriers?.[0]
  const pccRsrp = primaryCarrier?.rsrp ?? signal?.rsrp

  const isNR = signal?.type?.includes('NR') || signal?.type?.includes('5G')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      {/* Top stats row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {/* Signal */}
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Signal</p>
              <p className={`mt-1 text-2xl font-bold ${signalColor(pccRsrp)}`}>
                {pccRsrp != null ? `${pccRsrp}` : '—'}
              </p>
              <p className="text-xs text-text-muted">dBm RSRP</p>
            </div>
            <SignalBars bars={signal?.signal_bars} />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`rounded-pill px-2 py-0.5 text-xs font-medium ${
              isNR ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-primary'
            }`}>
              {signal?.type ?? '—'}
            </span>
            <span className="text-xs text-text-muted">{signal?.band ?? ''}</span>
          </div>
        </Card>

        {/* Battery */}
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Battery</p>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-2xl font-bold text-text-primary">
              {battery?.percent != null ? `${battery.percent}%` : '—'}
            </p>
            {battery && <BatteryIcon percent={battery.percent} charging={battery.charging} />}
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {battery?.charging ? 'Charging' : 'On battery'}
            {battery?.voltage_mv ? ` · ${(battery.voltage_mv / 1000).toFixed(2)}V` : ''}
            {battery?.temperature_c ? ` · ${battery.temperature_c}°C` : ''}
          </p>
        </Card>

        {/* Download */}
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Download</p>
          <p className="mt-1 text-2xl font-bold text-green-500">
            {speed ? formatSpeed(speed.rx_bps) : '—'}
          </p>
          {speed && speed.max_rx_bps > 0 && (
            <p className="mt-1 text-xs text-text-muted">Peak: {formatSpeed(speed.max_rx_bps)}</p>
          )}
        </Card>

        {/* Upload */}
        <Card>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-muted">Upload</p>
          <p className="mt-1 text-2xl font-bold text-primary">
            {speed ? formatSpeed(speed.tx_bps) : '—'}
          </p>
          {speed && speed.max_tx_bps > 0 && (
            <p className="mt-1 text-xs text-text-muted">Peak: {formatSpeed(speed.max_tx_bps)}</p>
          )}
        </Card>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Signal detail */}
        <Card title="Signal Detail">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="RSRP" value={pccRsrp != null ? `${pccRsrp} dBm` : '—'} color={signalColor(pccRsrp)} />
            <Stat label="RSRQ" value={primaryCarrier?.rsrq != null ? `${primaryCarrier.rsrq} dB` : '—'} />
            <Stat label="SINR" value={primaryCarrier?.sinr != null ? `${primaryCarrier.sinr} dB` : '—'} />
            <Stat label="RSSI" value={primaryCarrier?.rssi != null ? `${primaryCarrier.rssi} dBm` : '—'} />
          </div>
          {signal && signal.lte_carriers.length > 0 && (
            <div className="mt-3 border-t border-divider pt-3">
              <p className="mb-1.5 text-xs text-text-muted">LTE ({signal.lte_carriers.length} carrier{signal.lte_carriers.length > 1 ? 's' : ''})</p>
              <div className="flex flex-wrap gap-1.5">
                {signal.lte_carriers.map((c, i) => (
                  <span key={i} className="rounded-pill bg-blue-100 px-2 py-0.5 text-xs font-medium text-primary">{c.band}{c.rsrp != null ? `: ${c.rsrp} dBm` : ''}</span>
                ))}
              </div>
            </div>
          )}
          {signal && signal.nr_carriers.length > 0 && (
            <div className="mt-3 border-t border-divider pt-3">
              <p className="mb-1.5 text-xs text-text-muted">5G NR ({signal.nr_carriers.length} carrier{signal.nr_carriers.length > 1 ? 's' : ''})</p>
              <div className="flex flex-wrap gap-1.5">
                {signal.nr_carriers.map((c, i) => (
                  <span key={i} className="rounded-pill bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">{c.band}: {c.rsrp} dBm</span>
                ))}
              </div>
            </div>
          )}
        </Card>

        {/* Device */}
        <Card title="Device">
          <div className="space-y-2 text-sm">
            <Row label="Model" value={device?.model ?? '—'} />
            <Row label="Firmware" value={device?.firmware ?? '—'} />
            <Row label="Uptime" value={formatUptime(device?.uptime_secs)} />
            <Row label="Operator" value={signal?.carrier ?? '—'} />
            {cpu && <Row label="CPU" value={`${cpu.overall.toFixed(1)}%`} />}
            {mem && <Row label="Memory" value={`${mem.usage_pct.toFixed(0)}%`} />}
          </div>
        </Card>

        {/* WAN / IPv6 */}
        <Card title="WAN">
          <div className="space-y-2 text-sm">
            <Row label="IPv4" value={wan?.ipv4 ?? '—'} />
            <Row label="Gateway" value={wan?.gateway ?? '—'} />
            <Row label="IPv6" value={wan6?.ipv6 ?? '—'} />
            {wan6?.prefix && <Row label="IPv6 Prefix" value={wan6.prefix} />}
            {wan?.dns && wan.dns.length > 0 && (
              <Row label="DNS (v4)" value={wan.dns.filter(d => !d.includes(':')).join(', ') || '—'} />
            )}
            {wan6?.dns && wan6.dns.length > 0 && (
              <Row label="DNS (v6)" value={wan6.dns.join(', ')} />
            )}
          </div>
        </Card>

        {/* Data Usage */}
        <Card title="Data Usage">
          {usage ? (
            <div className="space-y-3">
              {[
                { label: 'Today', data: usage.day },
                { label: 'This Month', data: usage.month },
                { label: 'Total', data: usage.total },
              ].map(({ label, data }) => (
                <div key={label}>
                  <p className="text-xs text-text-muted">{label}</p>
                  <div className="mt-0.5 flex gap-4 text-sm">
                    <span className="text-green-500">&#x2193; {formatBytes(data.rx_bytes)}</span>
                    <span className="text-primary">&#x2191; {formatBytes(data.tx_bytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Loading...</p>
          )}
        </Card>
      </div>
    </div>
  )
}

import {
  api, formatSpeed, formatBytes,
} from '../api'
import Card, { Stat } from '../components/Card'
import { usePolling } from '../hooks/usePolling'

function signalColor(rsrp?: number) {
  if (rsrp == null) return 'text-slate-400'
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
  if (!secs) return '\u2014'
  const d = Math.floor(secs / 86400)
  const h = Math.floor((secs % 86400) / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return [d && `${d}d`, (d || h) && `${h}h`, `${m}m`].filter(Boolean).join(' ')
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-600">{label}</span>
      <span className="truncate text-right font-medium text-slate-800">{value}</span>
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
        <h1 className="text-3xl font-bold text-slate-800">Dashboard</h1>
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Signal</p>
              <p className={`mt-1 text-2xl font-bold ${signalColor(pccRsrp)}`}>
                {pccRsrp != null ? `${pccRsrp}` : '\u2014'}
              </p>
              <p className="text-xs text-slate-400">dBm RSRP</p>
            </div>
            <SignalBars bars={signal?.signal_bars} />
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <span className={`rounded-lg px-2 py-0.5 text-[9px] uppercase font-bold border shadow-sm ${
              isNR ? 'bg-purple-100 text-purple-700 border-purple-200' : 'bg-blue-100 text-blue-700 border-blue-200'
            }`}>
              {signal?.type ?? '\u2014'}
            </span>
            <span className="text-xs text-slate-400">{signal?.band ?? ''}</span>
          </div>
        </Card>

        <Card>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Battery</p>
          <div className="mt-1 flex items-center gap-3">
            <p className="text-2xl font-bold text-slate-800">
              {battery?.percent != null ? `${battery.percent}%` : '\u2014'}
            </p>
            {battery && <BatteryIcon percent={battery.percent} charging={battery.charging} />}
          </div>
          <p className="mt-1 text-xs text-slate-400">
            {battery?.charging ? 'Charging' : 'On battery'}
            {battery?.voltage_mv ? ` \u00b7 ${(battery.voltage_mv / 1000).toFixed(2)}V` : ''}
            {battery?.temperature_c ? ` \u00b7 ${battery.temperature_c}\u00b0C` : ''}
          </p>
        </Card>

        <Card>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Download</p>
          <p className="mt-1 text-2xl font-bold text-green-500">
            {speed ? formatSpeed(speed.rx_bps) : '\u2014'}
          </p>
          {speed && speed.max_rx_bps > 0 && (
            <p className="mt-1 text-xs text-slate-400">Peak: {formatSpeed(speed.max_rx_bps)}</p>
          )}
        </Card>

        <Card>
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Upload</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {speed ? formatSpeed(speed.tx_bps) : '\u2014'}
          </p>
          {speed && speed.max_tx_bps > 0 && (
            <p className="mt-1 text-xs text-slate-400">Peak: {formatSpeed(speed.max_tx_bps)}</p>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Signal Detail">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="RSRP" value={pccRsrp != null ? `${pccRsrp} dBm` : '\u2014'} color={signalColor(pccRsrp)} />
            <Stat label="RSRQ" value={primaryCarrier?.rsrq != null ? `${primaryCarrier.rsrq} dB` : '\u2014'} />
            <Stat label="SINR" value={primaryCarrier?.sinr != null ? `${primaryCarrier.sinr} dB` : '\u2014'} />
            <Stat label="RSSI" value={primaryCarrier?.rssi != null ? `${primaryCarrier.rssi} dBm` : '\u2014'} />
          </div>
          {signal && signal.lte_carriers.length > 0 && (
            <div className="mt-3 border-t border-slate-200/60 pt-3">
              <p className="mb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">LTE ({signal.lte_carriers.length} carrier{signal.lte_carriers.length > 1 ? 's' : ''})</p>
              <div className="flex flex-wrap gap-1.5">
                {signal.lte_carriers.map((c, i) => (
                  <span key={i} className="rounded-lg bg-blue-100 px-2 py-0.5 text-[9px] font-bold text-blue-700 border border-blue-200 shadow-sm">{c.band}{c.rsrp != null ? `: ${c.rsrp} dBm` : ''}</span>
                ))}
              </div>
            </div>
          )}
          {signal && signal.nr_carriers.length > 0 && (
            <div className="mt-3 border-t border-slate-200/60 pt-3">
              <p className="mb-1.5 text-[9px] font-bold text-slate-400 uppercase tracking-widest">5G NR ({signal.nr_carriers.length} carrier{signal.nr_carriers.length > 1 ? 's' : ''})</p>
              <div className="flex flex-wrap gap-1.5">
                {signal.nr_carriers.map((c, i) => (
                  <span key={i} className="rounded-lg bg-purple-100 px-2 py-0.5 text-[9px] font-bold text-purple-700 border border-purple-200 shadow-sm">{c.band}: {c.rsrp} dBm</span>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card title="Device">
          <div className="space-y-2 text-sm">
            <Row label="Model" value={device?.model ?? '\u2014'} />
            <Row label="Firmware" value={device?.firmware ?? '\u2014'} />
            <Row label="Uptime" value={formatUptime(device?.uptime_secs)} />
            <Row label="Operator" value={signal?.carrier ?? '\u2014'} />
            {cpu && <Row label="CPU" value={`${cpu.overall.toFixed(1)}%`} />}
            {mem && <Row label="Memory" value={`${mem.usage_pct.toFixed(0)}%`} />}
          </div>
        </Card>

        <Card title="WAN">
          <div className="space-y-2 text-sm">
            <Row label="IPv4" value={wan?.ipv4 ?? '\u2014'} />
            <Row label="Gateway" value={wan?.gateway ?? '\u2014'} />
            <Row label="IPv6" value={wan6?.ipv6 ?? '\u2014'} />
            {wan6?.prefix && <Row label="IPv6 Prefix" value={wan6.prefix} />}
            {wan?.dns && wan.dns.length > 0 && (
              <Row label="DNS (v4)" value={wan.dns.filter(d => !d.includes(':')).join(', ') || '\u2014'} />
            )}
            {wan6?.dns && wan6.dns.length > 0 && (
              <Row label="DNS (v6)" value={wan6.dns.join(', ')} />
            )}
          </div>
        </Card>

        <Card title="Data Usage">
          {usage ? (
            <div className="space-y-3">
              {[
                { label: 'Today', data: usage.day },
                { label: 'This Month', data: usage.month },
                { label: 'Total', data: usage.total },
              ].map(({ label, data }) => (
                <div key={label}>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
                  <div className="mt-0.5 flex gap-4 text-sm">
                    <span className="text-green-500">&#x2193; {formatBytes(data.rx_bytes)}</span>
                    <span className="text-blue-600">&#x2191; {formatBytes(data.tx_bytes)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">Loading...</p>
          )}
        </Card>
      </div>
    </div>
  )
}

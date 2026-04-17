import { useState, useEffect, useCallback } from 'react'
import { api, type SignalInfo, type CarrierComponent } from '../api'
import Card from '../components/Card'

function rsrpColor(v?: number) {
  if (v == null) return 'text-slate-400'
  if (v > -80) return 'text-green-400'
  if (v > -90) return 'text-emerald-400'
  if (v > -100) return 'text-yellow-400'
  if (v > -110) return 'text-orange-400'
  return 'text-red-400'
}

function rsrqColor(v?: number) {
  if (v == null) return 'text-slate-400'
  if (v > -10) return 'text-green-400'
  if (v > -15) return 'text-yellow-400'
  return 'text-red-400'
}

function sinrColor(v?: number) {
  if (v == null) return 'text-slate-400'
  if (v > 20) return 'text-green-400'
  if (v > 10) return 'text-emerald-400'
  if (v > 0) return 'text-yellow-400'
  return 'text-red-400'
}

function fmt(v?: number, unit = '') {
  if (v == null) return '\u2014'
  return `${v}${unit}`
}

function fmtFreq(mhz?: number) {
  if (mhz == null) return '\u2014'
  return `${mhz.toFixed(mhz % 1 === 0 ? 0 : 2)} MHz`
}

function parseBw(bw: string): number {
  return parseInt(bw.replace(/[^\d]/g, '')) || 0
}

function sumBw(carriers: CarrierComponent[]): number {
  return carriers.reduce((sum, c) => sum + parseBw(c.bandwidth), 0)
}

// ── Tooltips ────────────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative cursor-help"
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}
      onTouchStart={() => setShow(s => !s)}>
      {children}
      {show && (
        <span className="absolute bottom-full left-1/2 z-20 mb-2 w-60 -translate-x-1/2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-[11px] leading-relaxed text-slate-300 shadow-xl">
          {text}
        </span>
      )}
    </span>
  )
}

function rsrpTip(v?: number) {
  const b = 'Reference Signal Received Power \u2014 power of a single LTE/NR reference signal. Primary indicator of signal strength.'
  if (v == null) return b
  if (v > -80) return b + ' Currently excellent \u2014 very close to cell tower.'
  if (v > -90) return b + ' Currently good \u2014 reliable connection.'
  if (v > -100) return b + ' Currently fair \u2014 speeds may be reduced.'
  if (v > -110) return b + ' Currently poor \u2014 connection may be unstable.'
  return b + ' Very weak \u2014 consider repositioning the device.'
}

function rsrqTip(v?: number) {
  const b = 'Reference Signal Received Quality \u2014 signal quality accounting for noise and interference from neighbouring cells.'
  if (v == null) return b
  if (v > -10) return b + ' Currently good \u2014 minimal interference.'
  if (v > -15) return b + ' Currently fair \u2014 some interference present.'
  return b + ' Currently poor \u2014 significant interference or cell congestion.'
}

function sinrTip(v?: number) {
  const b = 'Signal to Interference plus Noise Ratio \u2014 how far the signal is above the noise floor. Key metric for achievable throughput.'
  if (v == null) return b
  if (v > 20) return b + ' Excellent \u2014 capable of peak throughput.'
  if (v > 10) return b + ' Good \u2014 solid throughput expected.'
  if (v > 0) return b + ' Fair \u2014 noise is impacting performance.'
  return b + ' Poor \u2014 noise exceeds signal, expect low speeds.'
}

function rssiTip() {
  return 'Received Signal Strength Indicator \u2014 total wideband received power including signal, noise, and interference. Less precise than RSRP for LTE/NR as it measures the entire channel bandwidth.'
}

// ── Carrier Card ────────────────────────────────────────────────────────────

function CarrierCard({ carrier, tech }: { carrier: CarrierComponent; tech: 'LTE' | 'NR' }) {
  const isPcc = carrier.label === 'PCC'
  const badgeColor = tech === 'NR'
    ? 'bg-purple-900/50 text-purple-300 border-purple-700/50'
    : 'bg-blue-900/50 text-blue-300 border-blue-700/50'
  const pccBadge = isPcc
    ? 'bg-green-900/50 text-green-300 border-green-700/50'
    : 'bg-slate-700/50 text-slate-400 border-slate-600/50'

  return (
    <div className="rounded-xl border border-slate-700/50 bg-slate-800">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-slate-700/50 px-4 py-2.5">
        <span className={`rounded border px-2 py-0.5 text-xs font-bold ${badgeColor}`}>
          {carrier.band}
        </span>
        <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${pccBadge}`}>
          {carrier.label}
        </span>
        {carrier.ul_configured !== undefined && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${carrier.ul_configured ? 'bg-green-900/50 text-green-400' : 'bg-slate-700/50 text-slate-500'}`}>
            UL {carrier.ul_configured ? '\u2713' : '\u2717'}
          </span>
        )}
        {carrier.active !== undefined && (
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${carrier.active ? 'bg-green-900/50 text-green-400' : 'bg-slate-700/50 text-slate-500'}`}>
            {carrier.active ? 'Active' : 'Idle'}
          </span>
        )}
        <span className="ml-auto text-xs text-slate-500">PCI {carrier.pci}</span>
      </div>

      {/* Signal metrics with tooltips */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-3">
        <div>
          <Tooltip text={rsrpTip(carrier.rsrp)}>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 underline decoration-dotted decoration-slate-600 underline-offset-2">RSRP</p>
          </Tooltip>
          <p className={`text-lg font-bold ${rsrpColor(carrier.rsrp)}`}>{fmt(carrier.rsrp, ' dBm')}</p>
        </div>
        <div>
          <Tooltip text={rsrqTip(carrier.rsrq)}>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 underline decoration-dotted decoration-slate-600 underline-offset-2">RSRQ</p>
          </Tooltip>
          <p className={`text-lg font-bold ${rsrqColor(carrier.rsrq)}`}>{fmt(carrier.rsrq, ' dB')}</p>
        </div>
        <div>
          <Tooltip text={sinrTip(carrier.sinr)}>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 underline decoration-dotted decoration-slate-600 underline-offset-2">SINR</p>
          </Tooltip>
          <p className={`text-lg font-bold ${sinrColor(carrier.sinr)}`}>{fmt(carrier.sinr, ' dB')}</p>
        </div>
        <div>
          <Tooltip text={rssiTip()}>
            <p className="text-[10px] uppercase tracking-wider text-slate-500 underline decoration-dotted decoration-slate-600 underline-offset-2">RSSI</p>
          </Tooltip>
          <p className="text-lg font-bold text-slate-300">{fmt(carrier.rssi, ' dBm')}</p>
        </div>
      </div>

      {/* Technical details */}
      <div className="border-t border-slate-700/30 px-4 py-2.5">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">BW</span>
            <span className="text-slate-300 font-medium">{carrier.bandwidth}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{tech === 'NR' ? 'ARFCN' : 'EARFCN'}</span>
            <span className="text-slate-300 font-mono">{carrier.earfcn || '\u2014'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Freq</span>
            <span className="text-slate-300">{fmtFreq(carrier.freq)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">PCI</span>
            <span className="text-slate-300 font-mono">{carrier.pci}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function CellInfoTable({ carriers, tech }: { carriers: CarrierComponent[]; tech: 'NR' | 'LTE' }) {
  if (carriers.length === 0) return null
  const isNR = tech === 'NR'
  return (
    <div className={isNR ? 'mb-3' : ''}>
      <p className={`mb-2 text-xs font-medium uppercase ${isNR ? 'text-purple-400' : 'text-blue-400'}`}>{isNR ? 'NR 5G' : 'LTE'} Carriers</p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400">
              <th className="pb-1.5 pr-3">Type</th>
              <th className="pb-1.5 pr-3">Band</th>
              <th className="pb-1.5 pr-3">PCI</th>
              <th className="pb-1.5 pr-3">{isNR ? 'ARFCN' : 'EARFCN'}</th>
              <th className="pb-1.5 pr-3">BW</th>
              <th className="pb-1.5 pr-3">Freq</th>
              <th className="pb-1.5 pr-3">RSRP</th>
              <th className="pb-1.5 pr-3">RSRQ</th>
              <th className="pb-1.5 pr-3">SINR</th>
              <th className="pb-1.5">RSSI</th>
            </tr>
          </thead>
          <tbody>
            {carriers.map((c, i) => (
              <tr key={i} className="border-b border-slate-700/30">
                <td className="py-1.5 pr-3">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${c.label === 'PCC' ? 'bg-green-900/50 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                    {c.label}
                  </span>
                </td>
                <td className={`py-1.5 pr-3 font-medium ${isNR ? 'text-purple-300' : 'text-blue-300'}`}>{c.band}</td>
                <td className="py-1.5 pr-3 text-white">{c.pci}</td>
                <td className="py-1.5 pr-3 text-white">{c.earfcn}</td>
                <td className="py-1.5 pr-3 text-slate-300">{c.bandwidth}</td>
                <td className="py-1.5 pr-3 text-slate-300">{c.freq ? `${c.freq.toFixed(1)} MHz` : '\u2014'}</td>
                <td className={`py-1.5 pr-3 font-medium ${rsrpColor(c.rsrp)}`}>{c.rsrp ?? '\u2014'}</td>
                <td className={`py-1.5 pr-3 font-medium ${rsrqColor(c.rsrq)}`}>{c.rsrq ?? '\u2014'}</td>
                <td className={`py-1.5 pr-3 font-medium ${sinrColor(c.sinr)}`}>{c.sinr ?? '\u2014'}</td>
                <td className="py-1.5 font-medium text-slate-300">{c.rssi ?? '\u2014'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SignalBars({ bars }: { bars?: number }) {
  const n = bars ?? 0
  const color = n >= 4 ? '#4ade80' : n >= 2 ? '#facc15' : '#f87171'
  const heights = [4, 7, 10, 13, 16]
  return (
    <div className="flex items-end gap-0.5">
      {heights.map((h, i) => (
        <div key={i} className="w-2.5 rounded-sm transition-colors"
          style={{ height: `${h}px`, backgroundColor: i < n ? color : '#1e293b' }} />
      ))}
    </div>
  )
}

export default function SignalPage() {
  const [current, setCurrent] = useState<SignalInfo | null>(null)

  const fetchSignal = useCallback(async () => {
    try { setCurrent(await api.signal()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchSignal()
    const id = setInterval(fetchSignal, 3000)
    return () => clearInterval(id)
  }, [fetchSignal])

  if (!current) return <div className="text-slate-400 text-sm">Loading...</div>

  const hasNR = current.nr_carriers.length > 0
  const hasLTE = current.lte_carriers.length > 0
  const totalCarriers = current.lte_carriers.length + current.nr_carriers.length
  const nrBw = sumBw(current.nr_carriers)
  const lteBw = sumBw(current.lte_carriers)
  const totalBw = nrBw + lteBw

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Signal Monitor</h1>
        <SignalBars bars={current.signal_bars} />
      </div>

      {/* Network info bar */}
      <Card>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Connection</p>
            <p className="text-sm font-bold text-white">{current.type ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Provider</p>
            <p className="text-sm font-medium text-white">{current.carrier ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Cell ID</p>
            <p className="text-sm font-mono text-slate-300">{current.cell_id ?? '\u2014'}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Carriers</p>
            <p className="text-sm text-slate-300">
              {hasNR ? `${current.nr_carriers.length} NR` : ''}
              {hasNR && hasLTE ? ' + ' : ''}
              {hasLTE ? `${current.lte_carriers.length} LTE` : ''}
              {' '}({totalCarriers} total)
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Bandwidth</p>
            <p className="text-sm font-bold text-white">{totalBw} MHz</p>
            <p className="text-[10px] text-slate-500">
              {hasNR ? `NR ${nrBw}` : ''}{hasNR && hasLTE ? ' + ' : ''}{hasLTE ? `LTE ${lteBw}` : ''} MHz
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Bands</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {current.nr_carriers.map((c, i) => (
                <span key={`nr-${i}`} className="rounded bg-purple-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300">{c.band}</span>
              ))}
              {current.lte_carriers.map((c, i) => (
                <span key={`lte-${i}`} className="rounded bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-blue-300">{c.band}</span>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Cell Info Table */}
      {(hasNR || hasLTE) && (
        <Card title="Current Cell Info">
          <CellInfoTable carriers={current.nr_carriers} tech="NR" />
          <CellInfoTable carriers={current.lte_carriers} tech="LTE" />
        </Card>
      )}

      {/* NR Carriers */}
      {hasNR && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-purple-300">5G NR</h2>
            <span className="rounded bg-purple-900/40 px-2 py-0.5 text-[10px] font-medium text-purple-400">
              {current.nr_carriers.length} carrier{current.nr_carriers.length !== 1 ? 's' : ''}
            </span>
            <span className="rounded bg-purple-900/30 px-2 py-0.5 text-[10px] font-medium text-purple-300">
              {nrBw} MHz
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {current.nr_carriers.map((c, i) => (
              <CarrierCard key={`nr-${i}`} carrier={c} tech="NR" />
            ))}
          </div>
        </div>
      )}

      {/* LTE Carriers */}
      {hasLTE && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-sm font-semibold text-blue-300">LTE</h2>
            <span className="rounded bg-blue-900/40 px-2 py-0.5 text-[10px] font-medium text-blue-400">
              {current.lte_carriers.length} carrier{current.lte_carriers.length !== 1 ? 's' : ''}
              {current.lte_carriers.length > 1 ? ' (CA)' : ''}
            </span>
            <span className="rounded bg-blue-900/30 px-2 py-0.5 text-[10px] font-medium text-blue-300">
              {lteBw} MHz
            </span>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {current.lte_carriers.map((c, i) => (
              <CarrierCard key={`lte-${i}`} carrier={c} tech="LTE" />
            ))}
          </div>
        </div>
      )}

      {/* Signal quality reference */}
      <Card title="Signal Quality Reference">
        <div className="grid grid-cols-1 gap-4 text-xs md:grid-cols-3">
          <div>
            <p className="mb-1.5 font-medium text-slate-300">RSRP (dBm)</p>
            <div className="space-y-0.5">
              <div className="flex justify-between"><span className="text-green-400">Excellent</span><span className="text-slate-400">&gt; -80</span></div>
              <div className="flex justify-between"><span className="text-emerald-400">Good</span><span className="text-slate-400">-80 to -90</span></div>
              <div className="flex justify-between"><span className="text-yellow-400">Fair</span><span className="text-slate-400">-90 to -100</span></div>
              <div className="flex justify-between"><span className="text-orange-400">Poor</span><span className="text-slate-400">-100 to -110</span></div>
              <div className="flex justify-between"><span className="text-red-400">No signal</span><span className="text-slate-400">&lt; -110</span></div>
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-medium text-slate-300">RSRQ (dB)</p>
            <div className="space-y-0.5">
              <div className="flex justify-between"><span className="text-green-400">Good</span><span className="text-slate-400">&gt; -10</span></div>
              <div className="flex justify-between"><span className="text-yellow-400">Fair</span><span className="text-slate-400">-10 to -15</span></div>
              <div className="flex justify-between"><span className="text-red-400">Poor</span><span className="text-slate-400">&lt; -15</span></div>
            </div>
          </div>
          <div>
            <p className="mb-1.5 font-medium text-slate-300">SINR (dB)</p>
            <div className="space-y-0.5">
              <div className="flex justify-between"><span className="text-green-400">Excellent</span><span className="text-slate-400">&gt; 20</span></div>
              <div className="flex justify-between"><span className="text-emerald-400">Good</span><span className="text-slate-400">10 to 20</span></div>
              <div className="flex justify-between"><span className="text-yellow-400">Fair</span><span className="text-slate-400">0 to 10</span></div>
              <div className="flex justify-between"><span className="text-red-400">Poor</span><span className="text-slate-400">&lt; 0</span></div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

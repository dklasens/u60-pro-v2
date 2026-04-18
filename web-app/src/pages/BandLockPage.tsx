import { useState, useEffect, useCallback } from 'react'
import { api, type SignalInfo } from '../api'
import Card from '../components/Card'

// Common band lists for the U60 Pro
const NR_BANDS = [1, 2, 3, 5, 7, 8, 18, 20, 26, 28, 29, 38, 40, 41, 48, 66, 71, 75, 77, 78, 79]
const LTE_BANDS = [1, 2, 3, 4, 5, 7, 8, 12, 13, 14, 17, 18, 19, 20, 25, 26, 28, 29, 30, 32, 34, 38, 39, 40, 41, 42, 43, 48, 66, 71]

const NETWORK_MODES: { value: string; label: string }[] = [
  { value: 'WL_AND_5G', label: '5G + 4G' },
  { value: 'Only_5G', label: '5G SA' },
  { value: 'LTE_AND_5G', label: '5G NSA' },
  { value: 'Only_LTE', label: '4G LTE' },
  { value: 'Only_WCDMA', label: '3G' },
]

function Alert({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  const colors = { success: 'text-green-500', error: 'text-red-500' }
  return <p className={`text-sm ${colors[type]}`}>{msg}</p>
}

// ── Network Mode ─────────────────────────────────────────────────────────────
function NetworkModeSection({ currentMode, onApplied }: { currentMode: string; onApplied: () => void }) {
  const [selected, setSelected] = useState(currentMode)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { setSelected(currentMode) }, [currentMode])

  async function apply() {
    setLoading(true); setMsg('')
    try {
      await api.networkModeSet(selected)
      setMsg('Network mode applied. Connection may briefly drop.')
      onApplied()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Network Mode">
      <p className="mb-3 text-xs text-gray-500">
        Select preferred network technology. The modem will reconnect after changing.
      </p>
      <div className="flex flex-wrap gap-2">
        {NETWORK_MODES.map(m => (
          <button key={m.value} onClick={() => setSelected(m.value)}
            className={`rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200 ${
              selected === m.value
                ? 'bg-slds-blue text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}>
            {m.label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <button onClick={apply} disabled={loading || selected === currentMode}
          className="bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm">
          {loading ? 'Applying...' : 'Apply'}
        </button>
        {selected !== currentMode && (
          <span className="text-xs text-gray-500">
            Current: {NETWORK_MODES.find(m => m.value === currentMode)?.label ?? currentMode}
          </span>
        )}
      </div>
      {msg && <div className="mt-2"><Alert type={msg.includes('Failed') ? 'error' : 'success'} msg={msg} /></div>}
    </Card>
  )
}

// ── Band Lock Section ────────────────────────────────────────────────────────
function BandLockSection({ title, description, bands, type, lockedBands, onApplied }: {
  title: string
  description: string
  bands: number[]
  type: 'nr' | 'lte'
  lockedBands?: number[]
  onApplied: () => void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  // Sync selection from device state when lockedBands loads or changes
  useEffect(() => {
    if (lockedBands) setSelected(new Set(lockedBands))
  }, [lockedBands])

  function toggle(band: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(band)) next.delete(band)
      else next.add(band)
      return next
    })
  }

  function selectAll() { setSelected(new Set(bands)) }
  function selectNone() { setSelected(new Set()) }

  async function apply() {
    if (selected.size === 0) { setMsg('Select at least one band'); return }
    setLoading(true); setMsg('')
    try {
      const sorted = Array.from(selected).sort((a, b) => a - b)
      if (type === 'nr') {
        await api.bandLockNr(sorted.join(','))
      } else {
        await api.bandLockLte(sorted)
      }
      setMsg(`${type === 'nr' ? 'NR' : 'LTE'} bands locked to: ${sorted.map(b => type === 'nr' ? `n${b}` : `B${b}`).join(', ')}`)
      onApplied()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title={title}>
      <p className="mb-3 text-xs text-gray-500">{description}</p>
      {lockedBands && lockedBands.length > 0 && (
        <p className="mb-2 text-xs text-green-500">
          Locked: {lockedBands.sort((a, b) => a - b).map(b => type === 'nr' ? `n${b}` : `B${b}`).join(', ')}
        </p>
      )}
      <div className="mb-2 flex gap-2">
        <button onClick={selectAll} className="py-2 text-xs text-slds-blue hover:text-slds-blueHover transition-colors">Select All</button>
        <button onClick={selectNone} className="py-2 text-xs text-gray-500 hover:text-gray-900 transition-colors">Clear</button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {bands.map(b => (
          <button key={b} onClick={() => toggle(b)}
            className={`rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all duration-200 ${
              selected.has(b)
                ? type === 'nr' ? 'bg-purple-600 text-white' : 'bg-slds-blue text-white'
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
            }`}>
            {type === 'nr' ? `n${b}` : `B${b}`}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={apply} disabled={loading || selected.size === 0}
          className="bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm">
          {loading ? 'Locking...' : `Lock ${selected.size} Band${selected.size !== 1 ? 's' : ''}`}
        </button>
        {selected.size > 0 && (
          <span className="text-xs text-gray-500">
            {Array.from(selected).sort((a, b) => a - b).map(b => type === 'nr' ? `n${b}` : `B${b}`).join(', ')}
          </span>
        )}
      </div>
      {msg && <div className="mt-2"><Alert type={msg.includes('Failed') || msg.includes('Select') ? 'error' : 'success'} msg={msg} /></div>}
    </Card>
  )
}

// ── Cell Lock Section ────────────────────────────────────────────────────────
function CellLockSection({ type, onApplied }: { type: 'nr' | 'lte'; onApplied: () => void }) {
  const [pci, setPci] = useState('')
  const [earfcn, setEarfcn] = useState('')
  const [band, setBand] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function apply() {
    if (!pci || !earfcn) { setMsg('PCI and EARFCN/ARFCN are required'); return }
    if (type === 'nr' && !band) { setMsg('Band is required for NR cell lock'); return }
    setLoading(true); setMsg('')
    try {
      if (type === 'nr') {
        await api.cellLockNr(pci, earfcn, band)
      } else {
        await api.cellLockLte(pci, earfcn)
      }
      setMsg(`${type === 'nr' ? 'NR' : 'LTE'} cell locked to PCI ${pci}, ${type === 'nr' ? 'ARFCN' : 'EARFCN'} ${earfcn}`)
      onApplied()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title={`${type === 'nr' ? 'NR' : 'LTE'} Cell Lock`}>
      <p className="mb-3 text-xs text-gray-500">
        Lock to a specific cell by PCI and {type === 'nr' ? 'NR-ARFCN' : 'EARFCN'}.
        {type === 'nr' ? ' Band number is also required for NR.' : ''}
      </p>
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2">
        <div>
          <label className="mb-1 block text-xs text-gray-500">PCI</label>
          <input type="number" value={pci} onChange={e => setPci(e.target.value)}
            placeholder="e.g. 30"
            className="w-full sm:w-24 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all" />
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">{type === 'nr' ? 'NR-ARFCN' : 'EARFCN'}</label>
          <input type="number" value={earfcn} onChange={e => setEarfcn(e.target.value)}
            placeholder={type === 'nr' ? 'e.g. 630912' : 'e.g. 3650'}
            className="w-full sm:w-32 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all" />
        </div>
        {type === 'nr' && (
          <div>
            <label className="mb-1 block text-xs text-gray-500">Band</label>
            <input type="number" value={band} onChange={e => setBand(e.target.value)}
              placeholder="e.g. 78"
              className="w-full sm:w-20 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all" />
          </div>
        )}
        <button onClick={apply} disabled={loading}
          className="w-full sm:w-auto bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm">
          {loading ? 'Locking...' : 'Lock Cell'}
        </button>
      </div>
      {msg && <div className="mt-2"><Alert type={msg.includes('Failed') || msg.includes('required') ? 'error' : 'success'} msg={msg} /></div>}
    </Card>
  )
}

// ── Current Cell Info with Lock Buttons ──────────────────────────────────────
function CurrentCellInfo({ signal, onLock }: {
  signal: SignalInfo | null
  onLock: (type: 'nr' | 'lte', pci: number, earfcn: number, band?: string) => void
}) {
  if (!signal) return null
  const { lte_carriers, nr_carriers } = signal

  return (
    <Card title="Current Cell Info">
      <p className="mb-3 text-xs text-gray-500">
        Active serving cells. Use the Lock button to lock to a specific cell.
      </p>

      {nr_carriers.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-medium uppercase text-purple-600">NR 5G Carriers</p>
          <div className="relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200/60 text-gray-500">
                  <th className="pb-1.5 pr-3">Type</th>
                  <th className="pb-1.5 pr-3">Band</th>
                  <th className="pb-1.5 pr-3">PCI</th>
                  <th className="pb-1.5 pr-3">ARFCN</th>
                  <th className="hidden sm:table-cell pb-1.5 pr-3">BW</th>
                  <th className="hidden sm:table-cell pb-1.5 pr-3">Freq</th>
                  <th className="pb-1.5 pr-3">RSRP</th>
                  <th className="pb-1.5 pr-3">SINR</th>
                  <th className="pb-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {nr_carriers.map((c, i) => {
                  const bandNum = c.band.replace(/\D/g, '')
                  return (
                    <tr key={i} className="border-b border-gray-200/60">
                      <td className="py-1.5 pr-3">
                        <span className={`rounded-xl px-1.5 py-0.5 text-[10px] font-medium ${c.label === 'PCC' ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                          {c.label}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 font-medium text-purple-600">{c.band}</td>
                      <td className="py-1.5 pr-3 text-gray-900">{c.pci}</td>
                      <td className="py-1.5 pr-3 text-gray-900">{c.earfcn}</td>
                      <td className="hidden sm:table-cell py-1.5 pr-3 text-gray-600">{c.bandwidth}</td>
                      <td className="hidden sm:table-cell py-1.5 pr-3 text-gray-600">{c.freq ? `${c.freq.toFixed(1)} MHz` : '\u2014'}</td>
                      <td className="py-1.5 pr-3 text-gray-900">{c.rsrp ?? '\u2014'}</td>
                      <td className="py-1.5 pr-3 text-gray-900">{c.sinr ?? '\u2014'}</td>
                      <td className="py-1.5">
                        <button onClick={() => onLock('nr', c.pci, c.earfcn, bandNum)}
                          className="rounded-xl bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-100 transition-all duration-200">
                          Lock
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent sm:hidden" />
          </div>
        </div>
      )}

      {lte_carriers.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase text-slds-blue">LTE Carriers</p>
          <div className="relative">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-gray-200/60 text-gray-500">
                  <th className="pb-1.5 pr-3">Type</th>
                  <th className="pb-1.5 pr-3">Band</th>
                  <th className="pb-1.5 pr-3">PCI</th>
                  <th className="pb-1.5 pr-3">EARFCN</th>
                  <th className="hidden sm:table-cell pb-1.5 pr-3">BW</th>
                  <th className="hidden sm:table-cell pb-1.5 pr-3">Freq</th>
                  <th className="pb-1.5 pr-3">RSRP</th>
                  <th className="pb-1.5 pr-3">SINR</th>
                  <th className="pb-1.5"></th>
                </tr>
              </thead>
              <tbody>
                {lte_carriers.map((c, i) => (
                  <tr key={i} className="border-b border-gray-200/60">
                    <td className="py-1.5 pr-3">
                      <span className={`rounded-xl px-1.5 py-0.5 text-[10px] font-medium ${c.label === 'PCC' ? 'bg-green-100 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
                        {c.label}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 font-medium text-slds-blue">{c.band}</td>
                    <td className="py-1.5 pr-3 text-gray-900">{c.pci}</td>
                    <td className="py-1.5 pr-3 text-gray-900">{c.earfcn}</td>
                    <td className="hidden sm:table-cell py-1.5 pr-3 text-gray-600">{c.bandwidth}</td>
                    <td className="hidden sm:table-cell py-1.5 pr-3 text-gray-600">{c.freq ? `${c.freq.toFixed(1)} MHz` : '\u2014'}</td>
                    <td className="py-1.5 pr-3 text-gray-900">{c.rsrp ?? '\u2014'}</td>
                    <td className="py-1.5 pr-3 text-gray-900">{c.sinr ?? '\u2014'}</td>
                    <td className="py-1.5">
                      <button onClick={() => onLock('lte', c.pci, c.earfcn)}
                        className="rounded-xl bg-slds-blue/10 px-3 py-1.5 text-xs font-medium text-slds-blue hover:bg-slds-blue/20 transition-all duration-200">
                        Lock
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent sm:hidden" />
          </div>
        </div>
      )}

      {lte_carriers.length === 0 && nr_carriers.length === 0 && (
        <p className="text-sm text-gray-500">No active carriers</p>
      )}
    </Card>
  )
}

// ── Reset Section ────────────────────────────────────────────────────────────
function ResetSection({ onApplied }: { onApplied: () => void }) {
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function resetBands() {
    setLoading(true); setMsg('')
    try {
      await api.bandLockReset()
      setMsg('All band locks cleared')
      onApplied()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function resetCells() {
    setLoading(true); setMsg('')
    try {
      await api.cellLockReset()
      setMsg('All cell locks cleared')
      onApplied()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="Reset Locks">
      <p className="mb-3 text-xs text-gray-500">
        Remove all band and cell locks. The modem will reconnect using automatic selection.
      </p>
      <div className="flex flex-wrap gap-2">
        <button onClick={resetBands} disabled={loading}
          className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200 disabled:opacity-40">
          Reset Band Locks
        </button>
        <button onClick={resetCells} disabled={loading}
          className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200 disabled:opacity-40">
          Reset Cell Locks
        </button>
      </div>
      {msg && <div className="mt-2"><Alert type={msg.includes('Failed') ? 'error' : 'success'} msg={msg} /></div>}
    </Card>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function BandLockPage() {
  const [signal, setSignal] = useState<SignalInfo | null>(null)
  const [netMode, setNetMode] = useState('WL_AND_5G')
  const [lockMsg, setLockMsg] = useState('')

  const fetchStatus = useCallback(async () => {
    try {
      const sig = await api.signal()
      setSignal(sig)
      if (sig.net_select) setNetMode(sig.net_select)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  async function handleLockCell(type: 'nr' | 'lte', pci: number, earfcn: number, band?: string) {
    try {
      if (type === 'nr') {
        await api.cellLockNr(String(pci), String(earfcn), band ?? '')
      } else {
        await api.cellLockLte(String(pci), String(earfcn))
      }
      setLockMsg(`Locked to ${type === 'nr' ? 'NR' : 'LTE'} cell PCI ${pci}, ${type === 'nr' ? 'ARFCN' : 'EARFCN'} ${earfcn}`)
      setTimeout(() => setLockMsg(''), 5000)
      fetchStatus()
    } catch (e) {
      setLockMsg(e instanceof Error ? e.message : 'Lock failed')
      setTimeout(() => setLockMsg(''), 5000)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Band & Cell Locking</h1>

      {lockMsg && (
        <div className={`rounded-2xl px-4 py-2 text-sm ${lockMsg.includes('failed') || lockMsg.includes('Failed') ? 'bg-red-100 text-red-500' : 'bg-green-100 text-green-500'}`}>
          {lockMsg}
        </div>
      )}

      {/* Current cell info at top with lock buttons */}
      <CurrentCellInfo signal={signal} onLock={handleLockCell} />

      {/* Network mode */}
      <NetworkModeSection currentMode={netMode} onApplied={fetchStatus} />

      {/* Band locks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BandLockSection
          title="NR 5G Band Lock"
          description="Select which NR 5G bands the modem is allowed to use. Only works in 5G SA mode — NSA band locking is not supported by firmware."
          bands={NR_BANDS}
          type="nr"
          lockedBands={signal?.nr_band_lock}
          onApplied={fetchStatus}
        />
        <BandLockSection
          title="LTE Band Lock"
          description="Select which LTE bands the modem is allowed to use."
          bands={LTE_BANDS}
          type="lte"
          lockedBands={signal?.lte_band_lock}
          onApplied={fetchStatus}
        />
      </div>

      {/* Cell locks */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CellLockSection type="nr" onApplied={fetchStatus} />
        <CellLockSection type="lte" onApplied={fetchStatus} />
      </div>

      {/* Reset */}
      <ResetSection onApplied={fetchStatus} />

      {/* Diagnostics */}
      {signal && (
        <Card title="Band Lock Diagnostics">
          <div className="space-y-1 font-mono text-xs text-gray-500">
            <p>LTE lock (raw): <span className="text-gray-900">{signal.raw_lte_band_lock || '(empty)'}</span></p>
            <p>NR lock (raw): <span className="text-gray-900">{signal.raw_nr_band_lock || '(empty)'}</span></p>
            <p>LTE lock (parsed): <span className="text-gray-900">{signal.lte_band_lock ? signal.lte_band_lock.join(', ') : '(none)'}</span></p>
            <p>NR lock (parsed): <span className="text-gray-900">{signal.nr_band_lock ? signal.nr_band_lock.join(', ') : '(none)'}</span></p>
            <p>Network mode: <span className="text-gray-900">{signal.net_select || '(unknown)'}</span></p>
          </div>
          <button onClick={fetchStatus} className="mt-2 bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl font-bold text-gray-500 shadow-sm transition-all active:scale-95 text-sm">
            Refresh
          </button>
        </Card>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { api, formatBytes, type ApnProfile, type DataUsage } from '../api'
import Card from '../components/Card'

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs text-gray-500">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all" />
    </div>
  )
}

function Alert({ msg, type = 'success' }: { msg: string; type?: 'success' | 'error' }) {
  return <p className={`text-xs ${type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{msg}</p>
}

const APN_PRESETS: { name: string; apn: string; user: string; pass: string; auth: number; pdp: number }[] = [
  { name: 'Vodafone AU', apn: 'live.vodafone.com', user: '', pass: '', auth: 0, pdp: 3 },
  { name: 'Optus', apn: 'yesinternet', user: '', pass: '', auth: 0, pdp: 3 },
  { name: 'Telstra', apn: 'telstra.internet', user: '', pass: '', auth: 0, pdp: 3 },
  { name: 'T-Mobile US', apn: 'fast.t-mobile.com', user: '', pass: '', auth: 0, pdp: 3 },
  { name: 'AT&T', apn: 'broadband', user: '', pass: '', auth: 0, pdp: 3 },
  { name: 'Verizon', apn: 'vzwinternet', user: '', pass: '', auth: 0, pdp: 3 },
  { name: 'EE UK', apn: 'everywhere', user: 'eesecure', pass: 'secure', auth: 2, pdp: 3 },
  { name: 'Three UK', apn: 'three.co.uk', user: '', pass: '', auth: 0, pdp: 3 },
  { name: 'Vodafone UK', apn: 'wap.vodafone.co.uk', user: 'wap', pass: 'wap', auth: 1, pdp: 3 },
  { name: 'DoCoMo', apn: 'ppsim.jp', user: 'pp@sim', pass: 'jpn', auth: 2, pdp: 3 },
  { name: 'SoftBank', apn: 'plus.4g', user: 'plus', pass: '4g', auth: 2, pdp: 3 },
  { name: 'KDDI au', apn: 'uad5gn.au-net.ne.jp', user: '', pass: '', auth: 0, pdp: 3 },
  { name: 'Generic IPv4v6', apn: 'internet', user: '', pass: '', auth: 0, pdp: 3 },
]

const PDP_LABELS: Record<number, string> = { 1: 'IPv4', 2: 'IPv6', 3: 'IPv4v6' }
const AUTH_LABELS: Record<number, string> = { 0: 'None', 1: 'PAP', 2: 'CHAP', 3: 'PAP/CHAP' }

// ── APN Mode ────────────────────────────────────────────────────────────────
function ApnModeSection() {
  const [mode, setMode] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.apnModeGet()
      .then((d: Record<string, unknown>) => setMode((d?.apn_mode as number) ?? 0))
      .catch(() => {})
  }, [])

  async function apply(newMode: number) {
    setLoading(true); setMsg('')
    try {
      await api.apnModeSet({ apn_mode: newMode })
      setMode(newMode)
      setMsg(newMode === 0 ? 'APN set to automatic' : 'APN set to manual')
      setTimeout(() => setMsg(''), 3000)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    }
    setLoading(false)
  }

  return (
    <Card title="APN Mode">
      <p className="mb-3 text-xs text-gray-500">
        In automatic mode, the device selects the APN based on your SIM card.
        Switch to manual to use a custom APN profile.
      </p>
      <div className="flex gap-2">
        <button onClick={() => apply(0)} disabled={loading || mode === 0}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
            mode === 0 ? 'bg-green-500/10 text-green-600' : 'bg-gray-50 text-gray-600 hover:bg-gray-50/60'
          } disabled:opacity-40`}>
          Automatic
        </button>
        <button onClick={() => apply(1)} disabled={loading || mode === 1}
          className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
            mode === 1 ? 'bg-slds-blue text-white' : 'bg-gray-50 text-gray-600 hover:bg-gray-50/60'
          } disabled:opacity-40`}>
          Manual
        </button>
      </div>
      {msg && <div className="mt-2"><Alert msg={msg} /></div>}
    </Card>
  )
}

// ── APN Profiles ────────────────────────────────────────────────────────────
function ApnSection() {
  const [profiles, setProfiles] = useState<ApnProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', apn: '', user: '', pass: '', auth: 0, pdp: 3 })

  const fetchProfiles = useCallback(async () => {
    try {
      const data = await api.apnProfiles()
      setProfiles(Array.isArray(data?.apnListArray) ? data.apnListArray : [])
    } catch { setProfiles([]) }
    setLoading(false)
  }, [])

  useEffect(() => { fetchProfiles() }, [fetchProfiles])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function addProfile() {
    try {
      await api.apnAdd({
        profilename: form.name, wanapn: form.apn,
        username: form.user, password: form.pass,
        pppAuthMode: form.auth, pdpType: form.pdp,
      })
      flash('APN profile added')
      setAdding(false)
      setForm({ name: '', apn: '', user: '', pass: '', auth: 0, pdp: 3 })
      fetchProfiles()
    } catch (e) { flash(e instanceof Error ? e.message : 'Error') }
  }

  async function activateProfile(id: string) {
    try {
      await api.apnActivate({ profileId: id })
      flash('APN activated — connection may briefly drop')
      fetchProfiles()
    } catch (e) { flash(e instanceof Error ? e.message : 'Error') }
  }

  async function deleteProfile(id: string) {
    try {
      await api.apnDelete({ profileId: id })
      flash('Profile deleted')
      fetchProfiles()
    } catch (e) { flash(e instanceof Error ? e.message : 'Error') }
  }

  function applyPreset(p: typeof APN_PRESETS[0]) {
    setForm({ name: p.name, apn: p.apn, user: p.user, pass: p.pass, auth: p.auth, pdp: p.pdp })
    setAdding(true)
  }

  return (
    <div className="space-y-4">
      {msg && <Alert msg={msg} type={msg.includes('Error') ? 'error' : 'success'} />}

      <Card title="APN Profiles">
        {loading ? <p className="text-sm text-gray-500">Loading...</p> : profiles.length === 0 ? (
          <p className="text-sm text-gray-500">No manual APN profiles</p>
        ) : (
          <div className="space-y-2">
            {profiles.map(p => (
              <div key={p.profileId} className={`flex items-center justify-between rounded-xl px-3 py-2 ${p.isEnable ? 'bg-white/95 border border-slds-blue/30' : 'bg-gray-50/50'}`}>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {p.profilename}
                    {p.isEnable && <span className="ml-2 rounded-xl bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">Active</span>}
                  </p>
                  <p className="text-xs text-gray-500">
                    {p.wanapn} — {PDP_LABELS[p.pdpType] ?? '?'} / {AUTH_LABELS[p.pppAuthMode] ?? '?'}
                    {p.username ? ` — ${p.username}` : ''}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  {!p.isEnable && (
                    <button onClick={() => activateProfile(p.profileId)}
                      className="rounded-xl bg-slds-blue text-white px-3 py-2 text-xs font-bold hover:bg-slds-blueHover active:scale-[0.98] transition-all">Activate</button>
                  )}
                  <button onClick={() => deleteProfile(p.profileId)}
                    className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {adding ? (
        <Card title="Add APN Profile">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Input label="Profile Name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} placeholder="e.g. My Carrier" />
            <Input label="APN" value={form.apn} onChange={v => setForm(f => ({ ...f, apn: v }))} placeholder="e.g. internet" />
            <Input label="Username" value={form.user} onChange={v => setForm(f => ({ ...f, user: v }))} placeholder="(optional)" />
            <Input label="Password" value={form.pass} onChange={v => setForm(f => ({ ...f, pass: v }))} placeholder="(optional)" />
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">Authentication</label>
              <select value={form.auth} onChange={e => setForm(f => ({ ...f, auth: parseInt(e.target.value) }))}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all">
                <option value={0}>None</option>
                <option value={1}>PAP</option>
                <option value={2}>CHAP</option>
                <option value={3}>PAP/CHAP</option>
              </select>
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">PDP Type</label>
              <select value={form.pdp} onChange={e => setForm(f => ({ ...f, pdp: parseInt(e.target.value) }))}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all">
                <option value={3}>IPv4v6</option>
                <option value={1}>IPv4</option>
                <option value={2}>IPv6</option>
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={addProfile} disabled={!form.name || !form.apn}
              className="bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm">Add Profile</button>
            <button onClick={() => setAdding(false)}
              className="bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl font-bold text-gray-500 shadow-sm transition-all active:scale-95 text-sm">Cancel</button>
          </div>
        </Card>
      ) : (
        <button onClick={() => setAdding(true)}
          className="bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm">+ Add APN Profile</button>
      )}

      <Card title="Quick Presets">
        <p className="mb-2 text-xs text-gray-500">Tap a preset to pre-fill the add form with common carrier settings.</p>
        <div className="flex flex-wrap gap-1.5">
          {APN_PRESETS.map(p => (
            <button key={p.name} onClick={() => applyPreset(p)}
              className="rounded-xl bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50/60 transition-all duration-200">{p.name}</button>
          ))}
        </div>
      </Card>
    </div>
  )
}

// ── TTL Clamping ────────────────────────────────────────────────────────────
function TtlSection() {
  const [active, setActive] = useState<boolean | null>(null)
  const [ipv6Active, setIpv6Active] = useState(false)
  const [currentTtl, setCurrentTtl] = useState(0)
  const [ttlInput, setTtlInput] = useState('65')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function fetchStatus() {
    try {
      const data = await api.ttlStatus()
      setActive(data.active || data.ipv6_active)
      setIpv6Active(data.ipv6_active)
      setCurrentTtl(data.ttl_value)
      if (data.ttl_value > 0) setTtlInput(String(data.ttl_value))
    } catch {
      setMsg('Unable to fetch TTL status')
    }
  }

  useEffect(() => { fetchStatus() }, [])

  async function applyTtl() {
    const val = parseInt(ttlInput)
    if (!val || val < 1 || val > 255) { setMsg('TTL must be 1-255'); return }
    setLoading(true); setMsg('')
    try {
      await api.ttlSet(val)
      setMsg(`TTL set to ${val} (IPv4 + IPv6)`)
      await fetchStatus()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  async function clearTtl() {
    setLoading(true); setMsg('')
    try {
      await api.ttlClear()
      setMsg('TTL clamping disabled')
      await fetchStatus()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card title="TTL Clamping">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">
          Override TTL/Hop Limit on LAN ingress traffic to prevent carrier tethering detection.
          Changes are applied immediately and persist across reboots.
        </p>

        {active === false ? (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <input
              type="number" min={1} max={255} value={ttlInput}
              onChange={e => setTtlInput(e.target.value)}
              placeholder="e.g. 65"
              className="w-24 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all"
            />
            <button onClick={applyTtl} disabled={loading || !ttlInput}
              className="bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm py-1.5">
              {loading ? 'Applying...' : 'Enable Clamping'}
            </button>
          </div>
        ) : active === true ? (
          <div className="flex flex-wrap items-center gap-y-3 gap-x-4 pt-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-500">Active (TTL={currentTtl})</span>
              {ipv6Active && <span className="rounded-xl bg-gray-50/50 px-1.5 py-0.5 text-[10px] text-gray-500">IPv4 + IPv6</span>}
            </div>
            
            <div className="flex items-center gap-2 border-t sm:border-t-0 sm:border-l border-gray-200/60 pt-2 sm:pt-0 sm:pl-4">
              <input
                type="number" min={1} max={255} value={ttlInput}
                onChange={e => setTtlInput(e.target.value)}
                className="w-20 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all"
              />
              <button onClick={applyTtl} disabled={loading}
                className="bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl font-bold text-gray-500 shadow-sm transition-all active:scale-95 text-sm py-1.5 disabled:opacity-40">
                Update
              </button>
              <button onClick={clearTtl} disabled={loading}
                className="rounded-xl bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200 disabled:opacity-40">
                Disable
              </button>
            </div>
          </div>
        ) : (
          <span className="text-sm text-gray-500 pt-1 block">Checking status...</span>
        )}

        {msg && <Alert msg={msg} type={msg.includes('Failed') || msg.includes('Unable') ? 'error' : 'success'} />}
      </div>
    </Card>
  )
}

// ── Data Usage ──────────────────────────────────────────────────────────────
function DataUsageSection() {
  const [usage, setUsage] = useState<DataUsage | null>(null)
  const [limit, setLimit] = useState(() => {
    try {
      const s = localStorage.getItem('data_limit')
      if (s) return JSON.parse(s) as { gb: number; resetDay: number }
    } catch { /* corrupted data */ }
    return { gb: 0, resetDay: 1 }
  })
  const [editingLimit, setEditingLimit] = useState(false)
  const [limitGb, setLimitGb] = useState(String(limit.gb || ''))
  const [resetDay, setResetDay] = useState(String(limit.resetDay))

  const fetchUsage = useCallback(async () => {
    try { setUsage(await api.dataUsage()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchUsage()
    const id = setInterval(fetchUsage, 10000)
    return () => clearInterval(id)
  }, [fetchUsage])

  function saveLimit() {
    const newLimit = { gb: parseFloat(limitGb) || 0, resetDay: parseInt(resetDay) || 1 }
    setLimit(newLimit)
    localStorage.setItem('data_limit', JSON.stringify(newLimit))
    setEditingLimit(false)
  }

  const monthTotal = usage ? usage.month.rx_bytes + usage.month.tx_bytes : 0
  const limitBytes = limit.gb * 1e9
  const usagePct = limitBytes > 0 ? Math.min((monthTotal / limitBytes) * 100, 100) : 0

  const periods = usage ? [
    { label: 'Session (Today)', data: usage.day },
    { label: 'Cycle (Month)', data: usage.month },
    { label: 'Lifetime', data: usage.total },
  ] : []

  return (
    <div className="space-y-4">
      {/* Monthly limit bar */}
      <Card title="Monthly Usage" action={
        <button onClick={() => { setEditingLimit(true); setLimitGb(String(limit.gb || '')); setResetDay(String(limit.resetDay)) }}
          className="text-xs text-slds-blue hover:text-slds-blue transition-colors">{limit.gb > 0 ? 'Edit Limit' : 'Set Limit'}</button>
      }>
        {editingLimit && (
          <div className="mb-3 flex flex-col sm:flex-row sm:flex-wrap sm:items-end gap-2 rounded-2xl bg-gray-50/50 p-3">
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">Data Limit (GB)</label>
              <input type="number" value={limitGb} onChange={e => setLimitGb(e.target.value)} placeholder="e.g. 100"
                className="w-full sm:w-24 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all" />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-gray-500">Reset Day</label>
              <input type="number" min={1} max={28} value={resetDay} onChange={e => setResetDay(e.target.value)}
                className="w-full sm:w-16 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all" />
            </div>
            <div className="flex gap-2">
              <button onClick={saveLimit} className="flex-1 sm:flex-none bg-slds-blue text-white py-1.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm">Save</button>
              <button onClick={() => setEditingLimit(false)} className="flex-1 sm:flex-none bg-white border border-gray-200 hover:bg-gray-50 px-3 py-1.5 rounded-xl font-bold text-gray-500 shadow-sm transition-all active:scale-95 text-sm">Cancel</button>
            </div>
          </div>
        )}

        {usage && limit.gb > 0 && (
          <div className="mb-4">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-gray-500">{formatBytes(monthTotal)} / {limit.gb} GB</span>
              <span className={usagePct > 90 ? 'text-red-500' : usagePct > 70 ? 'text-amber-500' : 'text-green-500'}>
                {usagePct.toFixed(1)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-gray-50 overflow-hidden">
              <div className="h-full rounded-full bg-slds-blue transition-all duration-500" style={{
                width: `${usagePct}%`,
              }} />
            </div>
            <p className="mt-1 text-xs text-gray-500">Resets on day {limit.resetDay} of each month</p>
          </div>
        )}

        {/* Usage table */}
        {usage ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="pb-2 pr-4 font-medium">Period</th>
                  <th className="pb-2 pr-4 font-medium text-right">Download</th>
                  <th className="pb-2 pr-4 font-medium text-right">Upload</th>
                  <th className="pb-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100/60">
                {periods.map(({ label, data }) => (
                  <tr key={label}>
                    <td className="py-2 pr-4 text-gray-600">{label}</td>
                    <td className="py-2 pr-4 text-right text-green-500">{formatBytes(data.rx_bytes)}</td>
                    <td className="py-2 pr-4 text-right text-slds-blue">{formatBytes(data.tx_bytes)}</td>
                    <td className="py-2 text-right font-medium text-gray-900">{formatBytes(data.rx_bytes + data.tx_bytes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">Loading...</p>
        )}
      </Card>

      {/* Visual bars — separate download + upload */}
      {usage && (
        <Card title="Usage Breakdown">
          {periods.map(({ label, data }) => {
            const maxBytes = Math.max(...periods.map(p => Math.max(p.data.rx_bytes, p.data.tx_bytes)), 1)
            const dlPct = Math.max((data.rx_bytes / maxBytes) * 100, 2)
            const ulPct = Math.max((data.tx_bytes / maxBytes) * 100, 2)
            return (
              <div key={label} className="mb-4 last:mb-0">
                <p className="mb-1.5 text-[9px] font-bold text-gray-500 uppercase tracking-widest">{label}</p>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[10px] text-green-500">DL</span>
                    <div className="flex-1 h-4 rounded bg-gray-50 overflow-hidden">
                      <div className="h-full rounded bg-green-500 flex items-center px-1.5 text-[9px] font-medium text-white transition-all"
                        style={{ width: `${dlPct}%`, minWidth: 'fit-content' }}>
                        {formatBytes(data.rx_bytes)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-8 text-[10px] text-slds-blue">UL</span>
                    <div className="flex-1 h-4 rounded bg-gray-50 overflow-hidden">
                      <div className="h-full rounded bg-slds-blue flex items-center px-1.5 text-[9px] font-medium text-white transition-all"
                        style={{ width: `${ulPct}%`, minWidth: 'fit-content' }}>
                        {formatBytes(data.tx_bytes)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </Card>
      )}
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function ModemPage() {
  const [tab, setTab] = useState<'apn' | 'data' | 'ttl'>('apn')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Modem</h1>

      <div className="bg-gray-50/50 rounded-2xl p-1 flex gap-1 border border-gray-200/50 w-fit">
        {([
          ['apn', 'APN'],
          ['data', 'Data Usage'],
          ['ttl', 'TTL'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-600'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'apn' && (
        <div className="space-y-4">
          <ApnModeSection />
          <ApnSection />
        </div>
      )}
      {tab === 'data' && <DataUsageSection />}
      {tab === 'ttl' && <TtlSection />}
    </div>
  )
}

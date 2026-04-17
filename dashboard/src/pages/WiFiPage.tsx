import { useState, useEffect, useCallback } from 'react'
import { api, type WifiAll, type WifiBand } from '../api'
import Card from '../components/Card'

const INPUT_CLS = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none text-sm transition-all'
const SELECT_CLS = 'w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400 outline-none text-sm transition-all'

function BandCard({ label, band, suffix, onRefresh }: { label: string; band: WifiBand; suffix: string; onRefresh: () => void }) {
  const [editing, setEditing] = useState(false)
  const [ssid, setSsid] = useState('')
  const [password, setPassword] = useState('')
  const [channel, setChannel] = useState('')
  const [htmode, setHtmode] = useState('')
  const [txpower, setTxpower] = useState('')
  const [hidden, setHidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    setSsid(band.ssid ?? '')
    setPassword(band.password ?? '')
    setChannel(String(band.channel ?? 'auto'))
    setHtmode(band.bandwidth ?? '')
    setTxpower('')
    setHidden(band.hidden)
  }, [band])

  async function handleSave() {
    setSaving(true)
    setMsg('')
    try {
      const settings: Record<string, unknown> = {
        [`ssid_${suffix}`]: ssid,
        [`key_${suffix}`]: password,
        [`hidden_${suffix}`]: hidden ? '1' : '0',
      }
      if (channel && channel !== 'auto') settings[`channel_${suffix}`] = channel
      if (htmode) settings[`htmode_${suffix}`] = htmode
      if (txpower) settings[`txpower_${suffix}`] = txpower
      await api.wifiSet(settings)
      setMsg('Saved \u2014 WiFi may reconnect')
      setEditing(false)
      onRefresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  async function toggleRadio() {
    setSaving(true)
    setMsg('')
    try {
      const key = suffix === '2g' ? 'radio2_disabled' : 'radio5_disabled'
      await api.wifiSet({ [key]: band.enabled ? '1' : '0' })
      setMsg(band.enabled ? 'Radio disabled' : 'Radio enabled')
      onRefresh()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const channels2g = ['auto', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13']
  const channels5g = ['auto', '36', '40', '44', '48', '52', '56', '60', '64', '100', '104', '108', '112', '116', '120', '124', '128', '132', '136', '140', '144', '149', '153', '157', '161', '165']
  const channels = suffix === '2g' ? channels2g : channels5g
  const htmodes2g = ['HT20', 'HT40']
  const htmodes5g = ['HT20', 'HT40', 'HT80', 'HT160']
  const htmodes = suffix === '2g' ? htmodes2g : htmodes5g

  return (
    <Card title={label} action={
      !editing ? (
        <button onClick={() => setEditing(true)} className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-bold">Edit</button>
      ) : (
        <div className="flex gap-2">
          <button onClick={() => setEditing(false)} className="text-xs text-slate-400 hover:text-slate-800 transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="text-xs text-blue-600 hover:text-blue-700 transition-colors font-bold">
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
        </div>
      )
    }>
      {msg && <p className={`mb-2 text-xs ${msg.startsWith('Saved') || msg.includes('abled') ? 'text-green-500' : 'text-red-500'}`}>{msg}</p>}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${band.enabled ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-slate-600">{band.enabled ? 'Enabled' : 'Disabled'}</span>
            {band.clients != null && (
              <span className="text-xs text-slate-400">({band.clients} client{band.clients !== 1 ? 's' : ''})</span>
            )}
          </div>
          <button onClick={toggleRadio} disabled={saving}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
              band.enabled
                ? 'bg-red-50 text-red-600 border border-red-200 hover:bg-red-100'
                : 'bg-green-50 text-green-600 border border-green-200 hover:bg-green-100'
            } disabled:opacity-40`}>
            {band.enabled ? 'Disable' : 'Enable'}
          </button>
        </div>

        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 block">SSID</label>
          {editing ? (
            <input value={ssid} onChange={e => setSsid(e.target.value)} className={INPUT_CLS} />
          ) : (
            <p className="text-sm font-medium text-slate-800">{band.ssid ?? '\u2014'}</p>
          )}
        </div>

        <div>
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 block">Password</label>
          {editing ? (
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className={INPUT_CLS} />
          ) : (
            <p className="text-sm text-slate-800 font-mono">{band.password ? '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' : '\u2014'}</p>
          )}
        </div>

        {editing ? (
          <div className="space-y-3 border-t border-slate-200/60 pt-3">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Advanced</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 block">Channel</label>
                <select value={channel} onChange={e => setChannel(e.target.value)} className={SELECT_CLS}>
                  {channels.map(c => <option key={c} value={c}>{c === 'auto' ? 'Auto' : c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 block">Bandwidth</label>
                <select value={htmode} onChange={e => setHtmode(e.target.value)} className={SELECT_CLS}>
                  {htmodes.map(m => <option key={m} value={m}>{m.replace('HT', '')} MHz</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5 block">TX Power</label>
                <select value={txpower} onChange={e => setTxpower(e.target.value)} className={SELECT_CLS}>
                  <option value="">Default</option>
                  <option value="100">100%</option>
                  <option value="75">75%</option>
                  <option value="50">50%</option>
                  <option value="25">25%</option>
                </select>
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id={`hidden_${suffix}`} checked={hidden} onChange={e => setHidden(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-200 bg-slate-50 text-blue-500" />
                <label htmlFor={`hidden_${suffix}`} className="text-xs text-slate-400 font-medium">Hidden SSID</label>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Channel" value={band.channel != null ? String(band.channel) : 'Auto'} />
            <Info label="Bandwidth" value={band.bandwidth ?? '\u2014'} />
            <Info label="Security" value={band.security ?? '\u2014'} />
            <Info label="Hidden" value={band.hidden ? 'Yes' : 'No'} />
          </div>
        )}
      </div>
    </Card>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
      <p className="text-slate-800">{value}</p>
    </div>
  )
}

export default function WiFiPage() {
  const [wifi, setWifi] = useState<WifiAll | null>(null)

  const fetchWifi = useCallback(async () => {
    try { setWifi(await api.wifiStatus()) } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchWifi() }, [fetchWifi])

  if (!wifi) return <div className="text-slate-400 text-sm">Loading\u2026</div>

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-slate-800">Wi-Fi</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BandCard label="2.4 GHz" band={wifi.band_2g} suffix="2g" onRefresh={fetchWifi} />
        <BandCard label="5 GHz" band={wifi.band_5g} suffix="5g" onRefresh={fetchWifi} />
      </div>
      {wifi.guest_ssid && (
        <Card title="Guest Network">
          <p className="text-sm text-slate-600">SSID: <span className="font-medium text-slate-800">{wifi.guest_ssid}</span></p>
        </Card>
      )}
    </div>
  )
}

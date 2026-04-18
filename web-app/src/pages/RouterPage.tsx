import { useState, useEffect } from 'react'
import { api, type DnsConfig, type LanConfig } from '../api'
import Card from '../components/Card'

const INPUT_CLS = 'w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all'
const BTN_PRIMARY = 'bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm'

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-0.5 block">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={INPUT_CLS} />
    </div>
  )
}

function Alert({ msg, type = 'success' }: { msg: string; type?: 'success' | 'error' }) {
  return <p className={`text-xs ${type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{msg}</p>
}

function DnsTab() {
  const [dns, setDns] = useState<DnsConfig>({ primary: '', secondary: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { api.dnsGet().then(setDns).catch(() => {}) }, [])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function save() {
    setSaving(true)
    try {
      await api.dnsSet({
        dns_mode: 'manual',
        prefer_dns_manual: dns.primary,
        standby_dns_manual: dns.secondary,
        ...(dns.ipv6_primary ? { ipv6_wan_prefer_dns_manual: dns.ipv6_primary } : {}),
        ...(dns.ipv6_secondary ? { ipv6_wan_standby_dns_manual: dns.ipv6_secondary } : {}),
      })
      flash('DNS settings saved')
    } catch (e) { flash(e instanceof Error ? e.message : 'Error') }
    setSaving(false)
  }

  return (
    <Card title="DNS Servers">
      {msg && <div className="mb-2"><Alert msg={msg} /></div>}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Input label="Primary DNS (IPv4)" value={dns.primary} onChange={v => setDns(d => ({ ...d, primary: v }))} placeholder="1.1.1.1" />
        <Input label="Secondary DNS (IPv4)" value={dns.secondary} onChange={v => setDns(d => ({ ...d, secondary: v }))} placeholder="1.0.0.1" />
        <Input label="Primary DNS (IPv6)" value={dns.ipv6_primary ?? ''} onChange={v => setDns(d => ({ ...d, ipv6_primary: v }))} placeholder="2606:4700:4700::1111" />
        <Input label="Secondary DNS (IPv6)" value={dns.ipv6_secondary ?? ''} onChange={v => setDns(d => ({ ...d, ipv6_secondary: v }))} placeholder="2001:4860:4860::8888" />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={save} disabled={saving} className={BTN_PRIMARY}>
          {saving ? 'Saving\u2026' : 'Apply'}
        </button>
        <div className="flex gap-2">
          <button onClick={() => setDns(d => ({ ...d, primary: '1.1.1.1', secondary: '1.0.0.1', ipv6_primary: '2606:4700:4700::1111', ipv6_secondary: '2606:4700:4700::1001' }))}
            className="py-2 px-2 text-xs text-slds-blue hover:text-slds-blueHover transition-colors font-bold">Cloudflare</button>
          <button onClick={() => setDns(d => ({ ...d, primary: '8.8.8.8', secondary: '8.8.4.4', ipv6_primary: '2001:4860:4860::8888', ipv6_secondary: '2001:4860:4860::8844' }))}
            className="py-2 px-2 text-xs text-slds-blue hover:text-slds-blueHover transition-colors font-bold">Google</button>
          <button onClick={() => setDns(d => ({ ...d, primary: '9.9.9.9', secondary: '149.112.112.112', ipv6_primary: '2620:fe::fe', ipv6_secondary: '2620:fe::9' }))}
            className="py-2 px-2 text-xs text-slds-blue hover:text-slds-blueHover transition-colors font-bold">Quad9</button>
        </div>
      </div>
    </Card>
  )
}

function LanTab() {
  const [lan, setLan] = useState<LanConfig>({ ip: '', netmask: '', dhcp_start: '', dhcp_end: '', dhcp_lease: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => { api.lanGet().then(setLan).catch(() => {}) }, [])

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }

  async function save() {
    setSaving(true)
    try {
      await api.lanSet({ lan_ipaddr: lan.ip, lan_netmask: lan.netmask, dhcp_start: lan.dhcp_start, dhcp_end: lan.dhcp_end, dhcp_lease_time: lan.dhcp_lease })
      flash('LAN settings saved')
    } catch (e) { flash(e instanceof Error ? e.message : 'Error') }
    setSaving(false)
  }

  return (
    <Card title="LAN / DHCP">
      {msg && <div className="mb-2"><Alert msg={msg} /></div>}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Input label="LAN IP" value={lan.ip} onChange={v => setLan(l => ({ ...l, ip: v }))} />
        <Input label="Netmask" value={lan.netmask} onChange={v => setLan(l => ({ ...l, netmask: v }))} />
        <Input label="DHCP Start" value={lan.dhcp_start} onChange={v => setLan(l => ({ ...l, dhcp_start: v }))} />
        <Input label="DHCP End" value={lan.dhcp_end} onChange={v => setLan(l => ({ ...l, dhcp_end: v }))} />
        <Input label="Lease Time (seconds)" value={lan.dhcp_lease} onChange={v => setLan(l => ({ ...l, dhcp_lease: v }))} />
      </div>
      <div className="mt-4">
        <button onClick={save} disabled={saving} className={BTN_PRIMARY}>
          {saving ? 'Saving\u2026' : 'Apply'}
        </button>
      </div>
    </Card>
  )
}

export default function RouterPage() {
  const [tab, setTab] = useState<'lan' | 'dns'>('lan')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Router</h1>

      <div className="bg-gray-50/50 rounded-2xl p-1 flex gap-1 w-fit border border-gray-200/50">
        {([
          ['lan', 'LAN / DHCP'],
          ['dns', 'DNS'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-150 ${
              tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-600'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'lan' && <LanTab />}
      {tab === 'dns' && <DnsTab />}
    </div>
  )
}

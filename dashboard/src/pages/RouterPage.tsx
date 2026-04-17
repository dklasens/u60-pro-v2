import { useState, useEffect } from 'react'
import { api, type DnsConfig, type LanConfig } from '../api'
import Card from '../components/Card'

function Input({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className="mb-0.5 block text-xs text-text-muted">{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full rounded-pill border border-divider bg-white/40 px-3 py-1.5 text-sm text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20" />
    </div>
  )
}

function Alert({ msg, type = 'success' }: { msg: string; type?: 'success' | 'error' }) {
  return <p className={`text-xs ${type === 'error' ? 'text-red-500' : 'text-green-500'}`}>{msg}</p>
}

// ── DNS Tab ──────────────────────────────────────────────────────────────────
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
        <button onClick={save} disabled={saving}
          className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-all duration-200 disabled:opacity-40">
          {saving ? 'Saving\u2026' : 'Apply'}
        </button>
        <div className="flex gap-2">
          <button onClick={() => setDns(d => ({ ...d, primary: '1.1.1.1', secondary: '1.0.0.1', ipv6_primary: '2606:4700:4700::1111', ipv6_secondary: '2606:4700:4700::1001' }))}
            className="text-xs text-primary hover:text-primary-hover transition-colors">Cloudflare</button>
          <button onClick={() => setDns(d => ({ ...d, primary: '8.8.8.8', secondary: '8.8.4.4', ipv6_primary: '2001:4860:4860::8888', ipv6_secondary: '2001:4860:4860::8844' }))}
            className="text-xs text-primary hover:text-primary-hover transition-colors">Google</button>
          <button onClick={() => setDns(d => ({ ...d, primary: '9.9.9.9', secondary: '149.112.112.112', ipv6_primary: '2620:fe::fe', ipv6_secondary: '2620:fe::9' }))}
            className="text-xs text-primary hover:text-primary-hover transition-colors">Quad9</button>
        </div>
      </div>
    </Card>
  )
}

// ── LAN Tab ──────────────────────────────────────────────────────────────────
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
        <button onClick={save} disabled={saving}
          className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-all duration-200 disabled:opacity-40">
          {saving ? 'Saving\u2026' : 'Apply'}
        </button>
      </div>
    </Card>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function RouterPage() {
  const [tab, setTab] = useState<'lan' | 'dns'>('lan')

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Router</h1>

      <div className="glass-subtle !rounded-glass p-1 flex gap-1 w-fit">
        {([
          ['lan', 'LAN / DHCP'],
          ['dns', 'DNS'],
        ] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`rounded-pill px-3 py-1.5 text-sm font-medium transition-all duration-200 ${tab === id ? 'bg-white/60 text-text-primary' : 'text-text-muted hover:text-text-secondary'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'lan' && <LanTab />}
      {tab === 'dns' && <DnsTab />}
    </div>
  )
}

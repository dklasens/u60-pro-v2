import { useState, useEffect, useCallback } from 'react'
import { api, type Client } from '../api'
import Card from '../components/Card'

function formatLinkMbps(value?: number) {
  if (value == null || value <= 0) return '—'
  return `${Math.round(value)} Mbps`
}

function formatWifiLink(client: Client) {
  const parts: string[] = []
  if (client.tx_bitrate_mbps != null) parts.push(`TX ${client.tx_bitrate_mbps.toFixed(0)}`)
  if (client.rx_bitrate_mbps != null) parts.push(`RX ${client.rx_bitrate_mbps.toFixed(0)}`)
  return parts.length > 0 ? `${parts.join(' / ')} Mbps` : '—'
}

function formatInterfaceLabel(client: Client) {
  const base = client.medium === 'usb-c'
    ? 'USB-C'
    : client.medium === 'ethernet'
      ? 'Ethernet'
      : 'Wired'
  return client.interface ? `${base} (${client.interface})` : base
}

function groupClients(clients: Client[]) {
  return {
    wifi: clients.filter(c => c.medium === 'wifi'),
    usb: clients.filter(c => c.medium === 'usb-c'),
    ethernet: clients.filter(c => c.medium === 'ethernet'),
    other: clients.filter(c => !c.medium || c.medium === 'wired'),
  }
}

export default function NetworkPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const c = await api.clients()
      setClients(c ?? [])
    } catch { /* ignore */ }
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 5000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) return <div className="text-gray-400 text-sm">Loading…</div>

  const grouped = groupClients(clients)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Connected</h1>

      <Card title={`Connected Clients (${clients.length})`}>
        {clients.length === 0 ? (
          <p className="text-sm text-gray-400">No clients connected</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Wi-Fi</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{grouped.wifi.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">USB-C</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{grouped.usb.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Ethernet</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{grouped.ethernet.length}</p>
            </div>
            <div className="rounded-xl bg-gray-50 px-3 py-3">
              <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Other</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{grouped.other.length}</p>
            </div>
          </div>
        )}
      </Card>

      {grouped.wifi.length > 0 && (
        <Card title={`Wi-Fi Clients (${grouped.wifi.length})`}>
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="pb-2 pr-4">Hostname</th>
                    <th className="pb-2 pr-4">IP Address</th>
                    <th className="pb-2 pr-4">Radio</th>
                    <th className="pb-2 pr-4">Signal</th>
                    <th className="pb-2 pr-4">Link</th>
                    <th className="pb-2">MAC Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60">
                  {grouped.wifi.map(c => (
                    <tr key={c.mac} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2 pr-4 text-gray-900">{c.hostname || '—'}</td>
                      <td className="py-2 pr-4 font-mono text-gray-600">{c.ip ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          c.wifi_band === '5 GHz'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {c.wifi_band ?? 'Wi-Fi'}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-600">{c.signal_dbm != null ? `${c.signal_dbm} dBm` : '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatWifiLink(c)}</td>
                      <td className="py-2 font-mono text-gray-400 text-xs">{c.mac}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent sm:hidden" />
          </div>
        </Card>
      )}

      {grouped.usb.length > 0 && (
        <Card title={`USB-C Clients (${grouped.usb.length})`}>
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="pb-2 pr-4">Hostname</th>
                    <th className="pb-2 pr-4">IP Address</th>
                    <th className="pb-2 pr-4">Link</th>
                    <th className="pb-2 pr-4">Speed</th>
                    <th className="pb-2">MAC Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60">
                  {grouped.usb.map(c => (
                    <tr key={c.mac} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2 pr-4 text-gray-900">{c.hostname || '—'}</td>
                      <td className="py-2 pr-4 font-mono text-gray-600">{c.ip ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatInterfaceLabel(c)}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatLinkMbps(c.wired_link_mbps)}</td>
                      <td className="py-2 font-mono text-gray-400 text-xs">{c.mac}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent sm:hidden" />
          </div>
        </Card>
      )}

      {grouped.ethernet.length > 0 && (
        <Card title={`Ethernet Clients (${grouped.ethernet.length})`}>
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="pb-2 pr-4">Hostname</th>
                    <th className="pb-2 pr-4">IP Address</th>
                    <th className="pb-2 pr-4">Link</th>
                    <th className="pb-2 pr-4">Speed</th>
                    <th className="pb-2">MAC Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60">
                  {grouped.ethernet.map(c => (
                    <tr key={c.mac} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2 pr-4 text-gray-900">{c.hostname || '—'}</td>
                      <td className="py-2 pr-4 font-mono text-gray-600">{c.ip ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatInterfaceLabel(c)}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatLinkMbps(c.wired_link_mbps)}</td>
                      <td className="py-2 font-mono text-gray-400 text-xs">{c.mac}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent sm:hidden" />
          </div>
        </Card>
      )}

      {grouped.other.length > 0 && (
        <Card title={`Other Clients (${grouped.other.length})`}>
          <div className="relative">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                    <th className="pb-2 pr-4">Hostname</th>
                    <th className="pb-2 pr-4">IP Address</th>
                    <th className="pb-2 pr-4">Link</th>
                    <th className="pb-2">MAC Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/60">
                  {grouped.other.map(c => (
                    <tr key={c.mac} className="hover:bg-gray-50/60 transition-colors">
                      <td className="py-2 pr-4 text-gray-900">{c.hostname || '—'}</td>
                      <td className="py-2 pr-4 font-mono text-gray-600">{c.ip ?? '—'}</td>
                      <td className="py-2 pr-4 text-gray-600">{formatInterfaceLabel(c)}</td>
                      <td className="py-2 font-mono text-gray-400 text-xs">{c.mac}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent sm:hidden" />
          </div>
        </Card>
      )}
    </div>
  )
}

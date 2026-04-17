import { useState, useEffect, useCallback } from 'react'
import { api, type Client } from '../api'
import Card from '../components/Card'

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

  if (loading) return <div className="text-slate-400 text-sm">Loading\u2026</div>

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold text-slate-800">Network</h1>

      <Card title={`Connected Clients (${clients.length})`}>
        {clients.length === 0 ? (
          <p className="text-sm text-slate-400">No clients connected</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                  <th className="pb-2 pr-4">Hostname</th>
                  <th className="pb-2 pr-4">IP Address</th>
                  <th className="pb-2">MAC Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/60">
                {clients.map(c => (
                  <tr key={c.mac} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-2 pr-4 text-slate-800">{c.hostname || '\u2014'}</td>
                    <td className="py-2 pr-4 font-mono text-slate-600">{c.ip ?? '\u2014'}</td>
                    <td className="py-2 font-mono text-slate-400 text-xs">{c.mac}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

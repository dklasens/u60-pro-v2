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

  if (loading) return <div className="text-slate-400 text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Network</h1>

      <Card title={`Connected Clients (${clients.length})`}>
        {clients.length === 0 ? (
          <p className="text-sm text-slate-500">No clients connected</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400">
                  <th className="pb-2 pr-4 font-medium">Hostname</th>
                  <th className="pb-2 pr-4 font-medium">IP Address</th>
                  <th className="pb-2 font-medium">MAC Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {clients.map(c => (
                  <tr key={c.mac}>
                    <td className="py-2 pr-4 text-white">{c.hostname || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-slate-300">{c.ip ?? '—'}</td>
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

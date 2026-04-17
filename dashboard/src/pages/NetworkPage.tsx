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

  if (loading) return <div className="text-text-muted text-sm">Loading…</div>

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-text-primary">Network</h1>

      <Card title={`Connected Clients (${clients.length})`}>
        {clients.length === 0 ? (
          <p className="text-sm text-text-muted">No clients connected</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted">
                  <th className="pb-2 pr-4 font-medium">Hostname</th>
                  <th className="pb-2 pr-4 font-medium">IP Address</th>
                  <th className="pb-2 font-medium">MAC Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-divider">
                {clients.map(c => (
                  <tr key={c.mac}>
                    <td className="py-2 pr-4 text-text-primary">{c.hostname || '—'}</td>
                    <td className="py-2 pr-4 font-mono text-text-secondary">{c.ip ?? '—'}</td>
                    <td className="py-2 font-mono text-text-muted text-xs">{c.mac}</td>
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

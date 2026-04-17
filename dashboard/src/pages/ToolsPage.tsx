import { useState } from 'react'
import { api } from '../api'
import Card from '../components/Card'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card title={title}>{children}</Card>
}

function Alert({ type, msg }: { type: 'success' | 'error' | 'info'; msg: string }) {
  const colors = { success: 'text-green-400', error: 'text-red-400', info: 'text-blue-400' }
  return <p className={`text-sm ${colors[type]}`}>{msg}</p>
}

// ── USB Mode ──────────────────────────────────────────────────────────────────
function UsbTool() {
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  async function setMode(mode: string) {
    setLoading(true); setMsg('')
    try {
      await api.usbMode(mode)
      setMsg(`USB mode set to ${mode}. Device may need reboot.`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Section title="USB Mode">
      <div className="space-y-3">
        <p className="text-xs text-slate-400">Switch USB operating mode. A reboot may be required.</p>
        {msg && <Alert type={msg.includes('Error') ? 'error' : 'success'} msg={msg} />}
        <div className="flex flex-wrap gap-2">
          {['rndis', 'ecm', 'ncm', 'debug'].map(m => (
            <button key={m} onClick={() => setMode(m)} disabled={loading}
              className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-medium text-white hover:bg-slate-600 disabled:opacity-50">
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}

// ── Reboot ────────────────────────────────────────────────────────────────────
function RebootTool() {
  const [confirm, setConfirm] = useState(false)
  const [rebooting, setRebooting] = useState(false)

  async function doReboot() {
    setRebooting(true)
    try { await api.reboot() } catch { /* ignore */ }
  }

  return (
    <Section title="Device Reboot">
      <p className="mb-3 text-xs text-slate-400">Reboot the router. All connections will be temporarily interrupted.</p>
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="rounded-lg bg-red-800/60 px-4 py-2 text-sm font-medium text-red-300 hover:bg-red-700/60">
          Reboot
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={doReboot} disabled={rebooting} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50">
            {rebooting ? 'Rebooting...' : 'Confirm Reboot'}
          </button>
          <button onClick={() => setConfirm(false)} className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600">
            Cancel
          </button>
        </div>
      )}
    </Section>
  )
}

export default function ToolsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-white">Tools</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UsbTool />
        <RebootTool />
      </div>
    </div>
  )
}

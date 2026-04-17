import { useState } from 'react'
import { api } from '../api'
import Card from '../components/Card'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card title={title}>{children}</Card>
}

function Alert({ type, msg }: { type: 'success' | 'error' | 'info'; msg: string }) {
  const colors = { success: 'text-green-500', error: 'text-red-500', info: 'text-primary' }
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
        <p className="text-xs text-text-muted">Switch USB operating mode. A reboot may be required.</p>
        {msg && <Alert type={msg.includes('Error') ? 'error' : 'success'} msg={msg} />}
        <div className="flex flex-wrap gap-2">
          {['rndis', 'ecm', 'ncm', 'debug'].map(m => (
            <button key={m} onClick={() => setMode(m)} disabled={loading}
              className="rounded-pill bg-white/30 backdrop-blur-sm px-3 py-2 text-sm font-medium text-text-secondary hover:bg-white/50 transition-all duration-200 disabled:opacity-40">
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
      <p className="mb-3 text-xs text-text-muted">Reboot the router. All connections will be temporarily interrupted.</p>
      {!confirm ? (
        <button onClick={() => setConfirm(true)} className="rounded-pill bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200">
          Reboot
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={doReboot} disabled={rebooting} className="rounded-pill bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200 disabled:opacity-40">
            {rebooting ? 'Rebooting...' : 'Confirm Reboot'}
          </button>
          <button onClick={() => setConfirm(false)} className="rounded-pill bg-white/30 backdrop-blur-sm px-4 py-2 text-sm font-medium text-text-secondary hover:bg-white/50 transition-all duration-200">
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
      <h1 className="text-lg font-semibold text-text-primary">Tools</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UsbTool />
        <RebootTool />
      </div>
    </div>
  )
}

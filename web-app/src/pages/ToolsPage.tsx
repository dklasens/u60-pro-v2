import { useState } from 'react'
import { api } from '../api'
import Card from '../components/Card'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <Card title={title}>{children}</Card>
}

function Alert({ type, msg }: { type: 'success' | 'error' | 'info'; msg: string }) {
  const colors = { success: 'text-green-500', error: 'text-red-500', info: 'text-slds-blue' }
  return <p className={`text-sm ${colors[type]}`}>{msg}</p>
}

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
        <p className="text-xs text-gray-400">Switch USB operating mode. A reboot may be required.</p>
        {msg && <Alert type={msg.includes('Error') ? 'error' : 'success'} msg={msg} />}
        <div className="flex flex-wrap gap-2">
          {['rndis', 'ecm', 'ncm', 'debug'].map(m => (
            <button key={m} onClick={() => setMode(m)} disabled={loading}
              className="bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl font-bold text-gray-500 shadow-macos transition-all active:scale-95 text-sm disabled:opacity-40">
              {m.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </Section>
  )
}

function RebootTool() {
  const [confirm, setConfirm] = useState(false)
  const [rebooting, setRebooting] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  async function doReboot() {
    setRebooting(true)
    setMsg({ type: 'info', text: 'Sending reboot command...' })
    try {
      await api.reboot()
      setMsg({ type: 'success', text: 'Reboot command sent. Device should restart within about 10-30 seconds.' })
      setConfirm(false)
    } catch (e) {
      setMsg({ type: 'error', text: e instanceof Error ? e.message : 'Failed to reboot device.' })
    } finally {
      setRebooting(false)
    }
  }

  return (
    <Section title="Device Reboot">
      <p className="mb-3 text-xs text-gray-400">Reboot the router. All connections will be temporarily interrupted.</p>
      {msg && <div className="mb-3"><Alert type={msg.type} msg={msg.text} /></div>}
      {!confirm ? (
        <button onClick={() => setConfirm(true)}
          className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 border border-red-200 hover:bg-red-100 transition-all duration-150">
          Reboot
        </button>
      ) : (
        <div className="flex gap-2">
          <button onClick={doReboot} disabled={rebooting}
            className="rounded-xl bg-red-50 px-4 py-2 text-sm font-bold text-red-600 border border-red-200 hover:bg-red-100 transition-all duration-150 disabled:opacity-40">
            {rebooting ? 'Rebooting...' : 'Confirm Reboot'}
          </button>
          <button onClick={() => setConfirm(false)}
            className="bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl font-bold text-gray-500 shadow-macos transition-all active:scale-95 text-sm">
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
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Tools</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UsbTool />
        <RebootTool />
      </div>
    </div>
  )
}

import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../api'
import Card from '../components/Card'

type Tab = 'signal-logger' | 'connection-events' | 'at-console'

interface LoggerStatus {
  running: boolean
  samples?: number
  events?: number
  elapsed_secs: number
  duration_secs: number
  interval_secs: number
}

function formatDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function downloadCsv(csv: string, prefix: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${prefix}_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const DURATION_OPTS = [
  [300, '5 minutes'], [900, '15 minutes'], [1800, '30 minutes'],
  [3600, '1 hour'], [7200, '2 hours'], [14400, '4 hours'],
  [28800, '8 hours'], [43200, '12 hours'], [86400, '24 hours'],
] as const

const INTERVAL_OPTS = [
  [1, '1 second'], [3, '3 seconds'], [5, '5 seconds'],
  [10, '10 seconds'], [30, '30 seconds'], [60, '1 minute'],
] as const

// ── Signal Logger ────────────────────────────────────────────────────────────

function SignalLoggerTab() {
  const [status, setStatus] = useState<LoggerStatus | null>(null)
  const [duration, setDuration] = useState(3600)
  const [interval, setInterval_] = useState(3)
  const [loading, setLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try { setStatus(await api.loggerSignalStatus()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, interval)
    return () => clearInterval(id)
  }, [fetchStatus])

  const isRunning = status?.running ?? false

  async function handleStart() {
    setLoading(true)
    try { await api.loggerSignalStart(duration, interval); await fetchStatus() } catch { /* ignore */ }
    setLoading(false)
  }

  async function handleStop() {
    try { await api.loggerSignalStop(); await fetchStatus() } catch { /* ignore */ }
  }

  async function handleDownload() {
    try {
      const data = await api.loggerSignalDownload()
      downloadCsv(data.csv, 'signal_log')
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <Card title="Signal Logger">
        <p className="text-xs text-gray-500 mb-4">
          Continuously logs signal metrics (RSRP, RSRQ, SINR, RSSI, bands, CA) to CSV. Maximum 24 hours.
        </p>

        {!isRunning && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all">
                {DURATION_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Interval</label>
              <select value={interval} onChange={e => setInterval_(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all">
                {INTERVAL_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <button onClick={handleStart} disabled={loading}
              className="bg-green-50 border border-green-200 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-100 transition-all duration-200 disabled:opacity-40 rounded-xl">
              {loading ? 'Starting...' : 'Start Logging'}
            </button>
          ) : (
            <button onClick={handleStop}
              className="bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-all duration-200 rounded-xl">
              Stop Logging
            </button>
          )}
          <button onClick={handleDownload}
            className="bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl font-bold text-gray-500 shadow-sm transition-all active:scale-95 text-sm">
            Download CSV
          </button>
        </div>
      </Card>

      {status && (
        <Card title="Status">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Status</p>
              <p className={`font-bold ${isRunning ? 'text-green-500' : 'text-gray-500'}`}>
                {isRunning ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Samples</p>
              <p className="text-2xl font-bold text-gray-900">{status.samples ?? 0}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Elapsed</p>
              <p className="font-mono text-gray-600">{formatDuration(status.elapsed_secs)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Duration</p>
              <p className="font-mono text-gray-600">{formatDuration(status.duration_secs)}</p>
            </div>
          </div>
          {isRunning && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-slds-blue transition-all duration-500"
                  style={{ width: `${Math.min(100, (status.elapsed_secs / status.duration_secs) * 100)}%` }} />
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ── Connection Events ────────────────────────────────────────────────────────

function ConnectionEventsTab() {
  const [status, setStatus] = useState<LoggerStatus | null>(null)
  const [duration, setDuration] = useState(3600)
  const [interval, setInterval_] = useState(3)
  const [loading, setLoading] = useState(false)

  const fetchStatus = useCallback(async () => {
    try { setStatus(await api.loggerConnectionStatus()) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    fetchStatus()
    const id = setInterval(fetchStatus, interval)
    return () => clearInterval(id)
  }, [fetchStatus])

  const isRunning = status?.running ?? false

  async function handleStart() {
    setLoading(true)
    try { await api.loggerConnectionStart(duration, interval); await fetchStatus() } catch { /* ignore */ }
    setLoading(false)
  }

  async function handleStop() {
    try { await api.loggerConnectionStop(); await fetchStatus() } catch { /* ignore */ }
  }

  async function handleDownload() {
    try {
      const data = await api.loggerConnectionDownload()
      downloadCsv(data.csv, 'connection_log')
    } catch { /* ignore */ }
  }

  return (
    <div className="space-y-4">
      <Card title="Connection Event Logger">
        <p className="text-xs text-gray-500 mb-4">
          Monitors connection state and logs events: cell handovers, band changes, NR connect/disconnect, PCI changes. Maximum 24 hours.
        </p>

        {!isRunning && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all">
                {DURATION_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Poll Interval</label>
              <select value={interval} onChange={e => setInterval_(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all">
                {INTERVAL_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <button onClick={handleStart} disabled={loading}
              className="bg-green-50 border border-green-200 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-100 transition-all duration-200 disabled:opacity-40 rounded-xl">
              {loading ? 'Starting...' : 'Start Monitoring'}
            </button>
          ) : (
            <button onClick={handleStop}
              className="bg-red-50 border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 transition-all duration-200 rounded-xl">
              Stop Monitoring
            </button>
          )}
          <button onClick={handleDownload}
            className="bg-white border border-gray-200 hover:bg-gray-50 px-3 py-2 rounded-xl font-bold text-gray-500 shadow-sm transition-all active:scale-95 text-sm">
            Download CSV
          </button>
        </div>
      </Card>

      {status && (
        <Card title="Status">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Status</p>
              <p className={`font-bold ${isRunning ? 'text-green-500' : 'text-gray-500'}`}>
                {isRunning ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Events</p>
              <p className="text-2xl font-bold text-gray-900">{status.events ?? 0}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Elapsed</p>
              <p className="font-mono text-gray-600">{formatDuration(status.elapsed_secs)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Duration</p>
              <p className="font-mono text-gray-600">{formatDuration(status.duration_secs)}</p>
            </div>
          </div>
          {isRunning && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-slds-blue transition-all duration-500"
                  style={{ width: `${Math.min(100, (status.elapsed_secs / status.duration_secs) * 100)}%` }} />
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

// ── AT Console ───────────────────────────────────────────────────────────────

function AtConsoleTab() {
  const [command, setCommand] = useState('')
  const [timeout, setTimeout_] = useState(2)
  const [history, setHistory] = useState<{ cmd: string; response: string; error?: boolean }[]>([])
  const [loading, setLoading] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  async function handleSend() {
    if (!command.trim() || loading) return
    const cmd = command.trim()
    setCommand('')
    setLoading(true)
    try {
      const data = await api.atSend(cmd, timeout)
      setHistory(h => [...h, { cmd, response: data.response }])
    } catch (e) {
      setHistory(h => [...h, { cmd, response: (e as Error).message, error: true }])
    }
    setLoading(false)
    setTimeout(() => outputRef.current?.scrollTo(0, outputRef.current.scrollHeight), 50)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-4">
      <Card title="AT Command Console">
        <p className="text-xs text-gray-500 mb-4">
          Send AT commands directly to the modem. Response timeout is configurable per command.
        </p>

        <div ref={outputRef}
          className="mb-4 h-80 overflow-y-auto rounded-2xl border border-gray-200/60 bg-gray-50 p-3 font-mono text-xs">
          {history.length === 0 && (
            <p className="text-gray-500">No commands sent yet. Try: AT, ATI, AT+COPS?, AT+CSQ, AT+CGDCONT?</p>
          )}
          {history.map((h, i) => (
            <div key={i} className="mb-2">
              <p className="text-slds-blue">{'> '}{h.cmd}</p>
              <p className={`whitespace-pre-wrap ${h.error ? 'text-red-500' : 'text-green-500'}`}>{h.response}</p>
            </div>
          ))}
          {loading && <p className="text-gray-500 animate-pulse">Waiting for response...</p>}
        </div>

        <div className="flex gap-2">
          <input
            type="text" value={command} onChange={e => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AT+COPS?"
            className="flex-1 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-sm transition-all font-mono placeholder-gray-500"
            autoComplete="off"
          />
          <select value={timeout} onChange={e => setTimeout_(Number(e.target.value))}
            className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none text-xs transition-all">
            <option value={2}>2s</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
          </select>
          <button onClick={handleSend} disabled={loading || !command.trim()}
            className="bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-macos-lg shadow-slds-blue/20 hover:bg-slds-blue active:scale-[0.98] disabled:opacity-40 transition-all px-4 text-sm">
            Send
          </button>
        </div>
      </Card>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdvancedPage() {
  const [tab, setTab] = useState<Tab>('signal-logger')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'signal-logger', label: 'Signal Logger' },
    { id: 'connection-events', label: 'Connection Events' },
    { id: 'at-console', label: 'AT Console' },
  ]

  return (
    <div className="space-y-5">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Advanced</h1>

      <div className="bg-gray-50/50 rounded-2xl p-1 flex gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all duration-200 ${
              tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-600'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'signal-logger' && <SignalLoggerTab />}
      {tab === 'connection-events' && <ConnectionEventsTab />}
      {tab === 'at-console' && <AtConsoleTab />}
    </div>
  )
}

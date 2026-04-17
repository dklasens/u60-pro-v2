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
        <p className="text-xs text-text-muted mb-4">
          Continuously logs signal metrics (RSRP, RSRQ, SINR, RSSI, bands, CA) to CSV. Maximum 24 hours.
        </p>

        {!isRunning && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="w-full rounded-pill border border-divider bg-white/40 px-3 py-2 text-sm text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                {DURATION_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Interval</label>
              <select value={interval} onChange={e => setInterval_(Number(e.target.value))}
                className="w-full rounded-pill border border-divider bg-white/40 px-3 py-2 text-sm text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                {INTERVAL_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <button onClick={handleStart} disabled={loading}
              className="rounded-pill bg-green-500/10 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-500/20 transition-all duration-200 disabled:opacity-40">
              {loading ? 'Starting...' : 'Start Logging'}
            </button>
          ) : (
            <button onClick={handleStop}
              className="rounded-pill bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200">
              Stop Logging
            </button>
          )}
          <button onClick={handleDownload}
            className="rounded-pill bg-white/30 backdrop-blur-sm px-4 py-2 text-sm font-medium text-text-secondary hover:bg-white/50 transition-all duration-200">
            Download CSV
          </button>
        </div>
      </Card>

      {status && (
        <Card title="Status">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Status</p>
              <p className={`font-bold ${isRunning ? 'text-green-500' : 'text-text-muted'}`}>
                {isRunning ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Samples</p>
              <p className="text-2xl font-bold text-text-primary">{status.samples ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Elapsed</p>
              <p className="font-mono text-text-secondary">{formatDuration(status.elapsed_secs)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Duration</p>
              <p className="font-mono text-text-secondary">{formatDuration(status.duration_secs)}</p>
            </div>
          </div>
          {isRunning && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-white/30 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
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
        <p className="text-xs text-text-muted mb-4">
          Monitors connection state and logs events: cell handovers, band changes, NR connect/disconnect, PCI changes. Maximum 24 hours.
        </p>

        {!isRunning && (
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs text-text-muted mb-1">Duration</label>
              <select value={duration} onChange={e => setDuration(Number(e.target.value))}
                className="w-full rounded-pill border border-divider bg-white/40 px-3 py-2 text-sm text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                {DURATION_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-muted mb-1">Poll Interval</label>
              <select value={interval} onChange={e => setInterval_(Number(e.target.value))}
                className="w-full rounded-pill border border-divider bg-white/40 px-3 py-2 text-sm text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
                {INTERVAL_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <button onClick={handleStart} disabled={loading}
              className="rounded-pill bg-green-500/10 px-4 py-2 text-sm font-medium text-green-600 hover:bg-green-500/20 transition-all duration-200 disabled:opacity-40">
              {loading ? 'Starting...' : 'Start Monitoring'}
            </button>
          ) : (
            <button onClick={handleStop}
              className="rounded-pill bg-red-500/10 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200">
              Stop Monitoring
            </button>
          )}
          <button onClick={handleDownload}
            className="rounded-pill bg-white/30 backdrop-blur-sm px-4 py-2 text-sm font-medium text-text-secondary hover:bg-white/50 transition-all duration-200">
            Download CSV
          </button>
        </div>
      </Card>

      {status && (
        <Card title="Status">
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Status</p>
              <p className={`font-bold ${isRunning ? 'text-green-500' : 'text-text-muted'}`}>
                {isRunning ? 'Running' : 'Stopped'}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Events</p>
              <p className="text-2xl font-bold text-text-primary">{status.events ?? 0}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Elapsed</p>
              <p className="font-mono text-text-secondary">{formatDuration(status.elapsed_secs)}</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-text-muted uppercase tracking-wide">Duration</p>
              <p className="font-mono text-text-secondary">{formatDuration(status.duration_secs)}</p>
            </div>
          </div>
          {isRunning && (
            <div className="mt-3">
              <div className="h-2 rounded-full bg-white/30 overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
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
        <p className="text-xs text-text-muted mb-4">
          Send AT commands directly to the modem. Response timeout is configurable per command.
        </p>

        <div ref={outputRef}
          className="mb-4 h-80 overflow-y-auto rounded-glass border border-divider bg-white/10 backdrop-blur-sm p-3 font-mono text-xs">
          {history.length === 0 && (
            <p className="text-text-muted">No commands sent yet. Try: AT, ATI, AT+COPS?, AT+CSQ, AT+CGDCONT?</p>
          )}
          {history.map((h, i) => (
            <div key={i} className="mb-2">
              <p className="text-primary">{'> '}{h.cmd}</p>
              <p className={`whitespace-pre-wrap ${h.error ? 'text-red-500' : 'text-green-500'}`}>{h.response}</p>
            </div>
          ))}
          {loading && <p className="text-text-muted animate-pulse">Waiting for response...</p>}
        </div>

        <div className="flex gap-2">
          <input
            type="text" value={command} onChange={e => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AT+COPS?"
            className="flex-1 rounded-pill border border-divider bg-white/40 px-3 py-2 font-mono text-sm text-text-primary placeholder-text-muted backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            autoComplete="off"
          />
          <select value={timeout} onChange={e => setTimeout_(Number(e.target.value))}
            className="rounded-pill border border-divider bg-white/40 px-2 py-2 text-xs text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20">
            <option value={2}>2s</option>
            <option value={5}>5s</option>
            <option value={10}>10s</option>
            <option value={30}>30s</option>
          </select>
          <button onClick={handleSend} disabled={loading || !command.trim()}
            className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-all duration-200 disabled:opacity-40">
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
      <h1 className="text-lg font-semibold text-text-primary">Advanced</h1>

      <div className="glass-subtle !rounded-glass p-1 flex gap-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`rounded-pill px-4 py-2 text-sm font-medium transition-all duration-200 ${
              tab === t.id ? 'bg-white/60 text-text-primary' : 'text-text-muted hover:text-text-secondary'
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

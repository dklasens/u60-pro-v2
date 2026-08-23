import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'

type InstallMode = 'unlock' | 'adb' | 'ssh'
type Operation = 'install' | 'repair' | 'update'
type StepStatus = 'waiting' | 'running' | 'complete' | 'failed' | 'skipped'

interface AdbDevice {
  serial: string
  status: string
  manufacturer: string
  model: string
  product: string
  compatible: boolean
  displayName: string
}

interface DetectionResult {
  detectionId: string
  gateway: string
  adbPath: string | null
  adbDevices: AdbDevice[]
  selectedAdbSerial: string | null
  selectionRequired: boolean
  mode: InstallMode | null
  operation: Operation | null
  services: { web: boolean; agent: boolean; ssh: boolean; adb: boolean }
  connectionSummary: string
  planSummary: string
  ready: boolean
  problems: string[]
}

interface ProgressEvent {
  kind: 'log' | 'operation' | 'step'
  message: string
  step: string | null
  status: StepStatus | null
}

interface InstallOutcome {
  result: 'success' | 'dryRun'
  title: string
  message: string
  operation: Operation
  dashboardUrl: string | null
  apiUrl: string | null
  sshAddress: string | null
  diagnosticPath: string | null
}

interface InstallerError {
  summary: string
  guidance: string
  details: string
  diagnosticPath: string | null
}

const initialSteps: Record<string, StepStatus> = {
  unlock: 'waiting',
  wait: 'waiting',
  agent: 'waiting',
  ssh: 'waiting',
  dashboard: 'waiting',
  reboot: 'waiting',
}

const stepLabels: Record<string, string> = {
  unlock: 'Unlock',
  wait: 'Reconnect',
  agent: 'Agent',
  ssh: 'Secure access',
  dashboard: 'Dashboard',
  reboot: 'Reboot',
}

function Icon({ name, size = 20 }: { name: 'router' | 'check' | 'warning' | 'copy' | 'eye' | 'lock' | 'refresh' | 'terminal' | 'close'; size?: number }) {
  const paths = {
    router: <><rect x="3" y="9" width="18" height="9" rx="3"/><path d="M8 9V6m8 3V6M7 14h.01M11 14h.01M15 14h2"/></>,
    check: <path d="m5 12 4 4L19 6" />,
    warning: <><path d="M12 3 2.8 20h18.4L12 3Z"/><path d="M12 9v5m0 3h.01"/></>,
    copy: <><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    refresh: <><path d="M20 7v5h-5"/><path d="M18.2 16a8 8 0 1 1 .7-8.7L20 12"/></>,
    terminal: <><path d="m5 7 4 4-4 4m6 1h7"/><rect x="2.5" y="3" width="19" height="18" rx="3"/></>,
    close: <path d="m6 6 12 12M18 6 6 18" />,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>
}

function normaliseError(value: unknown): InstallerError {
  if (value && typeof value === 'object' && 'summary' in value) return value as InstallerError
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && 'summary' in parsed) return parsed as InstallerError
    } catch {
      // Tauri may return a plain error string.
    }
    return { summary: 'The operation could not be completed', guidance: 'Copy the log and try detection again.', details: value, diagnosticPath: null }
  }
  return { summary: 'The operation could not be completed', guidance: 'Copy the log and try detection again.', details: String(value), diagnosticPath: null }
}

async function copyText(value: string) {
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const input = document.createElement('textarea')
    input.value = value
    input.style.position = 'fixed'
    input.style.opacity = '0'
    document.body.appendChild(input)
    input.select()
    document.execCommand('copy')
    input.remove()
  }
}

function App() {
  const [gateway, setGateway] = useState('192.168.0.1')
  const [routerPassword, setRouterPassword] = useState('')
  const [backupSuffix, setBackupSuffix] = useState('')
  const [agentPassword, setAgentPassword] = useState('')
  const [agentPasswordConfirmation, setAgentPasswordConfirmation] = useState('')
  const [agentPin, setAgentPin] = useState('')
  const [showCredentials, setShowCredentials] = useState(false)
  const [dryRun, setDryRun] = useState(false)
  const [rebootAfter, setRebootAfter] = useState(true)
  const [diagnosticMode, setDiagnosticMode] = useState(false)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [running, setRunning] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [activeOperation, setActiveOperation] = useState('Ready to inspect the modem')
  const [steps, setSteps] = useState<Record<string, StepStatus>>(initialSteps)
  const [logs, setLogs] = useState<string[]>([])
  const [confirming, setConfirming] = useState(false)
  const [outcome, setOutcome] = useState<InstallOutcome | null>(null)
  const [error, setError] = useState<InstallerError | null>(null)
  const [copied, setCopied] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)
  const initialised = useRef(false)
  const detectionGeneration = useRef(0)

  useEffect(() => {
    let dispose: (() => void) | undefined
    listen<ProgressEvent>('installer-progress', ({ payload }) => {
      if (payload.kind === 'log') setLogs((current) => [...current, payload.message])
      if (payload.kind === 'operation') setActiveOperation(payload.message)
      if (payload.step && payload.status) {
        setSteps((current) => ({ ...current, [payload.step!]: payload.status! }))
        if (payload.message) setActiveOperation(payload.message)
      }
    }).then((unlisten) => { dispose = unlisten })
    return () => dispose?.()
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logs])

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    void detectDevice()
  }, [])

  const compatibleDevices = detection?.adbDevices.filter((device) => device.compatible) ?? []
  const isLocked = detection?.mode === 'unlock'
  const isAdb = detection?.mode === 'adb'
  const operationLabel = detection?.operation ? `${detection.operation[0].toUpperCase()}${detection.operation.slice(1)}` : 'Continue'
  const credentialsMatch = agentPassword === agentPasswordConfirmation
  const pinValid = !agentPin || /^\d{6}$/.test(agentPin)
  const formValid = Boolean(
    detection?.ready
    && agentPassword
    && credentialsMatch
    && pinValid
    && (!isLocked || (routerPassword && backupSuffix)),
  )
  const visibleSteps = useMemo(
    () => Object.keys(stepLabels).filter((step) => step !== 'reboot' || isAdb),
    [isAdb],
  )
  const logText = logs.join('\n')

  async function detectDevice(adbSerial?: string) {
    if (running) return
    const generation = ++detectionGeneration.current
    setDetecting(true)
    setDetection(null)
    setError(null)
    setActiveOperation('Inspecting network services and connected USB devices…')
    try {
      const result = await invoke<DetectionResult>('detect_device', {
        request: { gateway: gateway.trim() || '192.168.0.1', adbSerial: adbSerial ?? null },
      })
      if (generation !== detectionGeneration.current) return
      setDetection(result)
      setActiveOperation(result.ready ? 'Detection complete — review the plan below' : 'Detection needs attention')
    } catch (reason) {
      if (generation !== detectionGeneration.current) return
      setError(normaliseError(reason))
      setActiveOperation('Detection could not be completed')
    } finally {
      if (generation === detectionGeneration.current) setDetecting(false)
    }
  }

  function changeGateway(value: string) {
    detectionGeneration.current += 1
    setGateway(value)
    setDetection(null)
    setActiveOperation('Device address changed — detect again to create a new plan')
    void invoke('invalidate_detection').catch(() => undefined)
  }

  function validateBeforeRun() {
    if (!agentPassword) return 'Choose an agent password.'
    if (!credentialsMatch) return 'The agent password confirmation does not match.'
    if (!pinValid) return 'The optional agent PIN must be exactly six digits.'
    if (isLocked && (!routerPassword || !backupSuffix)) return 'Enter the router admin password and backup-key suffix.'
    return null
  }

  function requestRun() {
    const issue = validateBeforeRun()
    if (issue) {
      setError({ summary: 'Check the highlighted details', guidance: issue, details: issue, diagnosticPath: null })
      return
    }
    if (isLocked && !dryRun) {
      setConfirming(true)
      return
    }
    void executeRun()
  }

  async function executeRun() {
    if (!detection || !detection.mode || !detection.operation) return
    // This immutable request is the only UI state the Rust worker receives.
    const request = {
      detectionId: detection.detectionId,
      gateway: gateway.trim(),
      adbSerial: detection.selectedAdbSerial,
      routerPassword,
      backupSuffix,
      agentPassword,
      agentPasswordConfirmation,
      agentPin,
      dryRun: isLocked ? dryRun : false,
      rebootAfter: isAdb ? rebootAfter : false,
      diagnosticMode,
    }
    setConfirming(false)
    setOutcome(null)
    setError(null)
    setLogs([])
    setSteps(initialSteps)
    setRunning(true)
    setShowLog(true)
    setActiveOperation(`Starting ${operationLabel.toLowerCase()}…`)
    try {
      const result = await invoke<InstallOutcome>('run_install', { request })
      setOutcome(result)
      setActiveOperation(result.result === 'dryRun' ? 'Dry run completed — no device changes' : `${operationLabel} completed successfully`)
    } catch (reason) {
      const failure = normaliseError(reason)
      setError(failure)
      setActiveOperation(failure.summary)
      setSteps((current) => {
        const active = Object.entries(current).find(([, status]) => status === 'running')?.[0]
        return active ? { ...current, [active]: 'failed' } : current
      })
    } finally {
      setRunning(false)
      setDetection(null)
    }
  }

  const connectionDetails = outcome
    ? [
        outcome.dashboardUrl && `Dashboard: ${outcome.dashboardUrl}`,
        outcome.apiUrl && `Agent API: ${outcome.apiUrl}`,
        outcome.sshAddress && `SSH: ${outcome.sshAddress}`,
      ].filter(Boolean).join('\n')
    : ''

  async function copyWithFeedback(value: string) {
    await copyText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand-mark"><Icon name="router" size={22} /></div>
        <div>
          <h1>Open U60 Pro Installer</h1>
          <p className="subtitle">Install, repair, or update your MU5250 without the command line.</p>
        </div>
      </header>

      <div className="content-grid">
        <section className="panel device-panel">
          <div className="section-heading">
            <h2>Connection</h2>
            <button className="secondary-button" onClick={() => void detectDevice()} disabled={detecting || running}>
              <Icon name="refresh" size={15} /> Detect
            </button>
          </div>
          <label className="field">
            <span>Device address</span>
            <input value={gateway} onChange={(event) => changeGateway(event.target.value)} disabled={running} placeholder="192.168.0.1" spellCheck={false} />
          </label>

          {compatibleDevices.length > 1 && (
            <label className="field">
              <span>Connected modem</span>
              <select
                value={detection?.selectedAdbSerial ?? ''}
                onChange={(event) => void detectDevice(event.target.value || undefined)}
                disabled={running || detecting}
              >
                <option value="">Choose a modem…</option>
                {compatibleDevices.map((device) => <option key={device.serial} value={device.serial}>{device.displayName}</option>)}
              </select>
            </label>
          )}

          {detection ? (
            <div className={`device-summary ${detection.ready ? 'ready' : 'attention'}`}>
              <div className="summary-icon"><Icon name={detection.ready ? 'check' : 'warning'} /></div>
              <div>
                <span className="summary-label">Detected connection</span>
                <strong>{detection.connectionSummary}</strong>
                <p>{detection.planSummary}</p>
              </div>
            </div>
          ) : !detecting && (
            <div className="empty-state"><Icon name="router" /><span>Detect the modem after changing its address or USB connection.</span></div>
          )}

          {detection && (
            <>
              <div className="service-row" aria-label="Detected services">
                {Object.entries(detection.services).map(([name, up]) => (
                  <span className={`service-chip ${up ? 'up' : ''}`} key={name}><i />{name.toUpperCase()}</span>
                ))}
              </div>
              {detection.problems.length > 0 && (
                <div className="problem-list">
                  {detection.problems.map((problem) => <p key={problem}><Icon name="warning" size={16} />{problem}</p>)}
                </div>
              )}
            </>
          )}
        </section>

        <section className="panel setup-panel">
          <div className="section-heading">
            <h2>{detection?.operation ? `${operationLabel} options` : 'Setup'}</h2>
            <button className="text-button" type="button" onClick={() => setShowCredentials((value) => !value)}>
              <Icon name="eye" size={15} /> {showCredentials ? 'Hide' : 'Show'} credentials
            </button>
          </div>

          {isLocked && (
            <div className="mode-fields">
              <label className="field">
                <span>Router admin password</span>
                <input type={showCredentials ? 'text' : 'password'} value={routerPassword} onChange={(event) => setRouterPassword(event.target.value)} disabled={running} autoComplete="off" />
              </label>
              <label className="field">
                <span>Backup-key suffix</span>
                <input type={showCredentials ? 'text' : 'password'} value={backupSuffix} onChange={(event) => setBackupSuffix(event.target.value)} disabled={running} autoComplete="off" />
                <small>Used only to decrypt and rebuild this modem’s backup.</small>
              </label>
            </div>
          )}

          <div className="two-column-fields">
            <label className={`field ${agentPasswordConfirmation && !credentialsMatch ? 'invalid' : ''}`}>
              <span>Agent password</span>
              <input type={showCredentials ? 'text' : 'password'} value={agentPassword} onChange={(event) => setAgentPassword(event.target.value)} disabled={running} autoComplete="new-password" />
            </label>
            <label className={`field ${agentPasswordConfirmation && !credentialsMatch ? 'invalid' : ''}`}>
              <span>Confirm agent password</span>
              <input type={showCredentials ? 'text' : 'password'} value={agentPasswordConfirmation} onChange={(event) => setAgentPasswordConfirmation(event.target.value)} disabled={running} autoComplete="new-password" />
              {agentPasswordConfirmation && !credentialsMatch && <small>Passwords do not match.</small>}
            </label>
          </div>
          <label className={`field pin-field ${!pinValid ? 'invalid' : ''}`}>
            <span>Agent PIN <em>optional</em></span>
            <input type={showCredentials ? 'text' : 'password'} inputMode="numeric" maxLength={6} value={agentPin} onChange={(event) => setAgentPin(event.target.value)} disabled={running} placeholder="6 digits" />
            {!pinValid && <small>Use exactly six digits.</small>}
          </label>

          <div className="option-list">
            {isLocked && (
              <label className="check-option">
                <input type="checkbox" checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} disabled={running} />
                <span><strong>Unlock dry run</strong><small>Prepare and verify the backup without uploading it.</small></span>
              </label>
            )}
            {isAdb && (
              <label className="check-option">
                <input type="checkbox" checked={rebootAfter} onChange={(event) => setRebootAfter(event.target.checked)} disabled={running} />
                <span><strong>Reboot when finished</strong><small>Restores normal USB tethering after the ADB installation.</small></span>
              </label>
            )}
            <details className="advanced-options">
              <summary>Diagnostics</summary>
              <label className="check-option">
                <input type="checkbox" checked={diagnosticMode} onChange={(event) => setDiagnosticMode(event.target.checked)} disabled={running} />
                <span><strong>Keep temporary files</strong><small>Retains downloads and decrypted backup data for troubleshooting. These files may contain sensitive configuration.</small></span>
              </label>
            </details>
          </div>

          <button className="primary-button" disabled={!formValid || detecting || running} onClick={requestRun}>
            {running ? 'Working…' : `${operationLabel}${isLocked && dryRun ? ' dry run' : ''}`}
          </button>
          {!detection?.ready && <p className="button-help">Detect a ready modem to continue.</p>}
        </section>
      </div>

      <section className={`panel progress-panel ${running || detecting ? 'active' : ''}`}>
        {(running || detecting) && <div className="progress-track" aria-hidden="true"><span /></div>}
        <ol className="steps">
          {visibleSteps.map((step) => (
            <li className={steps[step]} key={step}>
              <span className="step-marker">{steps[step] === 'complete' ? <Icon name="check" size={13} /> : steps[step] === 'failed' ? '!' : steps[step] === 'skipped' ? '–' : ''}</span>
              <span>{stepLabels[step]}</span>
            </li>
          ))}
        </ol>
        <div className="progress-footer">
          <div className="progress-status" aria-live="polite">
            {(running || detecting) && <span className="spinner" aria-hidden="true" />}
            <span>{activeOperation}</span>
          </div>
          <button className="text-button" type="button" onClick={() => setShowLog((value) => !value)}>
            <Icon name="terminal" size={14} /> {showLog ? 'Hide log' : 'View log'}
          </button>
        </div>
        {showLog && (
          <div className="log-wrap">
            <pre className="log" ref={logRef}>{logs.length ? logText : 'Detailed progress and diagnostic messages will appear here.'}</pre>
            <button className="text-button copy-log" disabled={!logs.length} onClick={() => void copyWithFeedback(logText)}>
              <Icon name="copy" size={13} /> {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </section>

      <footer><Icon name="lock" size={13} /> Credentials stay on this computer and are sent only to the modem.</footer>

      {confirming && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="modal-icon warning"><Icon name="warning" size={28} /></div>
            <h2 id="confirm-title">Ready to unlock and reboot?</h2>
            <p>The installer will upload the verified patched backup and ask the modem to restore it. The modem will be offline for roughly 60–90 seconds.</p>
            <div className="safety-note"><strong>Safety check complete</strong><span>The restore cannot be interrupted from this app once it begins.</span></div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => setConfirming(false)}>Go back</button>
              <button className="primary-button" onClick={() => void executeRun()}>Unlock and continue</button>
            </div>
          </section>
        </div>
      )}

      {outcome && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal result-modal" role="dialog" aria-modal="true" aria-labelledby="result-title">
            <button className="modal-close" aria-label="Close" onClick={() => setOutcome(null)}><Icon name="close" /></button>
            <div className={`modal-icon ${outcome.result === 'success' ? 'success' : 'dry'}`}><Icon name="check" size={30} /></div>
            <p className="section-kicker">{outcome.result === 'dryRun' ? 'SAFE PREVIEW' : 'ALL DONE'}</p>
            <h2 id="result-title">{outcome.title}</h2>
            <p>{outcome.message}</p>
            {outcome.result === 'success' && (
              <div className="connection-details">
                <div><span>Dashboard</span><code>{outcome.dashboardUrl}</code></div>
                <div><span>Agent API</span><code>{outcome.apiUrl}</code></div>
                <div><span>SSH</span><code>{outcome.sshAddress}</code></div>
              </div>
            )}
            {outcome.diagnosticPath && <p className="diagnostic-path">Diagnostic files retained at <code>{outcome.diagnosticPath}</code></p>}
            <div className="modal-actions">
              {outcome.result === 'success' && <button className="secondary-button" onClick={() => void copyWithFeedback(connectionDetails)}><Icon name="copy" size={17} /> {copied ? 'Copied' : 'Copy connection details'}</button>}
              <button className="primary-button" onClick={() => setOutcome(null)}>Done</button>
            </div>
          </section>
        </div>
      )}

      {error && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal error-modal" role="alertdialog" aria-modal="true" aria-labelledby="error-title">
            <button className="modal-close" aria-label="Close" onClick={() => setError(null)}><Icon name="close" /></button>
            <div className="modal-icon error"><Icon name="warning" size={28} /></div>
            <p className="section-kicker">NEEDS ATTENTION</p>
            <h2 id="error-title">{error.summary}</h2>
            <p>{error.guidance}</p>
            {error.diagnosticPath && <p className="diagnostic-path">Diagnostic files retained at <code>{error.diagnosticPath}</code></p>}
            <details className="technical-details">
              <summary>Technical details</summary>
              <pre>{error.details}</pre>
            </details>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => void copyWithFeedback(`${logText}\n\n${error.details}`.trim())}><Icon name="copy" size={17} /> {copied ? 'Copied' : 'Copy log'}</button>
              <button className="primary-button" onClick={() => setError(null)}>Close</button>
            </div>
          </section>
        </div>
      )}
    </main>
  )
}

export default App

import { useEffect, useMemo, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { open } from '@tauri-apps/plugin-dialog'
import { useModalFocus } from './useModalFocus'

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
  recovery: { id: string; incomplete: boolean } | null
}

interface ProgressEvent {
  kind: 'log' | 'operation' | 'step' | 'confirm' | 'critical'
  message: string
  step: string | null
  status: StepStatus | null
}

interface InstallOutcome {
  result: 'success' | 'dryRun'
  deviceModel: string
  firmware: string
  release: string
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
  prepare: 'waiting',
  unlock: 'waiting',
  wait: 'waiting',
  agent: 'waiting',
  ssh: 'waiting',
  dashboard: 'waiting',
  reboot: 'waiting',
}

const stepLabels: Record<string, string> = {
  prepare: 'Verify files',
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
  const [passwordAction, setPasswordAction] = useState<'keep' | 'replace'>('replace')
  const [pinAction, setPinAction] = useState<'keep' | 'set' | 'remove'>('remove')
  const [checkedSettings, setCheckedSettings] = useState('')
  const [preview, setPreview] = useState<InstallOutcome | null>(null)
  const [critical, setCritical] = useState(false)
  const [closeNotice, setCloseNotice] = useState(false)
  const [bundlePath, setBundlePath] = useState('')
  const [rebootAfter, setRebootAfter] = useState(true)
  const [diagnosticMode, setDiagnosticMode] = useState(false)
  const [detection, setDetection] = useState<DetectionResult | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [running, setRunning] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [activeOperation, setActiveOperation] = useState('Ready to inspect the modem')
  const [steps, setSteps] = useState<Record<string, StepStatus>>(initialSteps)
  const [logs, setLogs] = useState<string[]>([])
  const [confirmRecovery, setConfirmRecovery] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [outcome, setOutcome] = useState<InstallOutcome | null>(null)
  const [error, setError] = useState<InstallerError | null>(null)
  const [copied, setCopied] = useState(false)
  const logRef = useRef<HTMLPreElement>(null)
  const initialised = useRef(false)
  const detectionGeneration = useRef(0)

  useEffect(() => {
    let disposed = false
    const disposers: (() => void)[] = []
    const register = async () => {
      const offProgress = await listen<ProgressEvent>('installer-progress', ({ payload }) => {
        if (payload.kind === 'log') setLogs((current) => [...current.slice(-1999), payload.message])
        if (payload.kind === 'operation') setActiveOperation(payload.message)
        if (payload.kind === 'confirm') setConfirming(true)
        if (payload.kind === 'critical') setCritical(true)
        if (payload.step && payload.status) {
          setSteps((current) => ({ ...current, [payload.step!]: payload.status! }))
          if (payload.message) setActiveOperation(payload.message)
        }
      })
      if (disposed) offProgress(); else disposers.push(offProgress)
      const offClose = await listen('installer-close-blocked', () => setCloseNotice(true))
      if (disposed) offClose(); else disposers.push(offClose)
    }
    void register()
    return () => { disposed = true; disposers.forEach((dispose) => dispose()) }
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [logs])

  useEffect(() => {
    if (initialised.current) return
    initialised.current = true
    const generation = detectionGeneration.current
    void invoke<boolean>('startup_mode').then((diagnostic) => {
      if (generation !== detectionGeneration.current) return
      if (diagnostic) return invoke('finish_startup_check', { frontendReady: Boolean(document.querySelector('.app-shell h1')) })
      return detectDevice()
    }).catch((reason) => setError(normaliseError(reason)))
  }, [])

  const compatibleDevices = detection?.adbDevices.filter((device) => device.compatible) ?? []
  const isLocked = detection?.mode === 'unlock'
  const isAdb = detection?.mode === 'adb'
  const canRebootAfter = isAdb || isLocked
  const operationLabel = detection?.operation ? `${detection.operation[0].toUpperCase()}${detection.operation.slice(1)}` : 'Continue'
  const credentialsMatch = passwordAction === 'keep' || agentPassword === agentPasswordConfirmation
  const pinValid = pinAction !== 'set' || /^\d{6}$/.test(agentPin)
  const formValid = Boolean(
    detection?.ready
    && (passwordAction === 'keep' || agentPassword)
    && credentialsMatch
    && pinValid
    && (!isLocked || (routerPassword && backupSuffix)),
  )
  const visibleSteps = useMemo(
    () => Object.keys(stepLabels).filter((step) => step !== 'reboot' || canRebootAfter),
    [canRebootAfter],
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
      setCheckedSettings('')
      setPreview(null)
      setPasswordAction(result.operation === 'install' ? 'replace' : 'keep')
      setPinAction(result.operation === 'install' ? 'remove' : 'keep')
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
    setDetecting(false)
    setCheckedSettings('')
    setPreview(null)
    setGateway(value)
    setDetection(null)
    setActiveOperation('Device address changed — detect again to create a new plan')
    void invoke('invalidate_detection').catch(() => undefined)
  }

  function validateBeforeRun() {
    if (passwordAction === 'replace' && !agentPassword) return 'Choose a dashboard password.'
    if (!credentialsMatch) return 'The agent password confirmation does not match.'
    if (!pinValid) return 'The optional agent PIN must be exactly six digits.'
    if (isLocked && (!routerPassword || !backupSuffix)) return 'Enter the router admin password and backup-key suffix.'
    return null
  }

  function settingsKey() {
    return JSON.stringify([detection?.detectionId, gateway.trim(), passwordAction, pinAction, routerPassword, backupSuffix, agentPassword, agentPasswordConfirmation, agentPin, rebootAfter, diagnosticMode, bundlePath.trim()])
  }
  const checked = Boolean(preview && checkedSettings === settingsKey())

  async function confirmUnlock(accepted: boolean) {
    try {
      await invoke('confirm_unlock', { accepted })
      setConfirming(false)
      if (accepted) setCritical(true)
    } catch (reason) { setError(normaliseError(reason)) }
  }

  useModalFocus(Boolean(confirmRecovery || confirming || outcome || error), () => {
    if (confirmRecovery) setConfirmRecovery(false)
    else if (confirming) void confirmUnlock(false)
    else if (error) setError(null)
    else setOutcome(null)
  })

  async function recoverDevice() {
    if (!detection?.recovery) return
    setConfirmRecovery(false); setRunning(true); setCritical(true)
    setActiveOperation('Restoring the previous installation…')
    try {
      await invoke('recover_device', { detectionId: detection.detectionId, transactionId: detection.recovery.id })
      setActiveOperation('Recovery completed. Detect the modem again to continue.')
      setDetection(null); setCheckedSettings(''); setPreview(null)
    } catch (reason) { setError(normaliseError(reason)) }
    finally { setRunning(false); setCritical(false) }
  }

  async function executeRun(dryRun: boolean) {
    if (!detection || !detection.mode || !detection.operation || running) return
    const issue = validateBeforeRun()
    if (issue) { setError({ summary: 'Check your settings', guidance: issue, details: '', diagnosticPath: null }); return }
    const key = settingsKey()
    const request = {
      detectionId: detection.detectionId,
      gateway: gateway.trim(),
      adbSerial: detection.selectedAdbSerial,
      routerPassword, backupSuffix, agentPassword, agentPasswordConfirmation, agentPin,
      passwordAction, pinAction, dryRun,
      rebootAfter: canRebootAfter ? rebootAfter : false,
      diagnosticMode,
      bundlePath: bundlePath.trim() || null,
    }
    setConfirming(false)
    setOutcome(null)
    setError(null)
    setLogs([])
    setSteps(initialSteps)
    setRunning(true)
    setCheckedSettings('')
    setShowLog(false)
    setCritical(false)
    setCloseNotice(false)
    setActiveOperation(`Starting ${operationLabel.toLowerCase()}…`)
    try {
      const result = await invoke<InstallOutcome>('run_install', { request })
      if (dryRun) { setPreview(result); setCheckedSettings(key) }
      else { setOutcome(result); setCheckedSettings(''); setPreview(null) }
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
      setCritical(false)
      setConfirming(false)
      if (!dryRun) setDetection(null)
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
            <h2>1. Connect your modem</h2>
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

          {detection?.recovery && <div className="safety-note"><strong>An interrupted installation was found</strong><p>{detection.recovery.incomplete ? 'Snapshot preparation stopped before activation. Clear the incomplete preparation before checking again.' : 'Restore the saved installation before making further changes.'}</p><button className="secondary-button" disabled={running} onClick={() => setConfirmRecovery(true)}>{detection.recovery.incomplete ? 'Review incomplete preparation' : 'Restore previous installation'}</button></div>}
          {detection && (
            <details className="advanced-options"><summary>Connection details</summary>
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
            </details>
          )}
        </section>

        <section className="panel setup-panel">
          <div className="section-heading">
            <h2>2. Check your settings</h2>
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
                <input type={showCredentials ? 'text' : 'password'} aria-label="Backup-key suffix" value={backupSuffix} onChange={(event) => setBackupSuffix(event.target.value)} disabled={running} autoComplete="off" />
                <small>Used only for this modem’s backup. <button className="text-button" onClick={() => void invoke('open_help')}>Find the key in issue #8</button></small>
              </label>
            </div>
          )}

          {detection?.operation !== 'install' && <label className="field">
            <span>Dashboard password</span>
            <select aria-label="Password action" value={passwordAction} disabled={running} onChange={(event) => setPasswordAction(event.target.value as 'keep' | 'replace')}>
              <option value="keep">Keep existing password</option><option value="replace">Change password</option>
            </select>
          </label>}
          {passwordAction === 'replace' && <div className="two-column-fields">
            <label className="field"><span>Dashboard password</span><input type={showCredentials ? 'text' : 'password'} value={agentPassword} onChange={(event) => setAgentPassword(event.target.value)} disabled={running} autoComplete="new-password" /></label>
            <label className={`field ${!credentialsMatch ? 'invalid' : ''}`}><span>Confirm dashboard password</span><input type={showCredentials ? 'text' : 'password'} aria-label="Confirm dashboard password" value={agentPasswordConfirmation} onChange={(event) => setAgentPasswordConfirmation(event.target.value)} disabled={running} autoComplete="new-password" />{!credentialsMatch && <small>Passwords do not match.</small>}</label>
          </div>}
          <label className="field"><span>Dashboard PIN</span>
            <select aria-label="PIN action" value={pinAction} disabled={running} onChange={(event) => setPinAction(event.target.value as 'keep' | 'set' | 'remove')}>
              {detection?.operation !== 'install' && <option value="keep">Keep existing PIN setting</option>}
              <option value="remove">{detection?.operation === 'install' ? 'No PIN' : 'Remove PIN'}</option><option value="set">Set a six-digit PIN</option>
            </select>
          </label>
          {pinAction === 'set' && <label className={`field pin-field ${!pinValid ? 'invalid' : ''}`}><span>New PIN</span><input type={showCredentials ? 'text' : 'password'} inputMode="numeric" maxLength={6} value={agentPin} onChange={(event) => setAgentPin(event.target.value)} disabled={running} />{!pinValid && <small>Use exactly six digits.</small>}</label>}

          <div className="option-list">
            {canRebootAfter && (
              <label className="check-option">
                <input type="checkbox" checked={rebootAfter} onChange={(event) => setRebootAfter(event.target.checked)} disabled={running} />
                <span><strong>Reboot when finished</strong><small>Restores normal USB tethering after the ADB installation.</small></span>
              </label>
            )}
            <details className="advanced-options">
              <summary>Offline bundle and diagnostics</summary>
              <label className="field">
                <span>Offline bundle directory</span>
                <input value={bundlePath} onChange={(event) => setBundlePath(event.target.value)} disabled={running} placeholder="Use cached files or download" />
                <button className="secondary-button" disabled={running} onClick={async () => { const path = await open({ directory: true, multiple: false, title: 'Choose a verified offline bundle' }); if (typeof path === 'string') setBundlePath(path) }}>Browse…</button>
                <small>Verified downloads are reused automatically. Choose a folder to use a separate offline bundle.</small>
              </label>
              <label className="check-option">
                <input type="checkbox" checked={diagnosticMode} onChange={(event) => setDiagnosticMode(event.target.checked)} disabled={running} />
                <span><strong>Keep temporary files</strong><small>Retains downloads and decrypted backup data for troubleshooting. These files may contain sensitive configuration.</small></span>
              </label>
            </details>
          </div>

          {checked && preview && <div className="device-summary ready"><Icon name="check" /><div><strong>{preview.deviceModel}</strong><p>{preview.firmware}</p><p>Software {preview.release} · Ready to {operationLabel.toLowerCase()}</p></div></div>}
          <button className="primary-button" disabled={!formValid || detecting || running} onClick={() => void executeRun(!checked)}>
            {running ? 'Working…' : checked ? `3. ${operationLabel}` : 'Check device'}
          </button>
          <p className="button-help">Checks prepare and validate files without uploading an unlock backup or changing running settings.</p>
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

      {closeNotice && running && <p role="status" className="safety-note">Keep this window open while verification or recovery finishes.</p>}
      {running && !critical && <button className="secondary-button" onClick={() => void invoke('stop_operation')}>Stop after current check</button>}
      <footer><Icon name="lock" size={13} /> Credentials stay on this computer and are sent only to the modem.</footer>

      {confirmRecovery && <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="recovery-title"><h2 id="recovery-title">{detection?.recovery?.incomplete ? 'Clear incomplete preparation?' : 'Restore the previous installation?'}</h2><p>The installer will verify the same modem and recovery record before proceeding. Keep the modem connected until recovery finishes. Retained recovery snapshots will be kept.</p><div className="modal-actions"><button className="secondary-button" onClick={() => setConfirmRecovery(false)}>Go back</button><button className="primary-button" onClick={() => void recoverDevice()}>Recover and verify</button></div></section></div>}
      {confirming && (
        <div className="modal-backdrop" role="presentation">
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
            <div className="modal-icon warning"><Icon name="warning" size={28} /></div>
            <h2 id="confirm-title">Ready to unlock and reboot?</h2>
            <p>The installer will upload the verified patched backup and ask the modem to restore it. The modem will be offline for roughly 60–90 seconds.</p>
            <div className="safety-note"><strong>Safety check complete</strong><span>The restore cannot be interrupted from this app once it begins.</span></div>
            <div className="modal-actions">
              <button className="secondary-button" onClick={() => void confirmUnlock(false)}>Go back</button>
              <button className="primary-button" onClick={() => void confirmUnlock(true)}>Unlock and continue</button>
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
              {outcome.result === 'success' && <button className="primary-button" onClick={() => void invoke('open_dashboard')}>Open dashboard</button>}
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

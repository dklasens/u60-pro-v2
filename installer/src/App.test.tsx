import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'

const bridge = vi.hoisted(() => ({ invoke: vi.fn(), handlers: new Map<string, (event: { payload: unknown }) => void>() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke: bridge.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn(async () => '/sample/bundle') }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async (name, callback) => { bridge.handlers.set(name, callback); return () => bridge.handlers.delete(name) }) }))
const detected = (mode = 'ssh', operation = 'update') => ({ detectionId: 'sample-plan', gateway: '192.168.0.1', adbPath: null, adbDevices: [], selectedAdbSerial: null, selectionRequired: false, mode, operation, services: { web: true, agent: operation === 'update', ssh: mode === 'ssh', adb: mode === 'adb' }, connectionSummary: 'Sample MU5250', planSummary: 'Check before installing', ready: true, problems: [] })
const preview = { result: 'dryRun', title: 'Checks passed', message: 'Ready', operation: 'update', deviceModel: 'Sample MU5250', firmware: 'Sample firmware', release: 'v2.4', dashboardUrl: null, apiUrl: null, sshAddress: null, diagnosticPath: null }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>((r) => { resolve = r }); return { promise, resolve } }
async function ready() { await screen.findByText('Sample MU5250'); await waitFor(() => expect(bridge.handlers.has('installer-close-blocked')).toBe(true)) }
async function check() { fireEvent.click(screen.getByRole('button', { name: 'Check device' })); await screen.findByRole('button', { name: '3. Update' }) }
beforeEach(() => {
  bridge.handlers.clear(); bridge.invoke.mockReset()
  bridge.invoke.mockImplementation(async (command) => command === 'detect_device' ? detected() : command === 'run_install' ? preview : undefined)
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })
})
afterEach(cleanup)

describe('installer workflow', () => {
  it('lets the user detect again after editing an address during an obsolete request', async () => {
    const old = deferred<ReturnType<typeof detected>>()
    bridge.invoke.mockImplementation((command) => command === 'detect_device' ? old.promise : Promise.resolve())
    render(<App />)
    await waitFor(() => expect(bridge.invoke.mock.calls.some(([command]) => command === 'detect_device')).toBe(true))
    fireEvent.change(screen.getByLabelText('Device address'), { target: { value: '192.168.8.1' } })
    expect((screen.getByRole('button', { name: 'Detect' }) as HTMLButtonElement).disabled).toBe(false)
    await act(async () => old.resolve(detected()))
    expect(screen.queryByText('Sample MU5250')).toBeNull()
    expect((screen.getByRole('button', { name: 'Detect' }) as HTMLButtonElement).disabled).toBe(false)
  })
  it('preserves both credentials during an update and checks before installation', async () => {
    render(<App />); await ready()
    expect((screen.getByLabelText('Password action') as HTMLSelectElement).value).toBe('keep')
    expect((screen.getByLabelText('PIN action') as HTMLSelectElement).value).toBe('keep')
    await check()
    let call = bridge.invoke.mock.calls.find(([command]) => command === 'run_install')!
    expect(call[1].request).toMatchObject({ dryRun: true, passwordAction: 'keep', pinAction: 'keep', agentPassword: '', agentPin: '', rebootAfter: false })
    bridge.invoke.mockImplementation(async (command) => command === 'run_install' ? { ...preview, result: 'success', dashboardUrl: 'http://192.168.0.1:8080' } : undefined)
    fireEvent.click(screen.getByRole('button', { name: '3. Update' }))
    await screen.findByRole('button', { name: 'Open dashboard' })
    call = bridge.invoke.mock.calls.filter(([command]) => command === 'run_install').at(-1)!
    expect(call[1].request.dryRun).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Open dashboard' }))
    expect(bridge.invoke).toHaveBeenCalledWith('open_dashboard')
  })
  it('invalidates a successful check after PIN settings change', async () => {
    render(<App />); await ready(); await check()
    fireEvent.change(screen.getByLabelText('PIN action'), { target: { value: 'remove' } })
    expect(screen.queryByRole('button', { name: '3. Update' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Check device' })).toBeTruthy()
  })
  it('retains locked-device reboot intent and only confirms after the native preparation event', async () => {
    const install = deferred<typeof preview>()
    bridge.invoke.mockImplementation(async (command, args) => command === 'detect_device' ? detected('unlock', 'install') : command === 'run_install' ? (args.request.dryRun ? preview : install.promise) : undefined)
    render(<App />); await ready()
    for (const label of ['Router admin password', 'Backup-key suffix', 'Dashboard password', 'Confirm dashboard password']) fireEvent.change(screen.getByLabelText(label), { target: { value: 'sample-input' } })
    fireEvent.click(screen.getByRole('button', { name: 'Check device' }))
    await screen.findByRole('button', { name: '3. Install' })
    fireEvent.click(screen.getByRole('button', { name: '3. Install' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    const call = bridge.invoke.mock.calls.filter(([command]) => command === 'run_install').at(-1)!
    expect(call[1].request).toMatchObject({ rebootAfter: true, dryRun: false })
    await act(async () => bridge.handlers.get('installer-progress')!({ payload: { kind: 'confirm' } }))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }))
    await waitFor(() => expect(bridge.invoke).toHaveBeenCalledWith('confirm_unlock', { accepted: false }))
    await act(async () => install.resolve(preview))
  })
  it('contains keyboard focus in errors and restores it after Escape', async () => {
    const user = userEvent.setup()
    render(<App />); await ready()
    const button = screen.getByRole('button', { name: 'Check device' }); button.focus()
    bridge.invoke.mockRejectedValue({ summary: 'OpenSSH Client is required', guidance: 'Enable OpenSSH Client before any device changes.', details: '', diagnosticPath: null })
    await user.click(button)
    const dialog = await screen.findByRole('alertdialog')
    expect(dialog.contains(document.activeElement)).toBe(true)
    await user.tab({ shift: true }); expect(dialog.contains(document.activeElement)).toBe(true)
    await user.keyboard('{Escape}'); expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(document.activeElement).toBe(button)
  })
  it('offers safe stopping during checks and hides it during critical writes', async () => {
    const pending = deferred<typeof preview>()
    render(<App />); await ready()
    bridge.invoke.mockImplementation((command) => command === 'run_install' ? pending.promise : Promise.resolve())
    fireEvent.click(screen.getByRole('button', { name: 'Check device' }))
    fireEvent.click(screen.getByRole('button', { name: 'Stop after current check' }))
    expect(bridge.invoke).toHaveBeenCalledWith('stop_operation')
    await act(async () => bridge.handlers.get('installer-progress')!({ payload: { kind: 'critical' } }))
    expect(screen.queryByRole('button', { name: 'Stop after current check' })).toBeNull()
    await act(async () => pending.resolve(preview))
  })
  it('requires review before recovering a pending transaction', async () => {
    bridge.invoke.mockImplementation(async (command) => command === 'detect_device' ? { ...detected(), ready: false, recovery: { id: 'sample-transaction', incomplete: false } } : undefined)
    render(<App />); await ready()
    expect((screen.getByRole('button', { name: 'Check device' }) as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Restore previous installation' }))
    expect(bridge.invoke.mock.calls.some(([command]) => command === 'recover_device')).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Recover and verify' }))
    await waitFor(() => expect(bridge.invoke).toHaveBeenCalledWith('recover_device', { detectionId: 'sample-plan', transactionId: 'sample-transaction' }))
  })
  it('opens a native bundle picker and invalidates the checked configuration', async () => {
    render(<App />); await ready(); await check()
    fireEvent.click(screen.getByText('Offline bundle and diagnostics'))
    fireEvent.click(screen.getByRole('button', { name: 'Browse…' }))
    await waitFor(() => expect((screen.getByLabelText(/Offline bundle directory/) as HTMLInputElement).value).toBe('/sample/bundle'))
    expect(screen.queryByRole('button', { name: '3. Update' })).toBeNull()
  })

})

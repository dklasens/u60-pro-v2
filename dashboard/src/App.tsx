import { useState } from 'react'
import { login, setToken, clearToken, hasToken } from './api'
import Sidebar from './components/Sidebar'
import AlertBanner from './components/AlertBanner'
import DashboardPage from './pages/DashboardPage'
import SignalPage from './pages/SignalPage'
import NetworkPage from './pages/NetworkPage'
import WiFiPage from './pages/WiFiPage'
import RouterPage from './pages/RouterPage'
import ToolsPage from './pages/ToolsPage'
import BandLockPage from './pages/BandLockPage'
import SettingsPage from './pages/SettingsPage'
import MetricsPage from './pages/MetricsPage'
import ModemPage from './pages/ModemPage'
import AdvancedPage from './pages/AdvancedPage'

export type Page = 'dashboard' | 'signal' | 'network' | 'wifi' | 'router' | 'modem' | 'tools' | 'bandlock' | 'metrics' | 'advanced' | 'settings'

export default function App() {
  const [authed, setAuthed] = useState(hasToken())
  const [page, setPage] = useState<Page>('dashboard')
  const [loginErr, setLoginErr] = useState('')
  const [pw, setPw] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setLoginErr('')
    try {
      const { token } = await login(pw)
      setToken(token)
      setAuthed(true)
    } catch {
      setLoginErr('Invalid password')
    } finally {
      setLoading(false)
    }
  }

  function handleLogout() {
    clearToken()
    setAuthed(false)
    setPw('')
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <div className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-800 p-8 shadow-2xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white">ZTE U60 Pro</h1>
            <p className="mt-1 text-sm text-slate-400">Dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-300">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pw}
                onChange={e => setPw(e.target.value.replace(/\D/g, ''))}
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-3 text-center text-2xl tracking-[0.5em] text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="------"
                maxLength={6}
                autoFocus
                autoComplete="off"
              />
            </div>
            {loginErr && <p className="text-sm text-red-400">{loginErr}</p>}
            <button
              type="submit"
              disabled={loading || !pw}
              className="w-full rounded-lg bg-blue-600 py-2.5 font-medium text-white transition hover:bg-blue-500 disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  let pageContent: React.ReactNode = null
  switch (page) {
    case 'dashboard': pageContent = <DashboardPage />; break
    case 'signal':    pageContent = <SignalPage />; break
    case 'network':   pageContent = <NetworkPage />; break
    case 'wifi':      pageContent = <WiFiPage />; break
    case 'router':    pageContent = <RouterPage />; break
    case 'modem':     pageContent = <ModemPage />; break
    case 'tools':     pageContent = <ToolsPage />; break
    case 'bandlock':  pageContent = <BandLockPage />; break
    case 'metrics':   pageContent = <MetricsPage />; break
    case 'advanced':  pageContent = <AdvancedPage />; break
    case 'settings':  pageContent = <SettingsPage onLogout={handleLogout} />; break
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        page={page}
        onNavigate={p => { setPage(p); setSidebarOpen(false) }}
        open={sidebarOpen}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Mobile header */}
        <header className="flex shrink-0 items-center gap-3 border-b border-slate-700/50 bg-slate-800/80 px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-slate-400 hover:text-white">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-white">ZTE U60 Pro</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AlertBanner />
          {pageContent}
        </main>
      </div>
    </div>
  )
}

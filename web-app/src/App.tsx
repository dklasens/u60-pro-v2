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
      <div className="flex min-h-screen items-center justify-center bg-slds-bg p-8">
        <div className="bg-white w-full max-w-sm rounded-2xl shadow-macos-xl border border-black/5 p-8">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slds-blue shadow-sm">
              <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">ZTE U60 Pro</h1>
            <p className="mt-1 text-xs text-gray-500">Dashboard</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5 block">PIN</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pw}
                onChange={e => setPw(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] text-gray-900 placeholder-gray-400 focus:ring-0 focus:shadow-macos-focus focus:border-slds-blue outline-none transition-all"
                placeholder="------"
                maxLength={6}
                autoFocus
                autoComplete="off"
              />
            </div>
            {loginErr && <p className="text-xs text-red-500">{loginErr}</p>}
            <button
              type="submit"
              disabled={loading || !pw}
              className="w-full bg-slds-blue text-white py-3.5 rounded-2xl font-bold shadow-sm hover:bg-slds-blueHover active:scale-[0.98] disabled:opacity-40 transition-all"
            >
              {loading ? 'Signing in\u2026' : 'Sign in'}
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
    <div className="flex h-screen overflow-hidden bg-slds-bg">
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-gray-900/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar
        page={page}
        onNavigate={p => { setPage(p); setSidebarOpen(false) }}
        open={sidebarOpen}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex shrink-0 items-center gap-3 border-b border-black/5 bg-white/70 backdrop-blur-xl px-4 py-3 lg:hidden">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-500 hover:text-gray-900 transition-colors">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-bold text-gray-900">ZTE U60 Pro</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <AlertBanner />
          {pageContent}
        </main>
      </div>
    </div>
  )
}

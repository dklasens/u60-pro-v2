// HTTP client for the agent: token handling, envelope unwrapping, timeouts.

export const API_BASE = `http://${window.location.hostname}:9090`
export const AUTH_EXPIRED_EVENT = 'zte-auth-expired'

let _token: string | null = sessionStorage.getItem('zte_token')

export function setToken(t: string) {
  _token = t
  sessionStorage.setItem('zte_token', t)
}

export function clearToken() {
  _token = null
  sessionStorage.removeItem('zte_token')
}

export function hasToken() {
  return !!_token
}

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function emitAuthExpired() {
  clearToken()
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
}

export async function req(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
  timeoutMs = 15_000,
  base = API_BASE,
  sendToken = true,
): Promise<Record<string, unknown>> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const headers: Record<string, string> = { ...(extraHeaders ?? {}) }
  if (_token && sendToken) headers['Authorization'] = `Bearer ${_token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  try {
    let res: Response
    try {
      res = await fetch(`${base}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new ApiError('Timed out reaching the agent')
      }
      throw new ApiError(`Failed to reach the agent at ${API_BASE}`)
    }

    let json: { ok?: boolean; data?: unknown; error?: string }
    try {
      json = await res.json()
    } catch {
      throw new ApiError(`Invalid response from agent (${res.status})`, res.status)
    }

    if (res.status === 401 && sendToken && base === API_BASE && path !== '/api/auth/login') {
      emitAuthExpired()
    }
    if (!res.ok || !json.ok) {
      throw new ApiError(json.error ?? `request failed (${res.status})`, res.status)
    }
    return (json.data ?? {}) as Record<string, unknown>
  } finally {
    clearTimeout(timeout)
  }
}

export const get = (path: string) => req('GET', path)
export const post = (path: string, body?: unknown, extraHeaders?: Record<string, string>) =>
  req('POST', path, body, extraHeaders)
export const put = (path: string, body: unknown) => req('PUT', path, body)

export async function login(
  credentials: string | { password?: string; pin?: string },
): Promise<{ token: string }> {
  const body = typeof credentials === 'string' ? { password: credentials } : credentials
  const data = await req('POST', '/api/auth/login', body)
  return { token: data.token as string }
}

// Only the private IPv4 address explicitly submitted by the user may receive
// a single-use confirmation token during a LAN transition. Never transfer the
// general session token: the proposed address could already belong to another host.
export async function confirmLan(ip: string, confirmationToken: string) {
  const octets = ip.split('.').map(Number)
  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(ip) || octets.some(n => n > 255) ||
      !(octets[0] === 10 || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
        (octets[0] === 192 && octets[1] === 168))) {
    throw new ApiError('Invalid LAN reconnect address')
  }
  return req('POST', '/api/router/lan/confirm', { token: confirmationToken }, undefined, 3000, `http://${ip}:9090`, false)
}

export async function readCsv(path: string): Promise<{ csv: string }> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      headers: _token ? { Authorization: `Bearer ${_token}` } : {}, signal: controller.signal,
    })
    if (response.status === 401) emitAuthExpired()
    if (!response.ok) throw new ApiError(`CSV download failed (${response.status})`, response.status)
    // Older agents and the emulator return a JSON envelope.
    if (response.headers.get('content-type')?.includes('application/json')) {
      const body = await response.json()
      if (!body.ok || typeof body.data?.csv !== 'string') throw new ApiError('Invalid CSV response')
      return { csv: body.data.csv }
    }
    return { csv: await response.text() }
  } finally { clearTimeout(timeout) }
}

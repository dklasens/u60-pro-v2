import { useState, useEffect, useCallback } from 'react'
import { api, type SmsMessage } from '../api'
import Card from '../components/Card'

const BOX_INBOX = 1
const BOX_SENT  = 2

function formatDate(d?: string) {
  if (!d) return ''
  try { return new Date(d).toLocaleString() } catch { return d }
}

export default function SmsPage() {
  const [box, setBox] = useState(BOX_INBOX)
  const [messages, setMessages] = useState<SmsMessage[]>([])
  const [selected, setSelected] = useState<SmsMessage | null>(null)
  const [loading, setLoading] = useState(false)
  const [composing, setComposing] = useState(false)
  const [to, setTo] = useState('')
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [sendMsg, setSendMsg] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const msgs = await api.smsList(box)
      setMessages(Array.isArray(msgs) ? msgs : [])
    } catch {
      setMessages([])
    } finally {
      setLoading(false)
    }
  }, [box])

  useEffect(() => { load() }, [load])

  async function markRead(id: number) {
    try { await api.smsRead([id]) } catch { /* ignore */ }
  }

  async function deleteMsg(id: number) {
    try {
      await api.smsDelete([id])
      setMessages(m => m.filter(x => x.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch { /* ignore */ }
  }

  function openMsg(m: SmsMessage) {
    setSelected(m)
    if (!m.read) { markRead(m.id); setMessages(ms => ms.map(x => x.id === m.id ? { ...x, read: true } : x)) }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setSendMsg('')
    try {
      await api.smsSend(to, text)
      setSendMsg('Sent!')
      setTo(''); setText('')
      setTimeout(() => setComposing(false), 1500)
    } catch (err) {
      setSendMsg(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  const unread = messages.filter(m => !m.read).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-text-primary">SMS</h1>
        <button
          onClick={() => { setComposing(true); setSelected(null) }}
          className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-all duration-200"
        >
          + New SMS
        </button>
      </div>

      {/* Compose */}
      {composing && (
        <Card title="New Message">
          <form onSubmit={send} className="space-y-3">
            <div>
              <label className="mb-0.5 block text-xs text-text-muted">To</label>
              <input value={to} onChange={e => setTo(e.target.value)} required
                className="w-full rounded-pill border border-divider bg-white/40 px-3 py-1.5 text-sm text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="+1234567890" />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-text-muted">Message</label>
              <textarea value={text} onChange={e => setText(e.target.value)} required rows={4}
                className="w-full resize-none rounded-pill border border-divider bg-white/40 px-3 py-1.5 text-sm text-text-primary backdrop-blur-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                placeholder="Type a message…" />
              <p className="mt-0.5 text-right text-xs text-text-muted">{text.length}/160</p>
            </div>
            {sendMsg && <p className={`text-sm ${sendMsg === 'Sent!' ? 'text-green-500' : 'text-red-500'}`}>{sendMsg}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={sending || !to || !text}
                className="rounded-pill bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover transition-all duration-200 disabled:opacity-40">
                {sending ? 'Sending…' : 'Send'}
              </button>
              <button type="button" onClick={() => setComposing(false)}
                className="rounded-pill bg-white/30 backdrop-blur-sm px-4 py-2 text-sm font-medium text-text-secondary hover:bg-white/50 transition-all duration-200">
                Cancel
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Message list */}
        <Card
          className="lg:col-span-1"
          title={box === BOX_INBOX ? `Inbox${unread ? ` (${unread})` : ''}` : 'Sent'}
          action={
            <div className="flex gap-2">
              <button onClick={() => setBox(BOX_INBOX)} className={`text-xs ${box === BOX_INBOX ? 'text-primary' : 'text-text-muted hover:text-text-primary transition-colors'}`}>Inbox</button>
              <button onClick={() => setBox(BOX_SENT)} className={`text-xs ${box === BOX_SENT ? 'text-primary' : 'text-text-muted hover:text-text-primary transition-colors'}`}>Sent</button>
            </div>
          }
        >
          {loading ? (
            <p className="text-sm text-text-muted">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-text-muted">No messages</p>
          ) : (
            <ul className="divide-y divide-divider -mx-4">
              {messages.map(m => (
                <li key={m.id}
                  onClick={() => openMsg(m)}
                  className={`cursor-pointer px-4 py-3 transition-colors hover:bg-white/20 ${selected?.id === m.id ? 'bg-white/30' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm truncate ${!m.read ? 'font-semibold text-text-primary' : 'text-text-secondary'}`}>
                      {m.from ?? '—'}
                    </p>
                    {!m.read && <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                  </div>
                  <p className="mt-0.5 text-xs text-text-muted truncate">{m.text}</p>
                  <p className="mt-0.5 text-xs text-text-muted">{formatDate(m.date)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Message detail */}
        <Card className="lg:col-span-2" title={selected ? 'Message' : 'Select a message'}>
          {selected ? (
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">From: {selected.from ?? '—'}</p>
                  <p className="text-xs text-text-muted">{formatDate(selected.date)}</p>
                </div>
                <button onClick={() => deleteMsg(selected.id)}
                  className="rounded-pill bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/20 transition-all duration-200">
                  Delete
                </button>
              </div>
              <div className="rounded-pill bg-white/20 p-4">
                <p className="whitespace-pre-wrap text-sm text-text-primary">{selected.text}</p>
              </div>
              <button
                onClick={() => { setComposing(true); setTo(selected.from ?? ''); setSelected(null) }}
                className="rounded-pill bg-white/30 backdrop-blur-sm px-4 py-2 text-sm font-medium text-text-secondary hover:bg-white/50 transition-all duration-200"
              >
                Reply
              </button>
            </div>
          ) : (
            <p className="text-sm text-text-muted">No message selected</p>
          )}
        </Card>
      </div>
    </div>
  )
}

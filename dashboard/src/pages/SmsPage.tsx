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
        <h1 className="text-lg font-semibold text-white">SMS</h1>
        <button
          onClick={() => { setComposing(true); setSelected(null) }}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          + New SMS
        </button>
      </div>

      {/* Compose */}
      {composing && (
        <Card title="New Message">
          <form onSubmit={send} className="space-y-3">
            <div>
              <label className="mb-0.5 block text-xs text-slate-400">To</label>
              <input value={to} onChange={e => setTo(e.target.value)} required
                className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="+1234567890" />
            </div>
            <div>
              <label className="mb-0.5 block text-xs text-slate-400">Message</label>
              <textarea value={text} onChange={e => setText(e.target.value)} required rows={4}
                className="w-full resize-none rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-sm text-white focus:border-blue-500 focus:outline-none"
                placeholder="Type a message…" />
              <p className="mt-0.5 text-right text-xs text-slate-500">{text.length}/160</p>
            </div>
            {sendMsg && <p className={`text-sm ${sendMsg === 'Sent!' ? 'text-green-400' : 'text-red-400'}`}>{sendMsg}</p>}
            <div className="flex gap-2">
              <button type="submit" disabled={sending || !to || !text}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50">
                {sending ? 'Sending…' : 'Send'}
              </button>
              <button type="button" onClick={() => setComposing(false)}
                className="rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600">
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
              <button onClick={() => setBox(BOX_INBOX)} className={`text-xs ${box === BOX_INBOX ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}>Inbox</button>
              <button onClick={() => setBox(BOX_SENT)} className={`text-xs ${box === BOX_SENT ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}>Sent</button>
            </div>
          }
        >
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-slate-500">No messages</p>
          ) : (
            <ul className="divide-y divide-slate-700/50 -mx-4">
              {messages.map(m => (
                <li key={m.id}
                  onClick={() => openMsg(m)}
                  className={`cursor-pointer px-4 py-3 transition hover:bg-slate-700/40 ${selected?.id === m.id ? 'bg-slate-700/60' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className={`text-sm truncate ${!m.read ? 'font-semibold text-white' : 'text-slate-300'}`}>
                      {m.from ?? '—'}
                    </p>
                    {!m.read && <span className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400 truncate">{m.text}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{formatDate(m.date)}</p>
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
                  <p className="text-sm font-medium text-white">From: {selected.from ?? '—'}</p>
                  <p className="text-xs text-slate-400">{formatDate(selected.date)}</p>
                </div>
                <button onClick={() => deleteMsg(selected.id)}
                  className="rounded-lg bg-red-900/40 px-3 py-1.5 text-xs font-medium text-red-300 hover:bg-red-800/40">
                  Delete
                </button>
              </div>
              <div className="rounded-lg bg-slate-700/40 p-4">
                <p className="whitespace-pre-wrap text-sm text-slate-200">{selected.text}</p>
              </div>
              <button
                onClick={() => { setComposing(true); setTo(selected.from ?? ''); setSelected(null) }}
                className="rounded-lg bg-slate-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-600"
              >
                Reply
              </button>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No message selected</p>
          )}
        </Card>
      </div>
    </div>
  )
}

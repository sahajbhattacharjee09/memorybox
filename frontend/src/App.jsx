import React, { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const TTL_OPTIONS = [
  { v: 600, label: '10 minutes' },
  { v: 3600, label: '1 hour' },
  { v: 86400, label: '1 day' }
]

export default function App() {
  const [text, setText] = useState('')
  const [ttl, setTtl] = useState(TTL_OPTIONS[0].v)
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchNotes = async () => {
    try {
      const res = await fetch(`${API_BASE}/notes`)
      const data = await res.json()
      setNotes(data)
    } catch (e) {
      console.error('fetchNotes', e)
    }
  }

  useEffect(() => {
    fetchNotes()
    const iv = setInterval(fetchNotes, 4000)
    return () => clearInterval(iv)
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), ttl })
      })
      if (res.ok) {
        setText('')
        fetchNotes()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const remove = async (id) => {
    await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' })
    fetchNotes()
  }

  return (
    <div className="wrap">
      <main className="card">
        <h1 className="title">MemoryBox</h1>

        <form onSubmit={submit} className="form">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Jot something quick..."
            rows={4}
          />
          <div className="controls">
            <select value={ttl} onChange={(e) => setTtl(Number(e.target.value))}>
              {TTL_OPTIONS.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
            <button type="submit" disabled={loading}>Save</button>
          </div>
        </form>

        <section className="notes">
          {notes.length === 0 && <p className="muted">No active notes.</p>}
          {notes.map((n) => (
            <article key={n.id} className="note">
              <div className="note-text">{n.text}</div>
              <div className="note-meta">
                <small>{formatTTL(n.ttl)}</small>
                <button onClick={() => remove(n.id)}>delete</button>
              </div>
            </article>
          ))}
        </section>

        <footer className="footer">Temporary notes — they vanish automatically.</footer>
      </main>
    </div>
  )
}

function formatTTL(secs) {
  if (secs === -2) return 'gone'
  if (secs === -1) return 'no expiry'
  if (typeof secs !== 'number') return ''
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h`
}

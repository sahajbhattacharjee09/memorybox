import React, { useEffect, useState, useRef } from 'react'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const DEFAULT_TTL_OPTIONS = [
  { v: 10, label: '10 minutes' },
  { v: 60, label: '1 hour' },
  { v: 1440, label: '1 day' }
]

// color/tag choices
const TAGS = [
  { id: '', label: 'None', color: '#ddd' },
  { id: 'idea', label: 'Idea', color: '#FFD166' },
  { id: 'goal', label: 'Goal', color: '#06D6A0' },
  { id: 'vent', label: 'Vent', color: '#FF6B6B' },
  { id: 'note', label: 'Note', color: '#9D94FF' }
]

export default function App() {
  const [text, setText] = useState('')
  const [ttlMinutes, setTtlMinutes] = useState(DEFAULT_TTL_OPTIONS[0].v) // minutes
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedTag, setSelectedTag] = useState('')
  const notesRef = useRef([])

  useEffect(() => {
    fetchNotes()
    const iv = setInterval(fetchNotes, 3000) // poll frequently for TTL updates
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    notesRef.current = notes
  }, [notes])

  async function fetchNotes() {
    try {
      const res = await fetch(`${API_BASE}/notes`)
      if (!res.ok) {
        console.error('fetch notes failed', res.status)
        return
      }
      const data = await res.json()
      setNotes(data)
    } catch (err) {
      console.error('fetchNotes error', err)
    }
  }

  async function submit(e) {
    e && e.preventDefault()
    if (!text.trim()) {
      toast.error('Please enter something to save')
      return
    }
    setLoading(true)
    try {
      const ttlSeconds = Math.max(1, Math.floor(Number(ttlMinutes) * 60))
      const payload = { text: text.trim(), ttl: ttlSeconds, tag: selectedTag }
      const res = await fetch(`${API_BASE}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        toast.success('Saved')
        setText('')
        setSelectedTag('')
        fetchNotes()
      } else {
        const txt = await res.text()
        toast.error('Save failed')
        console.error('save failed', res.status, txt)
      }
    } catch (err) {
      toast.error('Save failed')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function remove(id) {
    try {
      const res = await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.info('Deleted')
      } else {
        toast.error('Delete failed')
      }
    } catch (err) {
      toast.error('Delete failed')
      console.error(err)
    } finally {
      fetchNotes()
    }
  }

  // format ttl seconds as human readable
  function formatTTL(secs) {
    if (secs === -2) return 'gone'
    if (secs === -1) return 'no expiry'
    if (typeof secs !== 'number') return ''
    if (secs < 60) return `${secs}s`
    if (secs < 3600) return `${Math.floor(secs / 60)}m`
    return `${Math.floor(secs / 3600)}h`
  }

  return (
    <div className="wrap">
      <ToastContainer position="top-right" autoClose={1800} hideProgressBar={false} />
      <main className="card">
        <h1 className="title">MemoryBox</h1>

        <form onSubmit={submit} className="form">
          <textarea
            placeholder="Jot something quick..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
          />

          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#444' }}>TTL (minutes)</span>
              <input
                type="number"
                min="1"
                max="10080"
                value={ttlMinutes}
                onChange={(e) => setTtlMinutes(e.target.value)}
                style={{ width: 100, padding: 6, borderRadius: 6, border: '1px solid #e6e8ef' }}
              />
            </label>

            <label style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#444' }}>Tag</span>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                style={{ padding: 6, borderRadius: 6, border: '1px solid #e6e8ef' }}
              >
                {TAGS.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}</option>
                ))}
              </select>
            </label>

            <button type="submit" disabled={loading} style={{ marginLeft: 'auto' }}>
              Save
            </button>
          </div>
        </form>

        <section className="notes" style={{ marginTop: 16 }}>
          {notes.length === 0 && <p className="muted">No active notes.</p>}
          {notes.map((n) => {
            // compute progress: uses ttl and orig_ttl (seconds)
            const ttl = typeof n.ttl === 'number' ? n.ttl : parseInt(n.ttl || 0)
            const orig = typeof n.orig_ttl === 'number' ? n.orig_ttl : parseInt(n.orig_ttl || 0)
            const progress = orig > 0 && ttl >= 0 ? Math.max(0, Math.min(1, ttl / orig)) : 0
            const tagMeta = TAGS.find((t) => t.id === n.tag) || { color: '#ddd', label: n.tag || '' }

            return (
              <article key={n.id} className="note">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ marginRight: 6 }}>{n.text}</strong>
                      {tagMeta && tagMeta.id !== '' && (
                        <span style={{
                          background: tagMeta.color,
                          padding: '2px 8px',
                          borderRadius: 999,
                          fontSize: 12
                        }}>{tagMeta.label}</span>
                      )}
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <div className="progress-outer">
                        <div className="progress-inner" style={{ width: `${Math.round(progress * 100)}%` }} />
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <small style={{ display: 'block', color: '#666' }}>{formatTTL(ttl)}</small>
                    <button className="link-btn" onClick={() => remove(n.id)} style={{ marginTop: 8 }}>
                      delete
                    </button>
                  </div>
                </div>
              </article>
            )
          })}
        </section>

        <footer className="footer" style={{ marginTop: 12 }}>Temporary notes — they vanish automatically.</footer>
      </main>
    </div>
  )
}

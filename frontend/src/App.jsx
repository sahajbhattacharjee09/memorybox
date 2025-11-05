import React, { useEffect, useState, useRef, useCallback } from 'react'
import { toast, ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

const TAGS = [
  { id: '', label: 'None', color: '#E6EEF8' },
  { id: 'idea', label: 'Idea', color: '#FFD166' },
  { id: 'goal', label: 'Goal', color: '#06D6A0' },
  { id: 'vent', label: 'Vent', color: '#FF6B6B' },
  { id: 'note', label: 'Note', color: '#9D94FF' }
]

const fmtTTL = (secs) => {
  if (secs === -2) return 'gone'
  if (secs === -1) return '∞'
  if (typeof secs !== 'number') return ''
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m`
  return `${Math.floor(secs / 3600)}h`
}

export default function App() {
  const [text, setText] = useState('')
  const [ttlMinutes, setTtlMinutes] = useState(1) // default 1 minute
  const [selectedTag, setSelectedTag] = useState('')
  const [notes, setNotes] = useState([]) // each note: {id,text,tag,ttl,orig_ttl}
  const [loading, setLoading] = useState(false)
  const [q, setQ] = useState('')
  const [showOnlyTag, setShowOnlyTag] = useState('')
  const [dark, setDark] = useState(false)
  const inputRef = useRef(null)

  // refs to avoid stale closures
  const submitRef = useRef(() => {})
  const fetchNotesRef = useRef(() => {})

  // Fetch notes from backend
  const fetchNotes = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/notes`)
      if (!res.ok) return
      const data = await res.json()
      // ensure numeric ttl for each note
      const normalized = (data || []).map((n) => ({
        ...n,
        ttl: typeof n.ttl === 'number' ? n.ttl : parseInt(n.ttl || 0, 10) || 0,
        orig_ttl: typeof n.orig_ttl === 'number' ? n.orig_ttl : parseInt(n.orig_ttl || 0, 10) || 0
      }))
      setNotes(normalized)
    } catch (err) {
      console.error('fetch notes error', err)
    }
  }, [])

  useEffect(() => { fetchNotesRef.current = fetchNotes }, [fetchNotes])

  // initial load & poll every 3s to stay in sync with Redis (server TTL truth)
  useEffect(() => {
    const storedDark = localStorage.getItem('memorybox:dark')
    if (storedDark === '1') {
      setDark(true)
      document.documentElement.classList.add('dark')
    }
    fetchNotes()
    const poll = setInterval(() => fetchNotesRef.current(), 3000)
    return () => clearInterval(poll)
  }, [fetchNotes])

  useEffect(() => {
    if (dark) {
      localStorage.setItem('memorybox:dark', '1')
      document.documentElement.classList.add('dark')
    } else {
      localStorage.removeItem('memorybox:dark')
      document.documentElement.classList.remove('dark')
    }
  }, [dark])

  // local 1s ticker that decrements displayed TTLs for smooth UX.
  useEffect(() => {
    const tick = setInterval(() => {
      setNotes((prev) => {
        if (!prev || prev.length === 0) return prev
        return prev.map((n) => {
          if (typeof n.ttl !== 'number') return n
          if (n.ttl > 0) return { ...n, ttl: n.ttl - 1 }
          return n
        })
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [])

  // submit function
  const submit = useCallback(async (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (!text.trim()) {
      toast.error('Type something first 😉')
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
        toast.success('Saved — note will expire')
        setText('')
        setSelectedTag('')
        setTtlMinutes(1)
        fetchNotesRef.current()
        inputRef.current?.focus()
      } else {
        toast.error('Save failed')
      }
    } catch (err) {
      console.error('submit error', err)
      toast.error('Save failed')
    } finally {
      setLoading(false)
    }
  }, [text, ttlMinutes, selectedTag])
  useEffect(() => { submitRef.current = submit }, [submit])

  // delete note
  async function remove(id) {
    try {
      const res = await fetch(`${API_BASE}/notes/${id}`, { method: 'DELETE' })
      if (res.ok) toast.info('Deleted')
      else toast.error('Delete failed')
    } catch (err) {
      console.error(err)
      toast.error('Delete failed')
    } finally {
      fetchNotesRef.current()
    }
  }

  // keyboard shortcuts: Ctrl/Cmd+Enter => save, Escape => clear editor
  useEffect(() => {
    const onKey = (e) => {
      const isMac = navigator.platform.toUpperCase().includes('MAC')
      const modifier = isMac ? e.metaKey : e.ctrlKey
      if (modifier && e.key === 'Enter') {
        submitRef.current()
      } else if (e.key === 'Escape') {
        setText('')
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const filtered = notes.filter((n) => {
    if (q.trim()) {
      const s = q.toLowerCase()
      if (!(String(n.text).toLowerCase().includes(s) || String(n.tag || '').toLowerCase().includes(s))) {
        return false
      }
    }
    if (showOnlyTag && showOnlyTag !== '') {
      return n.tag === showOnlyTag
    }
    return true
  })

  return (
    <div className="app-root">
      <ToastContainer position="top-right" autoClose={1600} hideProgressBar={false} />

      <header className="topbar center-topbar">
        <div className="brand">
          {/* Use the image in public/ as the logo */}
          <img src="/image.png" alt="MemoryBox logo" className="logo" />
          <div>
            <h1>MemoryBox</h1>
            <p className="tagline">Jot. Release. Repeat.</p>
          </div>
        </div>

        <div className="actions">
          <div className="search">
            <input
              placeholder="Search notes or tags..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search notes"
            />
            <button onClick={() => { setQ(''); inputRef.current?.focus() }} title="Clear search">✖</button>
          </div>

          <button
            className="btn ghost"
            onClick={() => setDark((d) => !d)}
            title="Toggle dark mode"
          >
            {dark ? '🌙 Dark' : '☀️ Light'}
          </button>
        </div>
      </header>

      <main className="container centered">
        <section className="pane composer-pane card">
          <form className="composer" onSubmit={submit}>
            <textarea
              ref={inputRef}
              placeholder="Jot an idea, thought, or secret... (Ctrl/Cmd+Enter to save)"
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={7}
              className="composer-textarea"
            />

            <div className="composer-row">
              <div className="controls-left">
                <label className="ttl" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span>TTL</span>
                  <input
                    style={{ width: 320 }}
                    type="range"
                    min="1"
                    max="1440"
                    value={ttlMinutes}
                    onChange={(e) => setTtlMinutes(Number(e.target.value))}
                  />
                  <div className="ttl-value" style={{ minWidth: 48 }}>{ttlMinutes}m</div>
                </label>

                <div className="tag-picker">
                  {TAGS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={`tag-chip ${selectedTag === t.id ? 'active' : ''}`}
                      style={{ borderColor: selectedTag === t.id ? t.color : 'transparent' }}
                      onClick={() => setSelectedTag(selectedTag === t.id ? '' : t.id)}
                      title={t.label}
                    >
                      <span className="chip-dot" style={{ background: t.color }} />
                      <span className="chip-label">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="controls-right">
                <button className="btn primary" type="submit" disabled={loading}>
                  {loading ? 'Saving…' : 'Save'}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  onClick={() => { setText(''); setSelectedTag(''); setTtlMinutes(1) }}
                >
                  Clear
                </button>
              </div>
            </div>
          </form>

          <div className="help">
            <h4>Quick tips</h4>
            <ul>
              <li><strong>Ctrl/Cmd + Enter</strong> — save</li>
              <li><strong>Esc</strong> — clear editor</li>
              <li>Notes automatically expire after the TTL</li>
            </ul>
          </div>
        </section>

        <aside className="pane notes-pane">
          <div className="notes-toolbar">
            <div className="filter-tags">
              <label>Filter:</label>
              <select value={showOnlyTag} onChange={(e) => setShowOnlyTag(e.target.value)}>
                <option value="">All</option>
                {TAGS.filter(t => t.id).map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            <div className="count">{filtered.length} active</div>
          </div>

          <div className="notes-grid">
            {filtered.length === 0 && <div className="empty">No active notes — create one!</div>}
            {filtered.map((n) => {
              const ttl = typeof n.ttl === 'number' ? n.ttl : parseInt(n.ttl || 0)
              const orig = typeof n.orig_ttl === 'number' ? n.orig_ttl : parseInt(n.orig_ttl || 0) || 0
              const progress = orig > 0 ? Math.max(0, Math.min(1, ttl / orig)) : 0
              const tagMeta = TAGS.find(t => t.id === n.tag) || TAGS[0]

              return (
                <article key={n.id} className="note-card">
                  <div className="note-top">
                    <div className="note-tag" style={{ background: tagMeta.color }}>{tagMeta.label}</div>
                    <div className="note-actions">
                      <button className="icon-btn" onClick={() => remove(n.id)} title="Delete">🗑</button>
                    </div>
                  </div>

                  <div className="note-body">
                    <p className="note-text">{n.text}</p>
                  </div>

                  <div className="note-bottom">
                    <div className="progress-wrap">
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${Math.round(progress * 100)}%` }} />
                      </div>
                      <div className="ttl-meta">{fmtTTL(ttl)}</div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        </aside>
      </main>

      <footer className="footer-note">
        Clean UI · fast UX — MemoryBox (temporary notes)
      </footer>
    </div>
  )
}

import { useState, useEffect, useCallback } from 'react'
import './FreeRooms.css'

// ─── Resource IDs (ADE Math-Info) ────────────────────────────────────────────
// Add more group/room resource IDs here to expand coverage
const RESOURCE_IDS = ['19976']

// ─── iCal parser ─────────────────────────────────────────────────────────────

function unfoldIcal(text) {
  // iCal lines can be folded (continuation line starts with space or tab)
  return text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '')
}

function parseIcalDate(str) {
  // Handles: 20261022T063000Z (UTC) or 20261022T083000 (local)
  const clean = str.replace(/[TZ]/g, ' ').trim()
  const year  = parseInt(str.slice(0, 4))
  const month = parseInt(str.slice(4, 6)) - 1
  const day   = parseInt(str.slice(6, 8))
  const hour  = parseInt(str.slice(9, 11))
  const min   = parseInt(str.slice(11, 13))
  const sec   = parseInt(str.slice(13, 15) || '0')
  if (str.endsWith('Z')) {
    return new Date(Date.UTC(year, month, day, hour, min, sec))
  }
  // Treat as Europe/Paris local time (approximate: UTC+2 in summer, UTC+1 in winter)
  // For accuracy we convert via Intl — but a simple offset is fine for scheduling
  return new Date(year, month, day, hour, min, sec)
}

function parseIcal(text) {
  const unfolded = unfoldIcal(text)
  const events = []
  const blocks = unfolded.split('BEGIN:VEVENT')

  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i]

    const dtstart  = block.match(/DTSTART(?:;[^:]+)?:(\S+)/)?.[1]
    const dtend    = block.match(/DTEND(?:;[^:]+)?:(\S+)/)?.[1]
    const summary  = block.match(/SUMMARY:(.+)/)?.[1]?.trim() || ''
    const location = block.match(/LOCATION:(.+)/)?.[1]?.trim() || ''

    if (!dtstart || !dtend || !location || location === 'salle non définie') continue

    events.push({
      start:    parseIcalDate(dtstart),
      end:      parseIcalDate(dtend),
      summary,
      location,
    })
  }

  return events
}

// ─── Free-room computation ────────────────────────────────────────────────────

function toParisTime(date) {
  return new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
}

function fmtTime(date) {
  return date.toLocaleTimeString('fr-FR', {
    timeZone: 'Europe/Paris',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function minutesUntil(date, now) {
  return Math.round((date - now) / 60000)
}

function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`
}

function computeRooms(events, now) {
  const parisNow = toParisTime(now)

  // Today boundaries in Paris time
  const todayStart = new Date(parisNow)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setDate(todayEnd.getDate() + 1)

  // Group today's events by room
  const byRoom = {}
  for (const ev of events) {
    const start = toParisTime(ev.start)
    const end   = toParisTime(ev.end)
    if (start >= todayEnd || end <= todayStart) continue
    if (!byRoom[ev.location]) byRoom[ev.location] = []
    byRoom[ev.location].push({ ...ev, start, end })
  }

  // Sort each room's events
  for (const room of Object.keys(byRoom)) {
    byRoom[room].sort((a, b) => a.start - b.start)
  }

  const results = []
  for (const [room, roomEvents] of Object.entries(byRoom)) {
    const current = roomEvents.find(e => e.start <= parisNow && e.end > parisNow)

    if (current) {
      // Merge back-to-back events
      let busyUntil = current.end
      let changed = true
      while (changed) {
        changed = false
        for (const e of roomEvents) {
          if (e.start <= busyUntil && e.end > busyUntil) {
            busyUntil = e.end
            changed = true
          }
        }
      }
      const nextFree = roomEvents.find(e => e.start >= busyUntil)
      results.push({
        room,
        free: false,
        busyUntil,
        busyUntilStr: fmtTime(busyUntil),
        currentEvent: current.summary,
        nextFreeUntil: nextFree ? fmtTime(nextFree.start) : null,
        minutesBusy: minutesUntil(busyUntil, parisNow),
      })
    } else {
      const next = roomEvents.find(e => e.start > parisNow)
      const freeUntil = next ? next.start : null
      const mins = freeUntil ? minutesUntil(freeUntil, parisNow) : null
      results.push({
        room,
        free: true,
        freeUntil,
        freeUntilStr: freeUntil ? fmtTime(freeUntil) : null,
        nextEvent: next?.summary || null,
        minutesFree: mins,
      })
    }
  }

  // Sort: free rooms first (longest availability first), then busy (soonest free first)
  results.sort((a, b) => {
    if (a.free && !b.free) return -1
    if (!a.free && b.free) return 1
    if (a.free && b.free) {
      if (a.minutesFree === null) return -1
      if (b.minutesFree === null) return 1
      return b.minutesFree - a.minutesFree
    }
    return a.minutesBusy - b.minutesBusy
  })

  return results
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FreeRooms() {
  const [rooms,     setRooms]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [lastFetch, setLastFetch] = useState(null)
  const [now,       setNow]       = useState(new Date())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = `/.netlify/functions/ade-proxy?resources=${RESOURCE_IDS.join(',')}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Erreur ${res.status}`)
      const text = await res.text()
      const events = parseIcal(text)
      const current = new Date()
      setRooms(computeRooms(events, current))
      setNow(current)
      setLastFetch(current)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(id)
  }, [load])

  // Recompute room statuses every minute without re-fetching
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])

  const freeRooms = rooms?.filter(r => r.free) ?? []
  const busyRooms = rooms?.filter(r => !r.free) ?? []

  const clockStr = toParisTime(now).toLocaleTimeString('fr-FR', {
    hour: '2-digit', minute: '2-digit',
  })

  return (
    <div className="free-rooms">

      {/* Header */}
      <div className="fr-header">
        <div className="fr-header-left">
          <p className="fr-eyebrow">UFR Mathématiques-Informatique</p>
          <h1 className="fr-title">Salles libres</h1>
        </div>
        <div className="fr-header-right">
          <span className="fr-clock">{clockStr}</span>
          <button className="fr-refresh" onClick={load} disabled={loading} title="Actualiser">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.5 2.5A6 6 0 1 1 9 1.2"/>
              <polyline points="9 1 12.5 1 12.5 4.5"/>
            </svg>
          </button>
        </div>
      </div>

      {error && <p className="fr-error">{error}</p>}

      {loading && !rooms && (
        <div className="fr-skeleton-wrap">
          {[1,2,3,4].map(i => <div key={i} className="fr-skeleton" />)}
        </div>
      )}

      {rooms && (
        <>
          {/* Summary */}
          <div className="fr-summary">
            <div className="fr-summary-stat">
              <span className="fr-summary-count">{freeRooms.length}</span>
              <span className="fr-summary-denom">/{rooms.length}</span>
            </div>
            <div className="fr-summary-meta">
              <span className="fr-summary-label">salles disponibles</span>
              {lastFetch && (
                <span className="fr-summary-time">mis à jour {fmtTime(lastFetch)}</span>
              )}
            </div>
          </div>

          <div className="fr-columns">

            {/* Free rooms */}
            <div className="fr-column">
              <div className="fr-column-header">
                <span className="fr-col-dot free" />
                <h2 className="fr-column-title">Disponibles</h2>
                <span className="fr-col-count">{freeRooms.length}</span>
              </div>
              {freeRooms.length === 0
                ? <p className="fr-empty">Aucune salle libre.</p>
                : freeRooms.map((r, i) => (
                  <div key={r.room} className="fr-card free" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="fr-card-row">
                      <span className="fr-card-name">{r.room}</span>
                      {r.minutesFree !== null
                        ? <span className="fr-badge free">{fmtDuration(r.minutesFree)}</span>
                        : <span className="fr-badge free-all">toute la journée</span>
                      }
                    </div>
                    {r.freeUntilStr
                      ? <div className="fr-card-sub">prochain cours à <strong>{r.freeUntilStr}</strong></div>
                      : <div className="fr-card-sub">aucun cours ce jour</div>
                    }
                  </div>
                ))
              }
            </div>

            {/* Busy rooms */}
            <div className="fr-column">
              <div className="fr-column-header">
                <span className="fr-col-dot busy" />
                <h2 className="fr-column-title">Occupées</h2>
                <span className="fr-col-count">{busyRooms.length}</span>
              </div>
              {busyRooms.length === 0
                ? <p className="fr-empty">Toutes les salles sont libres !</p>
                : busyRooms.map((r, i) => (
                  <div key={r.room} className="fr-card busy" style={{ animationDelay: `${i * 40}ms` }}>
                    <div className="fr-card-row">
                      <span className="fr-card-name">{r.room}</span>
                      <span className="fr-badge busy">{fmtDuration(r.minutesBusy)}</span>
                    </div>
                    {r.currentEvent && (
                      <div className="fr-card-event">{r.currentEvent}</div>
                    )}
                    <div className="fr-card-sub">libre à <strong>{r.busyUntilStr}</strong></div>
                  </div>
                ))
              }
            </div>

          </div>
        </>
      )}
    </div>
  )
}

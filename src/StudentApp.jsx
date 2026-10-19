import { useState } from 'react'
import Lookup from './pages/Lookup'
import Calculator from './pages/Calculator'
import FreeRooms from './pages/FreeRooms'

const SESSION_KEY = 'manote_student'

export default function StudentApp() {
  const [student, setStudent] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

  const [tab, setTab] = useState('notes') // 'notes' | 'salles'

  const handleFound = (s) => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
    setStudent(s)
  }

  const handleChange = () => {
    sessionStorage.removeItem(SESSION_KEY)
    setStudent(null)
  }

  return (
    <div className="app">
      <nav className="nav">
        <div
          className="nav-logo"
          style={{ cursor: 'pointer' }}
          onClick={() => { setTab('notes'); if (student) handleChange() }}
        >
          MANOTE
        </div>

        <div className="nav-right">
          <div className="nav-tabs">
            <button
              className={`nav-tab ${tab === 'notes' ? 'active' : ''}`}
              onClick={() => setTab('notes')}
            >
              Notes
            </button>
            <button
              className={`nav-tab ${tab === 'salles' ? 'active' : ''}`}
              onClick={() => setTab('salles')}
            >
              Salles libres
            </button>
          </div>

          {student && tab === 'notes' && (
            <button className="nav-admin" onClick={handleChange}>
              Changer
            </button>
          )}
        </div>
      </nav>

      <main className="main">
        {tab === 'salles'
          ? <FreeRooms />
          : !student
            ? <Lookup onFound={handleFound} />
            : <Calculator student={student} />
        }
      </main>
    </div>
  )
}

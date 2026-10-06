import { useState } from 'react'
import Lookup from './pages/Lookup'
import Calculator from './pages/Calculator'

const SESSION_KEY = 'manote_student'

export default function StudentApp() {
  const [student, setStudent] = useState(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      return saved ? JSON.parse(saved) : null
    } catch { return null }
  })

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
        <div className="nav-logo" style={{ cursor: student ? 'pointer' : 'default' }}
          onClick={student ? handleChange : undefined}>
          MANOTE
        </div>
        {student && (
          <button className="nav-admin" onClick={handleChange}>
            Changer d'étudiant
          </button>
        )}
      </nav>
      <main className="main">
        {!student
          ? <Lookup onFound={handleFound} />
          : <Calculator student={student} />
        }
      </main>
    </div>
  )
}
